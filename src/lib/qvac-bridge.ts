/**
 * QVAC Bridge for Cortex (Tauri + Node child process)
 *
 * Spawns a persistent Node.js child (`qvac-host.cjs`) that runs the real @qvac/sdk.
 * Communication: newline-delimited JSON over stdin/stdout (via @tauri-apps/plugin-shell).
 *
 * This solves the fundamental mismatch: @qvac/sdk requires a real Node/Bare runtime
 * and cannot be bundled into the Tauri webview.
 */

import { Command, type Child } from "@tauri-apps/plugin-shell";
import { invoke } from "@tauri-apps/api/core";
import { resolveResource } from "@tauri-apps/api/path";

export interface HostAck {
  modelId?: string;
  ready?: boolean;
  requestId?: string;
  [key: string]: any;
}

export interface HostEvent {
  type: string;
  delta?: string;
  text?: string;
  [key: string]: any;
}

export interface HostFinal {
  text: string;
  thinking?: string;
  stats?: any;
}

type Pending = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  onEvent?: (event: HostEvent) => void;
  onFinal?: (final: HostFinal) => void;
};

let child: Child | null = null;
let connected = false;
const pending = new Map<string, Pending>();
const progressListeners = new Map<string, (progress: any) => void>();
let seq = 0;

function nextId(): string {
  return `req-${Date.now()}-${seq++}`;
}

async function getHostScriptPath(): Promise<string> {
  // 1. Try Rust command (gives correct dev path using CARGO_MANIFEST_DIR)
  try {
    const p = await invoke<string>("resolve_qvac_host_path");
    if (p && !p.endsWith("qvac-host.cjs")) {
      // prod sentinel case — fall through to resolveResource
    } else if (p) {
      // In dev this is absolute path to the .cjs
      return p;
    }
  } catch (e) {
    console.warn("[qvac-bridge] resolve_qvac_host_path invoke failed, falling back", e);
  }

  // 2. Fallback: resolveResource (works after tauri build when bundled)
  try {
    return await resolveResource("qvac-host.cjs");
  } catch (e) {
    console.warn("[qvac-bridge] resolveResource failed", e);
  }

  // 3. Last resort dev fallback (assumes running from project root in tauri dev)
  return "./src-tauri/qvac-host.cjs";
}

async function ensureChild(): Promise<Child> {
  if (child && connected) return child;

  const scriptPath = await getHostScriptPath();
  console.log("[qvac-bridge] Spawning QVAC host:", scriptPath);

  // Use 'node' from PATH. On macOS in tauri dev this usually works.
  const cmd = Command.create("node", [scriptPath]);

  // IMPORTANT: stdout/stderr listeners go on the *Command* (before spawn), per the plugin API.
  cmd.stdout.on("data", (data: string | Uint8Array) => {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    const lines = text.split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        routeMessage(msg);
      } catch (e) {
        console.warn("[qvac-bridge] Non-JSON from host stdout:", line);
      }
    }
  });

  cmd.stderr.on("data", (data: string | Uint8Array) => {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    console.error("[qvac-host stderr]", text.trim());
  });

  cmd.on("close", () => {
    console.warn("[qvac-bridge] Host child process exited");
    connected = false;
    child = null;
    for (const [id, p] of pending) {
      p.reject(new Error("QVAC host process exited"));
      pending.delete(id);
    }
  });

  child = await cmd.spawn();

  connected = true;

  // Give it a moment then ping
  await new Promise((r) => setTimeout(r, 80));
  return child;
}

function routeMessage(msg: any) {
  const { id, type, result, event, error, progress } = msg || {};
  if (!id) return;

  // Side-channel progress for loads (and potentially others). Call listener if registered.
  if (type === "progress") {
    const fn = progressListeners.get(id);
    if (fn) fn(progress || msg);
    return; // progress is not terminal
  }

  const pend = pending.get(id);
  if (!pend) {
    // Could be an unsolicited event or late message
    if (type === "event" && event) {
      // In future we could have global listeners, for now ignore
    }
    return;
  }

  if (type === "ack") {
    pend.resolve(result);
    // For streaming commands the ack may contain the sdk requestId; we keep the pending open for events/final
    if (!result?.requestId) {
      // Non-streaming command — done
      pending.delete(id);
    }
  } else if (type === "event" && event && pend.onEvent) {
    pend.onEvent(event);
  } else if (type === "final" && result) {
    if (pend.onFinal) pend.onFinal(result as HostFinal);
    pend.resolve(result);
    pending.delete(id);
  } else if (type === "error") {
    pend.reject(new Error(error || "Unknown host error"));
    pending.delete(id);
  }
}

async function sendCommand(cmd: string, params?: any): Promise<any> {
  const id = nextId();
  const c = await ensureChild();

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });

    const payload = JSON.stringify({ id, cmd, params: params || {} });
    // Write to child's stdin
    c.write(payload + "\n").catch((e) => {
      pending.delete(id);
      reject(e);
    });

    // Timeout safety (generous for model loading / first download)
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`QVAC host command "${cmd}" timed out`));
      }
    }, 120_000);
  });
}

export async function bridgeStartProvider(): Promise<void> {
  await sendCommand("startProvider");
}

export async function bridgeLoadModel(
  params: {
    modelSrc: string;
    modelType?: string;
    modelConfig?: Record<string, any>;
  },
  onProgress?: (progress: any) => void
): Promise<string> {
  const id = nextId();
  const c = await ensureChild();

  if (onProgress) {
    // Register side-channel listener for progress msgs before the final ack.
    // (Similar to how complete uses onToken during its event stream.)
    progressListeners.set(id, onProgress);
  }

  return new Promise((resolve, reject) => {
    pending.set(id, {
      resolve: (result) => {
        progressListeners.delete(id);
        resolve(result?.modelId || result);
      },
      reject: (err) => {
        progressListeners.delete(id);
        reject(err);
      },
    });

    const payload = JSON.stringify({ id, cmd: "loadModel", params });
    c.write(payload + "\n").catch((e) => {
      pending.delete(id);
      progressListeners.delete(id);
      reject(e);
    });

    // Generous timeout for first-time downloads of registry models.
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        progressListeners.delete(id);
        reject(new Error(`QVAC host loadModel for ${params.modelSrc} timed out`));
      }
    }, 300_000);
  });
}

export async function bridgeComplete(params: {
  modelId: string;
  history: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  onToken?: (delta: string) => void;
  onThinking?: (delta: string) => void;
  signal?: AbortSignal;
}): Promise<HostFinal> {
  const { onToken, onThinking, signal, ...rest } = params;

  const id = nextId();
  const c = await ensureChild();

  return new Promise((resolve, reject) => {
    const pend: Pending = {
      resolve,
      reject,
      onEvent: (ev) => {
        if (ev.type === "contentDelta" || ev.type === "rawDelta") {
          const d = ev.delta || ev.text || ev.content || "";
          if (d) onToken?.(d);
        }
        if ((ev.type === "thinkingDelta" || ev.type === "reasoningDelta") && onThinking) {
          onThinking(ev.delta || "");
        }
      },
      onFinal: (final) => {
        resolve(final);
      },
    };
    pending.set(id, pend);

    const payload = JSON.stringify({ id, cmd: "complete", params: rest });
    c.write(payload + "\n").catch(reject);

    // Handle abort
    const onAbort = () => {
      if (pending.has(id)) {
        pending.delete(id);
        // Best effort cancel — we don't have the sdk requestId here yet.
        // The ack will give us the requestId; in practice the user can call bridgeCancel after seeing the ack.
        sendCommand("cancel", { requestId: "unknown" }).catch(() => {});
        reject(new DOMException("Aborted", "AbortError"));
      }
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("Completion timed out"));
      }
    }, 300_000);
  });
}

export async function bridgeCancel(requestId: string): Promise<void> {
  try {
    await sendCommand("cancel", { requestId });
  } catch (e) {
    // best effort
  }
}

export async function bridgeEmbed(params: { modelId: string; text: string | string[] }): Promise<number[] | number[][]> {
  const res = await sendCommand("embed", params);
  return res?.embedding;
}

export async function bridgeRagRebuild(params: { folderPath: string; workspace?: string; embedModelId?: string }): Promise<{ docCount: number; chunkCount: number }> {
  return sendCommand("ragRebuild", params);
}

export async function bridgeRagSearch(params: { query: string; workspace?: string; embedModelId?: string; topK?: number }): Promise<any[]> {
  const res = await sendCommand("ragSearch", params);
  return res?.results || [];
}

export async function bridgeListModels(): Promise<{ modelsDir: string; files: string[] }> {
  return sendCommand("listModels");
}

// Cleanup on window unload (dev convenience)
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (child) {
      child.kill().catch(() => {});
    }
  });
}
