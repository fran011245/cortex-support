/**
 * QVAC SDK Wrapper for Cortex
 * Robust public API for local LLM + embeddings + RAG using @qvac/sdk.
 *
 * All heavy lifting happens in a Node child process (src-tauri/qvac-host.cjs)
 * spawned via Tauri shell plugin. This is required because the SDK uses
 * Node/Bare native capabilities that cannot run inside the Tauri webview.
 *
 * The rest of the app only talks to this thin, well-typed wrapper.
 */

import {
  bridgeStartProvider,
  bridgeLoadModel,
  bridgeComplete,
  bridgeCancel,
  bridgeEmbed,
  type HostFinal,
} from "./qvac-bridge";
import { DEFAULT_EMBED_MODEL } from "./settings";

export type QVACModelType = "llm" | "embeddings" | "llamacpp-completion";

export interface ModelDownloadProgress {
  percentage: number;
  bytesLoaded?: number;
  bytesTotal?: number;
  // speedMBps can be computed client-side
}

export interface QVACLoadOptions {
  modelSrc: string; // local path, url, or registry id like LLAMA_3_2_1B_INST_Q4_0 (use exact SDK constants)
  modelType?: QVACModelType;
  modelConfig?: Record<string, any>;
  onProgress?: (progress: ModelDownloadProgress) => void;
  /** AbortSignal to cancel an in-progress download */
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface StreamCompletionOptions {
  modelId: string;
  history: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  signal?: AbortSignal;
}

export interface QVACCompletionResult {
  text: string;
  thinking?: string;
  stats?: any;
  raw?: any;
}

// Internal state (module scope)
let providerStarted = false;
const loadedModels = new Map<string, string>(); // alias/src -> modelId

/**
 * Initialize the QVAC provider via the host bridge.
 * Safe to call multiple times.
 */
export async function initQVAC(): Promise<void> {
  if (providerStarted) return;
  try {
    await bridgeStartProvider();
    providerStarted = true;
    console.log("[QVAC] Provider started via host bridge");
  } catch (err) {
    console.error("[QVAC] Failed to start provider via bridge:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not start local QVAC engine. ${msg}. Make sure Node.js is installed and the shell permissions (allow-spawn, allow-stdin-write, etc.) are granted in capabilities/default.json.`);
  }
}

export async function shutdownQVAC(): Promise<void> {
  if (!providerStarted) return;
  // The host process manages its own lifetime; we can ask it to stop if we add a command later.
  providerStarted = false;
  loadedModels.clear();
  console.log("[QVAC] Provider shutdown requested (host manages process)");
}

/**
 * Load a model (LLM or embeddings). Returns the *runtime handle* (short hash) to use for completions/embed/rag.
 * `modelSrc` can be a registry constant (e.g. LLAMA_3_2_1B_INST_Q4_0), local path, or URL.
 * Always pass exact registry constants for first-time loads (see DEBUG_MODEL_LOADING.md).
 */
export async function loadLocalModel(options: QVACLoadOptions): Promise<string> {
  const { modelSrc, modelType = "llamacpp-completion", modelConfig = {}, onProgress, signal } = options;

  const attemptLoad = async () => {
    const modelId = await bridgeLoadModel(
      {
        modelSrc,
        modelType,
        modelConfig: {
          ctx_size: 4096,
          ...modelConfig,
        },
      },
      onProgress,
      signal
    );
    loadedModels.set(modelSrc, modelId);
    console.log(`[QVAC] Loaded model ${modelSrc} -> ${modelId}`);
    return modelId;
  };

  // Listen to external abort for early exit + cleanup
  if (signal) {
    if (signal.aborted) {
      await (async () => {
        try {
          const { bridgeClearCache } = await import("./qvac-bridge");
          await bridgeClearCache(typeof modelSrc === "string" ? modelSrc : undefined);
        } catch {}
      })();
      throw new DOMException("Aborted", "AbortError");
    }
    const onAbort = async () => {
      try {
        const { bridgeClearCache } = await import("./qvac-bridge");
        await bridgeClearCache(typeof modelSrc === "string" ? modelSrc : undefined);
      } catch {}
    };
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await attemptLoad();
  } catch (err: any) {
    const msg = (err?.message || String(err)).toLowerCase();
    const isLockError = msg.includes("lock") || msg.includes("descriptor");

    if (isLockError) {
      console.warn("[QVAC] Load lock error, clearing cache for", modelSrc, "and retrying once...");
      try {
        const { bridgeClearCache } = await import("./qvac-bridge");
        await bridgeClearCache(typeof modelSrc === "string" ? modelSrc : undefined);
      } catch (clearErr) {
        console.warn("[QVAC] clear cache failed", clearErr);
      }

      // retry once after clear
      try {
        return await attemptLoad();
      } catch (retryErr: any) {
        console.error("[QVAC] Retry after clear also failed", retryErr);
        throw retryErr;
      }
    }

    throw err;
  }
}

/**
 * Returns the runtime handle for an already-loaded model src, or undefined.
 * Unlike the store's currentModelId (which resets on settings reload), this
 * reflects what was actually loaded into the worker this session — so callers
 * can skip a redundant "Loading model…" step when the model is already up.
 */
export function getLoadedModelId(src?: string): string | undefined {
  if (!src) return undefined;
  return loadedModels.get(src);
}

export async function unloadLocalModel(modelIdOrSrc: string): Promise<void> {
  const modelId = loadedModels.get(modelIdOrSrc) || modelIdOrSrc;
  try {
    // We don't have an explicit unload bridge command yet — host will GC on process exit or we can extend.
    // For now just forget the id locally.
    loadedModels.delete(modelIdOrSrc);
    console.log(`[QVAC] Unloaded (local tracking cleared) ${modelId}`);
  } catch (e) {
    console.warn("[QVAC] unload warning:", e);
  }
}

/**
 * Stream a completion. The primary way to get tokens in real time.
 */
export async function streamCompletion(opts: StreamCompletionOptions): Promise<QVACCompletionResult> {
  const { modelId, history, temperature = 0.2, maxTokens = 1024, topP = 0.95, onToken, onThinking, signal } = opts;

  const final: HostFinal = await bridgeComplete({
    modelId,
    history: history as any,
    temperature,
    maxTokens,
    topP,
    onToken,
    onThinking,
    signal,
  });

  return {
    text: final.text || "",
    thinking: final.thinking,
    stats: final.stats,
    raw: final,
  };
}

/**
 * One-shot (non-streaming) convenience wrapper.
 */
export async function complete(opts: Omit<StreamCompletionOptions, "onToken" | "onThinking">): Promise<string> {
  const res = await streamCompletion({ ...opts, onToken: undefined, onThinking: undefined });
  return res.text;
}

/**
 * Embeddings via the bridge.
 */
export async function generateEmbeddings(texts: string[], modelId: string): Promise<number[][]> {
  if (!modelId) throw new Error("generateEmbeddings requires an embeddings modelId");
  const emb = await bridgeEmbed({ modelId, text: texts });
  return Array.isArray(emb) && Array.isArray(emb[0]) ? (emb as number[][]) : [emb as number[]];
}

/** RAG surface (Phase 5) */
export async function rebuildKnowledgeBase(folderPath: string, embedModelId = DEFAULT_EMBED_MODEL) {
  const { bridgeRagRebuild } = await import("./qvac-bridge");
  return bridgeRagRebuild({ folderPath, embedModelId });
}

export async function searchKnowledgeBase(query: string, workspace = "cortex-kb", embedModelId = DEFAULT_EMBED_MODEL, topK = 5) {
  const { bridgeRagSearch } = await import("./qvac-bridge");
  return bridgeRagSearch({ query, workspace, embedModelId, topK });
}

export const rag = {
  rebuild: rebuildKnowledgeBase,
  search: searchKnowledgeBase,
};

export async function listCachedModels(): Promise<{ modelsDir: string; files: string[] }> {
  const { bridgeListModels } = await import("./qvac-bridge");
  return bridgeListModels();
}

export async function clearModelCache(src?: string): Promise<void> {
  const { bridgeClearCache } = await import("./qvac-bridge");
  await bridgeClearCache(src);
}

export async function getAvailableModels(): Promise<any[]> {
  return []; // Catalog UI can be added later
}

export async function getCurrentlyLoaded(): Promise<any> {
  return null;
}

/** Abort a running completion by its SDK requestId (returned in the ack of bridgeComplete) */
export async function cancelRequest(requestId: string): Promise<void> {
  await bridgeCancel(requestId);
}
