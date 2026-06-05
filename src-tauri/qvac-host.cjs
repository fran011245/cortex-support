#!/usr/bin/env node
/**
 * Cortex QVAC Host (Node.js sidecar / child process)
 *
 * This runs the actual @qvac/sdk in a real Node/Bare-capable environment.
 * Communicates with the Tauri webview over stdio using newline-delimited JSON.
 *
 * Protocol (client -> host on stdin):
 *   { "id": "<client-req-id>", "cmd": "startProvider" }
 *   { "id": "<client-req-id>", "cmd": "loadModel", "params": { modelSrc, modelType?, modelConfig? } }
 *   { "id": "<client-req-id>", "cmd": "complete", "params": { modelId, history, temperature?, maxTokens?, topP?, ... } }
 *   { "id": "<client-req-id>", "cmd": "cancel", "params": { requestId } }
 *
 * Host -> client on stdout (NDJSON):
 *   { "id": "...", "type": "ack" }
 *   { "id": "...", "type": "event", "event": { type: "contentDelta", delta: "..." } }
 *   { "id": "...", "type": "final", "result": { text, thinking?, stats? } }
 *   { "id": "...", "type": "error", "error": "message" }
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const {
  startQVACProvider,
  stopQVACProvider,
  loadModel,
  unloadModel,
  completion,
  embed,
  cancel,
  ragIngest,
  ragSearch,
} = require("@qvac/sdk");

// Map of active streaming requestId (from SDK) -> clientId for routing events
const activeStreams = new Map(); // sdkRequestId -> clientId
// Map clientId -> current run (for potential future abort)
const clientRuns = new Map();

let providerReady = false;

async function ensureProvider() {
  if (providerReady) return;
  console.error("[qvac-host] Starting QVAC provider...");
  await startQVACProvider();
  providerReady = true;
  console.error("[qvac-host] QVAC provider ready");
}

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendError(clientId, message, extra = {}) {
  send({ id: clientId, type: "error", error: message, ...extra });
}

async function handleCommand(clientId, cmd, params = {}) {
  try {
    await ensureProvider();

    switch (cmd) {
      case "startProvider": {
        // already ensured
        send({ id: clientId, type: "ack", result: { ready: true } });
        break;
      }

      case "loadModel": {
        const { modelSrc, modelType = "llm", modelConfig = {} } = params;
        if (!modelSrc) throw new Error("modelSrc is required");

        const opts = {
          modelSrc,
          modelType,
          modelConfig: {
            ctx_size: 4096,
            ...modelConfig,
          },
        };

        // Always wire onProgress so downloads (first-time registry models) report back.
        // Progress is forwarded as NDJSON "progress" messages before the final ack.
        opts.onProgress = (progress) => {
          send({ id: clientId, type: "progress", progress });
        };

        const modelId = await loadModel(opts);
        send({ id: clientId, type: "ack", result: { modelId } });
        break;
      }

      case "unloadModel": {
        const { modelId } = params;
        if (modelId) {
          await unloadModel({ modelId });
        }
        send({ id: clientId, type: "ack", result: { ok: true } });
        break;
      }

      case "complete": {
        const {
          modelId,
          history,
          temperature = 0.2,
          maxTokens = 1024,
          topP = 0.95,
          captureThinking = true,
        } = params;

        if (!modelId) throw new Error("modelId is required for complete");
        if (!Array.isArray(history)) throw new Error("history must be an array");

        const run = completion({
          modelId,
          history,
          stream: true,
          generationParams: {
            temp: temperature,
            top_p: topP,
            predict: maxTokens,
          },
          captureThinking,
        });

        const sdkRequestId = run.requestId || `sdk-${Date.now()}`;
        activeStreams.set(sdkRequestId, clientId);
        clientRuns.set(clientId, run);

        // Send initial ack with the sdk request id so client can cancel
        send({ id: clientId, type: "ack", result: { requestId: sdkRequestId } });

        // Stream events
        (async () => {
          try {
            for await (const event of run.events) {
              const ev = event;
              // Forward relevant events as "event"
              if (
                ev.type === "contentDelta" ||
                ev.type === "rawDelta" ||
                ev.type === "thinkingDelta" ||
                ev.type === "reasoningDelta" ||
                ev.type === "completionDone"
              ) {
                send({ id: clientId, type: "event", event: ev });
              }
            }

            const final = await run.final;
            send({
              id: clientId,
              type: "final",
              result: {
                text: final?.text || final?.content || "",
                thinking: final?.thinking,
                stats: final?.stats,
              },
            });
          } catch (err) {
            sendError(clientId, err?.message || String(err), { during: "stream" });
          } finally {
            activeStreams.delete(sdkRequestId);
            clientRuns.delete(clientId);
          }
        })();

        break;
      }

      case "cancel": {
        const { requestId } = params;
        if (requestId) {
          try {
            await cancel({ requestId });
          } catch (e) {
            // best effort
          }
          // Also cleanup local maps if we have clientId
          for (const [sdkId, cId] of activeStreams.entries()) {
            if (sdkId === requestId) {
              activeStreams.delete(sdkId);
              clientRuns.delete(cId);
            }
          }
        }
        send({ id: clientId, type: "ack", result: { cancelled: true } });
        break;
      }

      case "embed": {
        const { modelId, text } = params;
        if (!modelId) throw new Error("modelId required for embed");
        const res = await embed({ modelId, text });
        send({
          id: clientId,
          type: "ack",
          result: { embedding: res.embedding || res.embeddings },
        });
        break;
      }

      case "ragRebuild": {
        const { folderPath, workspace = "cortex-kb", embedModelId = "EMBEDDINGGEMMA_300M_Q4_0" } = params;
        if (!folderPath) throw new Error("folderPath is required");
        const docs = collectTextFiles(folderPath);
        if (!docs.length) {
          send({ id: clientId, type: "ack", result: { docCount: 0, chunkCount: 0 } });
          break;
        }
        const embedModel = await loadModel({ modelSrc: embedModelId, modelType: "embeddings" });
        const ingestResult = await ragIngest({
          modelId: embedModel,
          documents: docs.map((d) => d.content),
          workspace,
        });
        const docCount = docs.length;
        const chunkCount = (ingestResult && ingestResult.processed) ? ingestResult.processed.length : Math.floor(docCount * 1.5);
        send({ id: clientId, type: "ack", result: { docCount, chunkCount, workspace } });
        break;
      }

      case "ragSearch": {
        const { query, workspace = "cortex-kb", embedModelId = "EMBEDDINGGEMMA_300M_Q4_0", topK = 5 } = params;
        if (!query) throw new Error("query is required");
        const embedModel = await loadModel({ modelSrc: embedModelId, modelType: "embeddings" });
        const results = await ragSearch({ modelId: embedModel, query, workspace, topK });
        send({ id: clientId, type: "ack", result: { results: results || [] } });
        break;
      }

      default:
        throw new Error(`Unknown cmd: ${cmd}`);
    }
  } catch (err) {
    sendError(clientId, err?.message || String(err));
  }
}

function collectTextFiles(dir, exts = [".md", ".txt", ".markdown"]) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(collectTextFiles(fullPath, exts));
      } else if (exts.some((ext) => file.toLowerCase().endsWith(ext))) {
        const content = fs.readFileSync(fullPath, "utf8");
        results.push({ content: content.trim(), source: fullPath });
      }
    }
  } catch (e) {
    console.error("[qvac-host] collectTextFiles error for", dir, e);
  }
  return results;
}

// Main loop: read NDJSON lines from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch (e) {
    console.error("[qvac-host] Bad JSON line:", trimmed);
    return;
  }

  const { id, cmd, params } = msg || {};
  if (!id || !cmd) {
    console.error("[qvac-host] Missing id or cmd");
    return;
  }

  handleCommand(id, cmd, params || {}).catch((e) => {
    sendError(id, e?.message || String(e));
  });
});

rl.on("close", async () => {
  console.error("[qvac-host] stdin closed, shutting down...");
  try {
    if (providerReady) {
      await stopQVACProvider();
    }
  } catch (e) {
    console.error("[qvac-host] stop error", e);
  }
  process.exit(0);
});

// Heartbeat / ready signal on stderr (visible in tauri logs)
console.error("[qvac-host] QVAC host process started. Waiting for commands on stdin...");

// Graceful shutdown on signals
process.on("SIGINT", async () => {
  console.error("[qvac-host] SIGINT received");
  try {
    if (providerReady) await stopQVACProvider();
  } finally {
    process.exit(0);
  }
});

process.on("SIGTERM", async () => {
  console.error("[qvac-host] SIGTERM received");
  try {
    if (providerReady) await stopQVACProvider();
  } finally {
    process.exit(0);
  }
});
