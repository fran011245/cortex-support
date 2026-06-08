import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentStore } from "@/stores/useAgentStore";
import { DEFAULT_SYSTEM_PROMPT, TONE_PRESETS, type ToneRules, buildSystemPrompt, estimateTokens } from "@/lib/prompts";
import type { CSSettings } from "@/lib/settings";
import { loadLocalModel, listCachedModels } from "@/lib/qvac";
import { DEFAULT_LLM_MODEL, DEFAULT_EMBED_MODEL, RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { toast } from "sonner";
import { FolderOpen, RefreshCw, Info, Settings, Bot, Database, Check, Copy } from "lucide-react";
import { MODEL_GUIDE, GUIDE_COMMON_NOTES } from "@/lib/modelGuide";
import { RecommendedModels } from "@/components/RecommendedModels";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings, setModelId, setOnboardingOpen } = useAgentStore();
  const [local, setLocal] = useState(settings);
  const [isReindexing, setIsReindexing] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState<{ percentage?: number } | null>(null);
  const [cachedModels, setCachedModels] = useState<{ modelsDir?: string; files?: string[] } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [lastLoadedSpec, setLastLoadedSpec] = useState<string | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings, isSettingsOpen]);

  if (!local) return null;

  // Compute once per render — used by the prominent live preview (Fase 2) and anywhere else we show the composed result.
  const effectivePrompt = buildSystemPrompt(local.systemPrompt, local.toneRules, local.extraInstructions);

  // Live persist helper for safe, non-heavy fields (prompt, tone, sliders, toggles, etc.)
  // Persist happens immediately so chat reads (getEffectiveSystemPrompt + direct settings) see updates for next generation.
  const setAndPersist = (patch: any) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        ...patch,
        toneRules: { ...prev.toneRules, ...(patch.toneRules || {}) },
      } as CSSettings;
      // Fire-and-forget persist (store is fast; errors surface via toasts on explicit actions)
      updateSettings(patch).catch((e) => console.warn("[Settings] live persist failed", e));
      return next;
    });
  };

  const resetToDefaults = async () => {
    if (!confirm("Reset all CS settings to defaults?")) return;
    const fresh = {
      ...local,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      toneRules: { ...local.toneRules, ...TONE_PRESETS.Professional },
      activeStylePreset: "Professional" as const,
      temperature: 0.2,
      maxTokens: 1024,
      autoApplyGrammarCheck: true,
      showConfidenceAndSources: true,
      extraInstructions: "",
    };
    setLocal(fresh);
    await updateSettings(fresh);
    toast.info("Reset to factory defaults");
  };

  const updateTone = (patch: Partial<ToneRules>) => {
    setAndPersist({ toneRules: patch as any });
  };

  // Premium model loading with per-target progress + state tracking.
  // Sets both runtime handle and persists the spec as defaultModelId (live-apply safe).
  const loadModel = async (src: string) => {
    setLoadingTarget(src);
    setModelLoadProgress(null);
    try {
      const handle = await loadLocalModel({
        modelSrc: src,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
        onProgress: (p) => setModelLoadProgress(p),
      });
      setModelId(handle);
      await updateSettings({ defaultModelId: src });
      setLastLoadedSpec(src);
      setLocal((prev) => prev && ({ ...prev, defaultModelId: src }));
      toast.success("Model ready", { description: src });
    } catch (e: any) {
      toast.error("Load failed", { description: e?.message || "See console" });
    } finally {
      setLoadingTarget(null);
      setModelLoadProgress(null);
    }
  };

  const pickRagFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Knowledge Base Folder (PDFs, Markdown, TXT)",
    });
    if (typeof selected === "string") {
      setAndPersist({ ragFolderPath: selected });
    }
  };

  const revealRagFolder = async () => {
    if (!local?.ragFolderPath) return;
    try {
      await revealItemInDir(local.ragFolderPath);
    } catch (e: any) {
      toast.error("Could not reveal folder", { description: e?.message || "Check the path exists" });
    }
  };

  const triggerReindex = async () => {
    if (!local.ragFolderPath) {
      toast.error("Choose a folder first");
      return;
    }
    setIsReindexing(true);
    try {
      const { rebuildKnowledgeBase } = await import("@/lib/rag");
      const embedModel = DEFAULT_EMBED_MODEL; // dedicated small embed model; can extend settings for custom
      const stats = await rebuildKnowledgeBase(local.ragFolderPath, undefined, embedModel);
      const meta = {
        knowledgeBaseLastIndexed: new Date().toISOString(),
        knowledgeBaseDocCount: stats.docCount,
        ragFolderPath: local.ragFolderPath,
      };
      await updateSettings(meta);
      setLocal((prev) => prev && ({ ...prev, ...meta }));
      toast.success(`Knowledge base rebuilt — ${stats.docCount} documents, ~${stats.chunkCount} chunks`);
    } catch (e: any) {
      toast.error("Rebuild failed", { description: e?.message || "Check folder and embed model" });
    } finally {
      setIsReindexing(false);
    }
  };

  const exportSettings = async () => {
    if (!local) return;
    const data = JSON.stringify(local, null, 2);
    const filePath = await save({
      filters: [{ name: "JSON", extensions: ["json"] }],
      defaultPath: "cortex-settings.json",
    });
    if (filePath) {
      await writeTextFile(filePath, data);
      toast.success("Settings exported");
    }
  };

  const importSettings = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selected || typeof selected !== "string") return;
    try {
      const text = await readTextFile(selected);
      const imported = JSON.parse(text) as Partial<CSSettings>;
      if (!imported.systemPrompt) {
        throw new Error("Invalid settings file (missing systemPrompt)");
      }
      const merged = {
        ...local!,
        ...imported,
        toneRules: { ...local!.toneRules, ...(imported.toneRules || {}) },
      } as any;
      setLocal(merged);
      await updateSettings(merged);
      toast.success("Settings imported and applied");
    } catch (err: any) {
      toast.error("Import failed", { description: err?.message || "Invalid JSON" });
    }
  };

  const checkForAppUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateInfo(update);
        toast.info(`Update available: ${update.version}`, { description: (update as any).body || (update as any).notes || "New version ready to install" });
      } else {
        toast.success("You're on the latest version");
      }
    } catch (e: any) {
      console.error("[Cortex updater]", e);
      toast.error("Update check failed", { description: "Updater not fully configured yet (needs real pubkey + latest.json on GH releases). Use manual download from landing for now." });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!updateInfo) return;
    try {
      toast.info("Downloading & installing update...");
      await updateInfo.downloadAndInstall();
      toast.success("Update installed — restarting app");
      await relaunch();
    } catch (e: any) {
      toast.error("Install failed", { description: e?.message || "See console for details" });
    }
  };

  return (
    <>
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-background border-border text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border shrink-0">
          <DialogTitle className="text-xl tracking-[-0.3px]">CS Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Full control over agent personality, tone, models, and knowledge base. Changes apply instantly to new generations.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable tab area - header and footer stay fixed */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 mt-4 mb-2 w-fit bg-card border border-border shrink-0">
            <TabsTrigger value="general" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
            <TabsTrigger value="prompt" className="gap-1.5"><Bot className="h-3.5 w-3.5" /> Agent Prompt</TabsTrigger>
            <TabsTrigger value="tone" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Tone Rules</TabsTrigger>
            <TabsTrigger value="kb" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Knowledge Base</TabsTrigger>
          </TabsList>

          {/* Agent Prompt — now a first-class Prompt Composer (Fase 2) */}
          <TabsContent value="prompt" className="px-6 pt-4 pb-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* HERO: Live Effective Prompt — the star of the show. Prominent, calm, actionable. */}
            <div className="glass rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold tracking-[-0.2px] text-base flex items-center gap-2">
                      Live Effective Prompt
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="text-[11px] text-muted-foreground -mt-0.5">
                      Exactly what the model will receive on the next generation
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground shrink-0">
                  <span>≈ {estimateTokens(effectivePrompt)} tokens</span>
                  <span className="text-muted-foreground/40">•</span>
                  <span>{effectivePrompt.length} chars</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1.5 ml-1 border border-border hover:border-primary/40"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(effectivePrompt);
                        toast.success("Effective prompt copied");
                      } catch {
                        toast.error("Could not copy");
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </Button>
                </div>
              </div>

              <pre className="text-[12px] leading-relaxed font-mono bg-background/60 border border-border rounded-lg p-4 max-h-[260px] overflow-auto whitespace-pre-wrap text-foreground/90 ring-1 ring-inset ring-white/5">
{effectivePrompt}
              </pre>

              <div className="flex items-center justify-between text-[10px]">
                <div className="text-muted-foreground/70">
                  Includes your base prompt + active Tone Rules + Extra Instructions.
                  <span className="ml-1 text-emerald-400/80">+ RAG context</span> (when enabled) is appended at generation time.
                </div>
                <div className="text-muted-foreground/50">Live • updates as you edit anywhere in Settings</div>
              </div>
            </div>

            {/* Base personality editor — supporting role now that the composed result is hero */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Base System Prompt</Label>
                <span className="text-[10px] text-muted-foreground tabular-nums">{local.systemPrompt.length} chars</span>
              </div>
              <Textarea
                value={local.systemPrompt}
                onChange={(e) => setAndPersist({ systemPrompt: e.target.value })}
                className="min-h-[160px] font-mono text-sm leading-relaxed bg-card border-border"
                placeholder="Your core personality instructions..."
              />
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAndPersist({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  Restore default prompt
                </Button>
                <span className="text-[10px] text-muted-foreground/70">Tone rules &amp; extra instructions (Tone tab) are merged on top of this</span>
              </div>
            </div>
          </TabsContent>

          {/* 2. Grammar & Tone Rules */}
          <TabsContent value="tone" className="px-6 pt-4 pb-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <Label>Response Style Preset</Label>
                <Select
                  value={local.activeStylePreset}
                  onValueChange={(v) => {
                    const preset = v as ToneRules["style"];
                    setAndPersist({
                      activeStylePreset: preset,
                      toneRules: TONE_PRESETS[preset],
                    });
                  }}
                >
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["Professional", "Concise", "Detailed", "Empathetic"] as const).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max reply length (guidance)</Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[local.toneRules.maxLength ?? 280]}
                    onValueChange={([v]) => updateTone({ maxLength: v })}
                    min={60}
                    max={1200}
                    step={20}
                    className="flex-1"
                  />
                  <div className="w-12 text-right text-sm tabular-nums">{local.toneRules.maxLength}</div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                <div>
                  <div className="text-sm">Always use full sentences</div>
                  <div className="text-xs text-muted-foreground">No fragments or shorthand</div>
                </div>
                <Switch
                  checked={local.toneRules.alwaysUseFullSentences}
                  onCheckedChange={(c) => updateTone({ alwaysUseFullSentences: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                <div>
                  <div className="text-sm">No emojis</div>
                  <div className="text-xs text-muted-foreground">Strict professional appearance</div>
                </div>
                <Switch
                  checked={local.toneRules.noEmojis}
                  onCheckedChange={(c) => updateTone({ noEmojis: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                <div>
                  <div className="text-sm">Direct but polite</div>
                </div>
                <Switch
                  checked={local.toneRules.beDirectButPolite}
                  onCheckedChange={(c) => updateTone({ beDirectButPolite: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                <div>
                  <div className="text-sm">Prioritize security warnings</div>
                </div>
                <Switch
                  checked={local.toneRules.prioritizeSecurity}
                  onCheckedChange={(c) => updateTone({ prioritizeSecurity: c })}
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-xs">Extra instructions (appended to every system prompt)</Label>
              <Textarea
                placeholder="E.g. Always mention the ticket ID at the top. For corporate clients use last name only."
                className="mt-1.5 bg-card min-h-[84px] border-border"
                value={local.extraInstructions || ""}
                onChange={(e) => setAndPersist({ extraInstructions: e.target.value })}
              />
            </div>
          </TabsContent>

          {/* 4. General Usage Settings */}
          <TabsContent value="general" className="px-6 pt-4 pb-6 space-y-6 flex-1 min-h-0 overflow-y-auto">
            {/* Model section — main star (2x2 grid) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Model</Label>
                {lastLoadedSpec && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                    <Check className="h-3 w-3" /> {RECOMMENDED_LLM_MODELS.find((r) => r.id === lastLoadedSpec)?.label.split(" (")[0] || "Loaded"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">Choose a recommended model or enter a custom registry ID / local GGUF path. Load downloads (if needed) and activates instantly for new generations.</p>

              <RecommendedModels
                selectedId={local.defaultModelId}
                lastLoadedId={lastLoadedSpec}
                loadingId={loadingTarget}
                loadProgress={modelLoadProgress}
                onSelect={(id) => setAndPersist({ defaultModelId: id })}
                onLoad={(id) => loadModel(id)}
                disableLoad={!!loadingTarget}
              />

              {/* Custom model path / advanced ID */}
              <div className="pt-1 space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Custom model</Label>
                <div className="flex gap-2">
                  <Input
                    value={local.defaultModelId}
                    onChange={(e) => setAndPersist({ defaultModelId: e.target.value })}
                    placeholder="LLAMA_... or /path/to/model.gguf"
                    className="bg-card border-border font-mono text-sm h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0 border-border"
                    onClick={() => loadModel(local.defaultModelId || DEFAULT_LLM_MODEL)}
                    disabled={!!loadingTarget}
                  >
                    Load
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/70">Registry constant or absolute local GGUF path. The Load button above also works for custom.</p>
              </div>

              <div className="pt-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsGuideOpen(true)}
                  className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-0"
                >
                  <Info className="h-3.5 w-3.5" />
                  View full Mac model guide &amp; RAM guidance
                </Button>
              </div>

              {/* Advanced model debug (power users; stable, see README) */}
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const list = await listCachedModels();
                      setCachedModels(list);
                    } catch (e: any) {
                      setCachedModels({ files: [`Error: ${e?.message || e}`] });
                    }
                  }}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Advanced: inspect cached models
                </Button>
                {cachedModels && (
                  <div className="mt-1.5 p-2 bg-card border border-border rounded text-[10px] font-mono max-h-28 overflow-auto text-muted-foreground">
                    <div>Dir: {cachedModels.modelsDir || 'n/a'}</div>
                    <div>Files: {(cachedModels.files || []).length}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Generation + Behavior — rebalanced below the model grid for harmony */}
            <div className="pt-4 border-t border-border space-y-5">
              {/* Sliders row */}
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Generation settings</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Temperature — {local.temperature.toFixed(1)}</Label>
                    <Slider
                      value={[local.temperature]}
                      onValueChange={([v]) => setAndPersist({ temperature: v })}
                      min={0}
                      max={1}
                      step={0.05}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <div>Precise / deterministic</div>
                      <div>Creative</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Max tokens per reply — {local.maxTokens}</Label>
                    <Slider
                      value={[local.maxTokens]}
                      onValueChange={([v]) => setAndPersist({ maxTokens: v })}
                      min={256}
                      max={4096}
                      step={64}
                    />
                  </div>
                </div>
              </div>

              {/* Toggles in a clean 2x2 grid for visual harmony with the model cards */}
              <div>
                <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Behavior &amp; features</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                    <div>
                      <div className="text-sm">Auto-apply grammar check</div>
                      <div className="text-xs text-muted-foreground">Run style pass on every generated reply</div>
                    </div>
                    <Switch
                      checked={local.autoApplyGrammarCheck}
                      onCheckedChange={(c) => setAndPersist({ autoApplyGrammarCheck: c })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                    <div>
                      <div className="text-sm">Show sources &amp; confidence</div>
                      <div className="text-xs text-muted-foreground">Display RAG citations when available</div>
                    </div>
                    <Switch
                      checked={local.showConfidenceAndSources}
                      onCheckedChange={(c) => setAndPersist({ showConfidenceAndSources: c })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                    <div>
                      <div className="text-sm">Enable RAG</div>
                      <div className="text-xs text-muted-foreground">Use knowledge base in agent responses</div>
                    </div>
                    <Switch
                      checked={local.ragEnabled}
                      onCheckedChange={(c) => setAndPersist({ ragEnabled: c })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                    <div>
                      <div className="text-sm">Show usage stats in chat</div>
                      <div className="text-xs text-muted-foreground">Tokens, speed and context size under replies</div>
                    </div>
                    <Switch
                      checked={local.showUsageStats ?? true}
                      onCheckedChange={(c) => setAndPersist({ showUsageStats: c })}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Optional auto-updater (manual trigger for now; full background + signed GH releases later) */}
            <div className="pt-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>App updates (optional)</Label>
                    <p className="text-xs text-muted-foreground">Check for new Cortex builds from GitHub Releases. Full auto-update requires a real pubkey + published latest.json (see README).</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={checkForAppUpdate} disabled={checkingUpdate} className="h-7 text-xs border-border">
                    {checkingUpdate ? "Checking..." : "Check for updates"}
                  </Button>
                </div>
                {updateInfo && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={installUpdate} className="h-7 text-xs btn-primary">Install v{updateInfo.version} &amp; Restart</Button>
                    <span className="text-[10px] text-muted-foreground">Replaces current app binary.</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60">Private repo note: assets may require auth or be published as public release assets. You can always sync the latest .dmg URL manually to cortesupport.lovable.app.</p>
              </div>
          </TabsContent>

          {/* Knowledge Base */}
          <TabsContent value="kb" className="px-6 pt-4 pb-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
            <div>
              <Label>Local documents folder</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  readOnly
                  value={local.ragFolderPath ? local.ragFolderPath.split(/[/\\]/).pop() || local.ragFolderPath : "No folder selected — help articles, internal runbooks, policies, etc."}
                  title={local.ragFolderPath || undefined}
                  className="flex-1 bg-card border-border text-muted-foreground font-mono text-xs"
                />
                <Button variant="outline" onClick={pickRagFolder} className="gap-2 shrink-0 border-border" title="Choose folder">
                  <FolderOpen className="h-4 w-4" /> Choose…
                </Button>
                {local.ragFolderPath && (
                  <Button variant="ghost" size="icon" onClick={revealRagFolder} className="shrink-0 border-border" title="Reveal in Finder">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Supported: .md, .txt, .pdf (text layer). Changes require Rebuild. Use the folder icon to open in Finder.</p>
            </div>

            <div className="rounded-md border border-border bg-card p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  Last indexed: {local.knowledgeBaseLastIndexed ? new Date(local.knowledgeBaseLastIndexed).toLocaleString() : "never"}
                  <div className="text-muted-foreground text-xs mt-0.5">{local.knowledgeBaseDocCount || 0} documents</div>
                </div>
                <Button
                  onClick={triggerReindex}
                  disabled={!local.ragFolderPath || isReindexing}
                  className="gap-2"
                  variant="secondary"
                >
                  <RefreshCw className={`h-4 w-4 ${isReindexing ? "animate-spin" : ""}`} />
                  {isReindexing ? "Rebuilding…" : "Rebuild Knowledge Base"}
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground/70">
              RAG is performed entirely locally using QVAC embeddings. Your documents never leave this machine. Toggle "Enable RAG" in General tab.
            </div>
          </TabsContent>
        </Tabs>
        </div> {/* close the flex-1 scroll wrapper for tab content */}

        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-background/60 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetToDefaults} className="text-muted-foreground">
              Reset to defaults
            </Button>
            <Button variant="ghost" size="sm" onClick={exportSettings} className="text-muted-foreground">Export</Button>
            <Button variant="ghost" size="sm" onClick={importSettings} className="text-muted-foreground">Import</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSettingsOpen(false);
                // Small delay so the settings dialog closes before the wizard opens
                setTimeout(() => setOnboardingOpen(true), 120);
              }}
              className="text-muted-foreground"
            >
              Replay tour
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Close</Button>
            <Button onClick={() => setSettingsOpen(false)} className="btn-primary">Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* In-App Model Guide Dialog — Mac optimized */}
    <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-background border-border text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
          <DialogTitle className="text-xl tracking-[-0.3px]">Guía de Modelos — Optimizado para Mac</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Características y requerimientos técnicos para Apple Silicon (unified memory). Todos corren 100% local vía QVAC.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {MODEL_GUIDE.map((model) => (
            <div
              key={model.id}
              className="glass border border-border rounded-xl p-4 space-y-3"
            >
              <div>
                <div className="font-semibold text-lg tracking-[-0.2px]">{model.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{model.quant} • {model.ctx}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">RAM en Mac</div>
                  <div>{model.ramMac}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Performance en Apple Silicon</div>
                  <div>{model.performanceMac}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Mejor para</div>
                  <div>{model.bestFor}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Velocidad vs Calidad</div>
                  <div>{model.speedVsQuality}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground/80 pt-1 border-t border-border/60">
                {model.notes}
              </div>
            </div>
          ))}

          <div className="text-[11px] text-muted-foreground/70 space-y-1 pt-2 border-t border-border">
            {GUIDE_COMMON_NOTES.map((note, i) => (
              <div key={i}>• {note}</div>
            ))}
          </div>

          <div className="text-[11px] text-primary/80 pt-2">
            Tip: Las estadísticas minimalistas de consumo (tokens, contexto, t/s) que ahora ves en el chat te ayudan a elegir el modelo correcto según tu Mac y flujo de trabajo.
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4 bg-background/60">
          <Button variant="ghost" onClick={() => setIsGuideOpen(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
