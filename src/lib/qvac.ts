/**
 * QVAC SDK Wrapper for Thoth
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

export type QVACModelType = "llm" | "embeddings";

export interface QVACLoadOptions {
  modelSrc: string; // local path, url, or registry id like LLAMA_...
  modelType?: QVACModelType;
  modelConfig?: Record<string, any>;
  onProgress?: (progress: { percentage: number; bytesLoaded?: number; bytesTotal?: number }) => void;
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
    throw new Error("Could not start local QVAC engine. Check that Node is available and the host script exists.");
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
 * Load a model (LLM or embeddings). Returns the modelId to use for completions/embed.
 * `modelSrc` can be a registry constant (e.g. BITNET_1B_INST_TQ2_0), local path, or URL.
 */
export async function loadLocalModel(options: QVACLoadOptions): Promise<string> {
  const { modelSrc, modelType = "llm", modelConfig = {}, onProgress } = options;

  const modelId = await bridgeLoadModel(
    {
      modelSrc,
      modelType,
      modelConfig: {
        ctx_size: 8192,
        ...modelConfig,
      },
    },
    onProgress
  );

  loadedModels.set(modelSrc, modelId);
  console.log(`[QVAC] Loaded model ${modelSrc} -> ${modelId}`);
  return modelId;
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
export async function rebuildKnowledgeBase(folderPath: string, embedModelId = "EMBEDDINGGEMMA_300M_Q4_0") {
  const { bridgeRagRebuild } = await import("./qvac-bridge");
  return bridgeRagRebuild({ folderPath, embedModelId });
}

export async function searchKnowledgeBase(query: string, workspace = "thoth-cs-kb", embedModelId = "EMBEDDINGGEMMA_300M_Q4_0", topK = 5) {
  const { bridgeRagSearch } = await import("./qvac-bridge");
  return bridgeRagSearch({ query, workspace, embedModelId, topK });
}

export const rag = {
  rebuild: rebuildKnowledgeBase,
  search: searchKnowledgeBase,
};

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
