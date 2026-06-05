/**
 * Thoth CS Settings
 * Persisted locally via Tauri Store plugin.
 * Full control over agent behavior, tone, models, RAG paths, etc.
 */

import { Store } from "@tauri-apps/plugin-store";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TONE_RULES, type ToneRules } from "./prompts";

export interface CSSettings {
  // 1. Agent core
  systemPrompt: string;

  // 2. Grammar & Tone Rules
  toneRules: ToneRules;

  // 3. Response Style Presets (active selection)
  activeStylePreset: ToneRules["style"];

  // 4. General Usage
  defaultModelId: string; // user friendly id or path alias
  temperature: number; // 0.0 - 1.0
  maxTokens: number;
  ragEnabled: boolean;
  ragFolderPath: string; // local directory for knowledge base PDFs/MD
  autoApplyGrammarCheck: boolean;
  showConfidenceAndSources: boolean;

  // Extra instructions appended to system prompt (powerful customization)
  extraInstructions?: string;

  // 5. Knowledge Base
  knowledgeBaseLastIndexed?: string; // ISO date
  knowledgeBaseDocCount?: number;
}

/**
 * Recommended lightweight LLM models from QVAC registry.
 * Chosen for the support agent task (following detailed tone system prompt,
 * generating clear/concise/security-aware replies, using RAG context).
 * All small quantized instruction-tuned models; fast to download/start on Apple Silicon.
 * User can override in Settings with any registry id, local GGUF path, or supported URL.
 */
export const RECOMMENDED_LLM_MODELS = [
  { id: "LLAMA_3_2_1B_INST_Q4_0", label: "Llama 3.2 1B Instruct (Q4_0, ultra-light ~0.5-1GB, fast)" },
  { id: "QWEN3_1_7B_INST_Q4", label: "Qwen3 1.7B Instruct (Q4, excellent instruction following)" },
  { id: "QWEN3_4B_INST_Q4_K_M", label: "Qwen3 4B Instruct (Q4_K_M, strong quality still lightweight)" },
] as const;

export const DEFAULT_LLM_MODEL = RECOMMENDED_LLM_MODELS[0].id; // Primary: Llama 3.2 1B
export const DEFAULT_EMBED_MODEL = "EMBEDDINGGEMMA_300M_Q4_0";

export const DEFAULT_SETTINGS: CSSettings = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  toneRules: { ...DEFAULT_TONE_RULES },
  activeStylePreset: "Professional",
  defaultModelId: DEFAULT_LLM_MODEL,
  temperature: 0.2,
  maxTokens: 1024,
  ragEnabled: true,
  ragFolderPath: "",
  autoApplyGrammarCheck: true,
  showConfidenceAndSources: true,
  extraInstructions: "",
  knowledgeBaseLastIndexed: undefined,
  knowledgeBaseDocCount: 0,
};

let store: Store | null = null;
const STORE_FILENAME = "thoth-settings.json";

async function getStore(): Promise<Store> {
  if (!store) {
    // Save in app config dir. Defaults required by current plugin API.
    store = await Store.load(STORE_FILENAME, {
      defaults: {},
      autoSave: true,
    });
  }
  return store;
}

/**
 * Load all settings. Falls back to defaults + merges any saved partial.
 */
export async function loadSettings(): Promise<CSSettings> {
  const s = await getStore();
  const saved = (await s.get<Partial<CSSettings>>("settings")) || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    toneRules: { ...DEFAULT_SETTINGS.toneRules, ...(saved.toneRules || {}) },
  };
}

/**
 * Save the full settings object (overwrites).
 */
export async function saveSettings(settings: CSSettings): Promise<void> {
  const s = await getStore();
  await s.set("settings", settings);
  await s.save();
}

/**
 * Update a partial set of settings (deep merge for toneRules).
 */
export async function updateSettings(partial: Partial<CSSettings>): Promise<CSSettings> {
  const current = await loadSettings();
  const next: CSSettings = {
    ...current,
    ...partial,
    toneRules: {
      ...current.toneRules,
      ...(partial.toneRules || {}),
    },
  };
  await saveSettings(next);
  return next;
}

/**
 * Reset everything to factory defaults.
 */
export async function resetSettings(): Promise<CSSettings> {
  const s = await getStore();
  await s.set("settings", DEFAULT_SETTINGS);
  await s.save();
  return { ...DEFAULT_SETTINGS };
}

/**
 * Helper: get effective system prompt given current settings + optional extra instructions.
 */
export async function getEffectiveSystemPrompt(extraInstructions?: string): Promise<string> {
  const settings = await loadSettings();
  // Rebuild using prompts.ts logic (imported dynamically to avoid cycles if needed)
  const { buildSystemPrompt } = await import("./prompts");
  return buildSystemPrompt(
    settings.systemPrompt,
    settings.toneRules,
    extraInstructions ?? settings.extraInstructions,
  );
}

/**
 * Convenience: update just the agent prompt.
 */
export async function setSystemPrompt(prompt: string): Promise<void> {
  await updateSettings({ systemPrompt: prompt });
}

/**
 * Update RAG knowledge base metadata after re-index.
 */
export async function updateKnowledgeBaseMeta(docCount: number): Promise<void> {
  await updateSettings({
    knowledgeBaseLastIndexed: new Date().toISOString(),
    knowledgeBaseDocCount: docCount,
  });
}
