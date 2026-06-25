import { useState } from "react";
import { useAgentStore } from "@/stores/useAgentStore";
import { DEFAULT_LLM_MODEL } from "@/lib/settings";
import { getLoadedModelId, loadLocalModel } from "@/lib/qvac";

/**
 * Shared model-load logic for the local tools (Grammar, Translate, Templates).
 *
 * `currentModelId` in the store resets on settings reload, so we fall back to the
 * qvac layer's real load registry (getLoadedModelId) before deciding to load —
 * that way we never show "Loading model…" when the model is already up. Only an
 * actual load drives the status text through "Loading model… X%".
 *
 * @param generatingLabel the status shown once a model is ready and generation runs
 *                        (e.g. "Translating…"). Also the resting/default status.
 */
export function useToolModel(generatingLabel: string) {
  const currentModelId = useAgentStore((s) => s.currentModelId);
  const settings = useAgentStore((s) => s.settings);
  const setModelId = useAgentStore((s) => s.setModelId);
  const [statusText, setStatusText] = useState(generatingLabel);

  /**
   * Returns a usable model handle, loading the default model first if none is
   * loaded this session. Drives `statusText` so a <ToolLoadingPanel> can reflect
   * progress. No-op (instant) when a model is already loaded.
   */
  const ensureModelLoaded = async (): Promise<string> => {
    setStatusText(generatingLabel);
    const src = settings?.defaultModelId || DEFAULT_LLM_MODEL;
    let modelId = currentModelId || getLoadedModelId(src);
    if (!modelId) {
      setStatusText("Loading model…");
      const handle = await loadLocalModel({
        modelSrc: src,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
        onProgress: (p) => {
          if (p?.percentage != null) setStatusText(`Loading model… ${Math.round(p.percentage)}%`);
        },
      });
      setModelId(handle);
      modelId = handle;
      setStatusText(generatingLabel);
    }
    return modelId;
  };

  return { statusText, setStatusText, ensureModelLoaded };
}
