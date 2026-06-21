import { useEffect, useState, useRef } from "react";
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
import { loadLocalModel, listCachedModels, type ModelDownloadProgress } from "@/lib/qvac";
import { DEFAULT_LLM_MODEL, DEFAULT_EMBED_MODEL, RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { toast } from "sonner";
import { FolderOpen, RefreshCw, Info, Settings, Bot, Database, Check, Copy, Sliders, FileQuestion, ExternalLink } from "lucide-react";
import { MODEL_GUIDE, GUIDE_COMMON_NOTES } from "@/lib/modelGuide";
import { RecommendedModels } from "@/components/RecommendedModels";
import { AGENT_PROFILES, getAgentProfile, type AgentProfileId } from "@/lib/agentProfiles";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import { getVersion } from "@tauri-apps/api/app";

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings, setModelId, setOnboardingOpen } = useAgentStore();
  const [local, setLocal] = useState(settings);
  const [isReindexing, setIsReindexing] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState<ModelDownloadProgress | null>(null);
  const [cachedModels, setCachedModels] = useState<{ modelsDir?: string; files?: string[] } | null>(null);
  const [updateState, setUpdateState] = useState<"idle" | "checking" | "up-to-date" | "available" | "no-releases" | "error">("idle");
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [lastLoadedSpec, setLastLoadedSpec] = useState<string | null>(null);
  const currentLoadControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
    if (isSettingsOpen && !appVersion) {
      getVersion().then(setAppVersion).catch(() => {});
    }
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
    // Cancel any previous load
    if (currentLoadControllerRef.current) {
      currentLoadControllerRef.current.abort();
    }
    const controller = new AbortController();
    currentLoadControllerRef.current = controller;

    setLoadingTarget(src);
    setModelLoadProgress(null);
    try {
      // Reuse the cached download; loadLocalModel auto-clears + retries on a real lock error.
      const handle = await loadLocalModel({
        modelSrc: src,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
        onProgress: (p) => setModelLoadProgress(p),
        signal: controller.signal,
      });
      setModelId(handle);
      await updateSettings({ defaultModelId: src });
      setLastLoadedSpec(src);
      setLocal((prev) => prev && ({ ...prev, defaultModelId: src }));
      toast.success("Model ready", { description: src });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // cancelled by user
        return;
      }
      const msg = e?.message || "See console";
      toast.error("Load failed after retry", { 
        description: msg + ". Use the 'Clear model cache' button below or restart the app." 
      });
    } finally {
      if (currentLoadControllerRef.current === controller) {
        currentLoadControllerRef.current = null;
      }
      setLoadingTarget(null);
      setModelLoadProgress(null);
    }
  };

  const cancelCurrentModelLoad = (id: string) => {
    if (currentLoadControllerRef.current) {
      currentLoadControllerRef.current.abort();
      currentLoadControllerRef.current = null;
    }
    // Also proactively clear the partial download
    import("@/lib/qvac").then(({ clearModelCache }) => {
      clearModelCache(id).catch(() => {});
    });
    setLoadingTarget(null);
    setModelLoadProgress(null);
    toast.info("Download cancelled");
  };

  const pickLocalModelFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "GGUF Model", extensions: ["gguf"] }],
      title: "Select a local GGUF model file",
    });
    if (typeof selected === "string") {
      setAndPersist({ defaultModelId: selected });
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
    setUpdateState("checking");
    setUpdateInfo(null);
    try {
      const update = await check();
      if (update?.available) {
        setUpdateInfo(update);
        setUpdateState("available");
        toast.success(`Update available: v${update.version}`);
      } else {
        setUpdateState("up-to-date");
      }
    } catch (e: any) {
      console.warn("[Cortex updater]", e);
      const msg = String(e?.message || e);
      if (msg.includes("404") || msg.includes("Not Found") || msg.toLowerCase().includes("fetch") || msg.includes("status code")) {
        setUpdateState("no-releases");
      } else {
        setUpdateState("error");
      }
    }
  };

  const installUpdate = async () => {
    if (!updateInfo) return;
    try {
      toast.info("Downloading & installing update...");
      await updateInfo.downloadAndInstall();
      toast.success("Update installed — restarting");
      await relaunch();
    } catch (e: any) {
      toast.error("Install failed", { description: e?.message || "See console for details" });
    }
  };

  const openGitHubReleases = async () => {
    try {
      await openUrl("https://github.com/fran011245/cortex-support/releases/latest");
    } catch {
      window.open("https://github.com/fran011245/cortex-support/releases/latest", "_blank");
    }
  };

  return (
    <>
      <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-background border-border text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border shrink-0">
          <DialogTitle className="text-xl tracking-[-0.3px]">Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Agent personality, tone, models, and knowledge base. Changes apply instantly.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable tab area - header and footer stay fixed */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <Tabs defaultValue="general" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-6 mt-4 mb-2 w-fit bg-card border border-border shrink-0">
            <TabsTrigger value="general" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
            <TabsTrigger value="prompt" className="gap-1.5"><Bot className="h-3.5 w-3.5" /> Agent Prompt</TabsTrigger>
            <TabsTrigger value="tone" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> Tone Rules</TabsTrigger>
            <TabsTrigger value="kb" className="gap-1.5"><Database className="h-3.5 w-3.5" /> Knowledge Base</TabsTrigger>
          </TabsList>

          {/* Agent Prompt — now a first-class Prompt Composer (Fase 2) */}
          <TabsContent value="prompt" className="px-6 pt-4 pb-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* Current Profile quick switcher */}
            {settings?.agentProfile && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Current profile:</span>{" "}
                  <span className="font-medium">
                    {getAgentProfile(settings.agentProfile as AgentProfileId).name}
                  </span>
                </div>
                <div className="flex gap-1">
                  {AGENT_PROFILES.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant={settings.agentProfile === p.id ? "default" : "outline"}
                      className="h-7 text-[11px] px-2"
                      onClick={() => {
                        const profile = getAgentProfile(p.id);
                        const mergedTone = {
                          ...local.toneRules,
                          ...profile.defaultToneRules,
                          style: profile.defaultToneRules.style || local.toneRules?.style || profile.activeStylePreset,
                        } as any;

                        setAndPersist({
                          agentProfile: p.id,
                          systemPrompt: profile.baseSystemPrompt,
                          toneRules: mergedTone,
                          activeStylePreset: profile.activeStylePreset,
                          extraInstructions: profile.suggestedExtraInstructions || "",
                        });
                      }}
                    >
                      {p.name.split(" ")[0]}
                    </Button>
                  ))}
                </div>
              </div>
            )}

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
                  onClick={() => {
                    const currentProfileId = (local.agentProfile as AgentProfileId) || "crypto";
                    const profile = getAgentProfile(currentProfileId);
                    setAndPersist({
                      systemPrompt: profile.baseSystemPrompt,
                      toneRules: { ...local.toneRules, ...profile.defaultToneRules },
                      activeStylePreset: profile.activeStylePreset,
                      extraInstructions: profile.suggestedExtraInstructions || "",
                    });
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                >
                  Restore profile defaults
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
                  <div className="text-xs text-muted-foreground">Assertive without unnecessary hedging</div>
                </div>
                <Switch
                  checked={local.toneRules.beDirectButPolite}
                  onCheckedChange={(c) => updateTone({ beDirectButPolite: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-border bg-card p-3">
                <div>
                  <div className="text-sm">Prioritize security warnings</div>
                  <div className="text-xs text-muted-foreground">Highlight 2FA, TXID, and account safety steps</div>
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
              <p className="text-[10px] text-amber-400/80">Small local models have moderate factual accuracy — always review important drafts. RAG grounding helps.</p>

              <RecommendedModels
                selectedId={local.defaultModelId}
                lastLoadedId={lastLoadedSpec}
                loadingId={loadingTarget}
                loadProgress={modelLoadProgress}
                onSelect={(id) => setAndPersist({ defaultModelId: id })}
                onLoad={(id) => loadModel(id)}
                onCancel={cancelCurrentModelLoad}
                disableLoad={!!loadingTarget}
              />

              {/* Custom model path / advanced ID */}
              <div className="pt-1 space-y-1.5">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Custom model</Label>
                <p className="text-[9px] text-muted-foreground">For models like DeepSeek, enter a local .gguf path (download from Hugging Face) or a supported registry ID.</p>
                <div className="flex gap-2">
                  <Input
                    value={local.defaultModelId}
                    onChange={(e) => setAndPersist({ defaultModelId: e.target.value })}
                    placeholder="LLAMA_... or registry://... or /path/to/model.gguf (for DeepSeek use the card or custom url)"
                    className="bg-card border-border font-mono text-sm h-8 min-w-0"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs shrink-0 border-border gap-1.5"
                    onClick={pickLocalModelFile}
                    title="Browse for a local .gguf file"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Browse
                  </Button>
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
                <p className="text-[10px] text-muted-foreground/70">
                  Use Browse to pick any local <span className="font-mono">.gguf</span> file, or paste a registry constant (e.g. <span className="font-mono">LLAMA_3_2_1B_INST_Q4_0</span>).
                </p>
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      const { clearModelCache } = await import("@/lib/qvac");
                      await clearModelCache();
                      setCachedModels(null);
                      toast.success("Model cache cleared", { description: "Try loading the model again." });
                    } catch (e: any) {
                      toast.error("Failed to clear cache", { description: e?.message || "See console" });
                    }
                  }}
                  className="h-6 px-2 text-[10px] text-amber-400 hover:text-amber-300"
                >
                  Clear model cache (fixes "file descriptor could not be locked")
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

            <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Label>App updates</Label>
                      {appVersion && (
                        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums">v{appVersion}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs">
                      {updateState === "idle" && (
                        <span className="text-muted-foreground">Check for new builds or download directly from GitHub.</span>
                      )}
                      {updateState === "checking" && (
                        <span className="text-muted-foreground">Checking...</span>
                      )}
                      {updateState === "up-to-date" && (
                        <span className="text-emerald-400/90">You're on the latest version</span>
                      )}
                      {updateState === "available" && (
                        <span className="text-primary">Update available — v{updateInfo?.version}</span>
                      )}
                      {updateState === "no-releases" && (
                        <span className="text-muted-foreground">No published releases found — download the latest build from GitHub directly.</span>
                      )}
                      {updateState === "error" && (
                        <span className="text-destructive/70">Update check failed — download latest from GitHub.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={checkForAppUpdate}
                      disabled={updateState === "checking"}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground border border-border"
                    >
                      {updateState === "checking" ? "Checking..." : "Check"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openGitHubReleases}
                      className="h-7 text-xs border-border gap-1.5"
                    >
                      <ExternalLink className="h-3 w-3" /> Download .dmg
                    </Button>
                  </div>
                </div>
                {updateState === "available" && updateInfo && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={installUpdate} className="h-7 text-xs btn-primary">
                      Install v{updateInfo.version} &amp; Restart
                    </Button>
                    <span className="text-[10px] text-muted-foreground">Replaces current app binary.</span>
                  </div>
                )}
              </div>
          </TabsContent>

          {/* Knowledge Base */}
          <TabsContent value="kb" className="px-6 pt-4 pb-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
            {!local.ragFolderPath ? (
              <div className="glass rounded-xl border border-dashed border-border p-10 flex flex-col items-center gap-4 text-center">
                <div className="rounded-full bg-muted/20 p-4">
                  <FileQuestion className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <div className="text-sm font-medium">No folder connected</div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                    Point Cortex to a folder of help articles, runbooks, or policy docs and the agent will cite them in replies.
                  </div>
                </div>
                <Button variant="outline" onClick={pickRagFolder} className="gap-2 border-border mt-1">
                  <FolderOpen className="h-4 w-4" /> Choose folder
                </Button>
                <p className="text-[10px] text-muted-foreground/50">Supports .md, .txt, .pdf — indexed locally, never leaves this machine</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Local documents folder</Label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      readOnly
                      value={local.ragFolderPath.split(/[/\\]/).pop() || local.ragFolderPath}
                      title={local.ragFolderPath}
                      className="flex-1 bg-card border-border text-muted-foreground font-mono text-xs"
                    />
                    <Button variant="outline" onClick={pickRagFolder} className="gap-2 shrink-0 border-border" title="Change folder">
                      <FolderOpen className="h-4 w-4" /> Change…
                    </Button>
                    <Button variant="ghost" size="icon" onClick={revealRagFolder} className="shrink-0 border-border" title="Reveal in Finder">
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Supports .md, .txt, .pdf (text layer). Changes require a Rebuild.</p>
                </div>

                <div className="glass rounded-xl border border-border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">
                        {local.knowledgeBaseLastIndexed
                          ? `Indexed ${new Date(local.knowledgeBaseLastIndexed).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                          : "Not indexed yet"}
                      </div>
                      <div className="text-muted-foreground text-xs mt-0.5">
                        {local.knowledgeBaseDocCount
                          ? `${local.knowledgeBaseDocCount} documents in the knowledge base`
                          : "Run Rebuild to index your documents"}
                      </div>
                    </div>
                    <Button
                      onClick={triggerReindex}
                      disabled={isReindexing}
                      className="gap-2"
                      variant="secondary"
                    >
                      <RefreshCw className={`h-4 w-4 ${isReindexing ? "animate-spin" : ""}`} />
                      {isReindexing ? "Rebuilding…" : "Rebuild"}
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground/70">
                  All embeddings run locally via QVAC — your documents never leave this machine. Toggle "Enable RAG" in General to activate in chat.
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
        </div> {/* close the flex-1 scroll wrapper for tab content */}

        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-background/60 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={resetToDefaults} className="text-destructive/60 hover:text-destructive hover:bg-destructive/5 text-xs">
              Reset to defaults
            </Button>
            <div className="w-px h-3.5 bg-border" />
            <Button variant="ghost" size="sm" onClick={exportSettings} className="text-muted-foreground text-xs">Export</Button>
            <Button variant="ghost" size="sm" onClick={importSettings} className="text-muted-foreground text-xs">Import</Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSettingsOpen(false);
                setTimeout(() => setOnboardingOpen(true), 120);
              }}
              className="text-muted-foreground text-xs"
            >
              Replay tour
            </Button>
          </div>
          <Button onClick={() => setSettingsOpen(false)} className="btn-primary">Done</Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* In-App Model Guide Dialog — Mac optimized */}
    <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col bg-background border-border text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
          <DialogTitle className="text-xl tracking-[-0.3px]">Model Guide — Mac Optimized</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Technical specs and RAM requirements for Apple Silicon. All models run 100% locally via QVAC.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 overflow-y-auto">
          {MODEL_GUIDE.map((model) => (
            <div
              key={model.id}
              className="glass border border-border rounded-xl p-4 space-y-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold text-lg tracking-[-0.2px]">{model.name}</div>
                  {model.recommended && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Recommended</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">{model.quant} • {model.ctx}</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">RAM on Mac</div>
                  <div>{model.ramMac}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Performance on Apple Silicon</div>
                  <div>{model.performanceMac}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Best for</div>
                  <div>{model.bestFor}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Speed vs Quality</div>
                  <div>{model.speedVsQuality}</div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Parameters</div>
                  <div>{model.paramCount}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Min Mac spec</div>
                  <div>{model.minMacSpec}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-0.5">Accuracy & hallucinations</div>
                  <div className="text-sm">{model.fidelity}</div>
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
            Tip: The usage stats shown under each reply (tokens, t/s, context) help you pick the right model for your Mac and workload.
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4 bg-background/60">
          <Button variant="ghost" onClick={() => setIsGuideOpen(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
