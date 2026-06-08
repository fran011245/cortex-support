/**
 * Cortex — Custom Response Templates
 * User-defined reusable scenario bases for the Response Templates tool.
 *
 * Persisted via the same @tauri-apps/plugin-store mechanism as settings
 * and chat sessions ("cortex-templates.json").
 *
 * These are *not* stored in the zustand agent store because they are
 * tool-specific configuration (like tone rules or the agent prompt),
 * not session/chat data.
 */

import { Store } from "@tauri-apps/plugin-store";
import type { QuickTemplateKey } from "./prompts";

export interface CustomResponseTemplate {
  id: string;
  name: string;
  description?: string;
  /** The base scenario text that gets injected into the LLM prompt exactly like QUICK_TEMPLATES values. */
  baseContent: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface TemplateData {
  customs: CustomResponseTemplate[];
  /** Keys of built-in templates that the user has hidden/removed from their view */
  hiddenBuiltins: QuickTemplateKey[];
}

let store: Store | null = null;
const STORE_FILENAME = "cortex-templates.json";
const DATA_KEY = "data";
const LEGACY_TEMPLATES_KEY = "templates"; // for migration from previous versions

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(STORE_FILENAME, {
      defaults: {},
      autoSave: true,
    });
  }
  return store;
}

async function loadData(): Promise<TemplateData> {
  const s = await getStore();

  // New shape
  const data = await s.get<TemplateData>(DATA_KEY);
  if (data && typeof data === "object") {
    return {
      customs: Array.isArray(data.customs) ? data.customs : [],
      hiddenBuiltins: Array.isArray(data.hiddenBuiltins) ? data.hiddenBuiltins : [],
    };
  }

  // Migration from old versions (only customs array was stored under "templates")
  const legacy = await s.get<CustomResponseTemplate[]>(LEGACY_TEMPLATES_KEY);
  if (Array.isArray(legacy)) {
    const migrated: TemplateData = {
      customs: legacy,
      hiddenBuiltins: [],
    };
    await s.set(DATA_KEY, migrated);
    await s.delete(LEGACY_TEMPLATES_KEY);
    await s.save();
    return migrated;
  }

  return { customs: [], hiddenBuiltins: [] };
}

async function saveData(data: TemplateData): Promise<void> {
  const s = await getStore();
  await s.set(DATA_KEY, data);
  await s.save();
}

/**
 * Load all custom templates (returns [] if none saved yet).
 */
export async function loadCustomTemplates(): Promise<CustomResponseTemplate[]> {
  const data = await loadData();
  return data.customs;
}

/**
 * Persist the full list of customs (overwrites only the customs part).
 */
export async function saveCustomTemplates(list: CustomResponseTemplate[]): Promise<void> {
  const current = await loadData();
  await saveData({ ...current, customs: list });
}

/**
 * Create + persist a new custom template.
 * Generates id and timestamps.
 */
export async function addCustomTemplate(input: {
  name: string;
  description?: string;
  baseContent: string;
}): Promise<CustomResponseTemplate> {
  const now = new Date().toISOString();
  const newTpl: CustomResponseTemplate = {
    id: `ctpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    baseContent: input.baseContent.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const current = await loadCustomTemplates();
  const next = [newTpl, ...current]; // newest first for convenience
  await saveCustomTemplates(next);
  return newTpl;
}

/**
 * Update an existing template (by id) and persist.
 * Only allowed fields are patched; id/createdAt are immutable.
 * Returns the updated template or null if not found.
 */
export async function updateCustomTemplate(
  id: string,
  patch: Partial<Pick<CustomResponseTemplate, "name" | "description" | "baseContent">>,
): Promise<CustomResponseTemplate | null> {
  const current = await loadCustomTemplates();
  const idx = current.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const updated: CustomResponseTemplate = {
    ...current[idx],
    ...patch,
    name: patch.name !== undefined ? patch.name.trim() : current[idx].name,
    description: patch.description !== undefined ? (patch.description.trim() || undefined) : current[idx].description,
    baseContent: patch.baseContent !== undefined ? patch.baseContent.trim() : current[idx].baseContent,
    updatedAt: now,
  };

  const next = [...current];
  next[idx] = updated;
  await saveCustomTemplates(next);
  return updated;
}

/**
 * Delete by id and persist. Returns true if something was removed.
 */
export async function deleteCustomTemplate(id: string): Promise<boolean> {
  const current = await loadCustomTemplates();
  const next = current.filter((t) => t.id !== id);
  if (next.length === current.length) return false;
  await saveCustomTemplates(next);
  return true;
}

/**
 * Convenience: get one by id (after load or for small lists).
 */
export async function getCustomTemplate(id: string): Promise<CustomResponseTemplate | undefined> {
  const list = await loadCustomTemplates();
  return list.find((t) => t.id === id);
}

// ------------------------------------------------------------------
// Hidden / removed built-in templates (so user can "delete" hardcoded ones from their view)
// ------------------------------------------------------------------

export async function loadHiddenBuiltins(): Promise<QuickTemplateKey[]> {
  const data = await loadData();
  return data.hiddenBuiltins;
}

export async function hideBuiltin(key: QuickTemplateKey): Promise<void> {
  const data = await loadData();
  if (data.hiddenBuiltins.includes(key)) return;
  const next: TemplateData = {
    ...data,
    hiddenBuiltins: [...data.hiddenBuiltins, key],
  };
  await saveData(next);
}

export async function restoreBuiltin(key: QuickTemplateKey): Promise<void> {
  const data = await loadData();
  const next: TemplateData = {
    ...data,
    hiddenBuiltins: data.hiddenBuiltins.filter((k) => k !== key),
  };
  await saveData(next);
}

export async function isBuiltinHidden(key: QuickTemplateKey): Promise<boolean> {
  const hidden = await loadHiddenBuiltins();
  return hidden.includes(key);
}
