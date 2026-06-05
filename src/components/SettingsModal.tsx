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
import { DEFAULT_SYSTEM_PROMPT, TONE_PRESETS, type ToneRules } from "@/lib/prompts";
import type { CSSettings } from "@/lib/settings";
import { loadLocalModel } from "@/lib/qvac";
import { DEFAULT_LLM_MODEL, DEFAULT_EMBED_MODEL, RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { toast } from "sonner";
import { FolderOpen, RefreshCw } from "lucide-react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function SettingsModal() {
  const { isSettingsOpen, setSettingsOpen, settings, updateSettings, setModelId } = useAgentStore();
  const [local, setLocal] = useState(settings);
  const [isReindexing, setIsReindexing] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState<{ percentage?: number } | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings, isSettingsOpen]);

  if (!local) return null;

  const applyChanges = async (closeAfter = false) => {
    await updateSettings(local);
    toast.success("Settings applied", { description: "Agent behavior updated for new generations" });
    if (closeAfter) setSettingsOpen(false);
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
    setLocal((prev) => prev && ({
      ...prev,
      toneRules: { ...prev.toneRules, ...patch },
    }));
  };

  const pickRagFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Knowledge Base Folder (PDFs, Markdown, TXT)",
    });
    if (typeof selected === "string") {
      setLocal((prev) => prev && ({ ...prev, ragFolderPath: selected }));
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
    <Dialog open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <DialogContent className="max-w-3xl bg-[#0A0F1C] border-[#1E293B] text-foreground p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-[#1E293B]">
          <DialogTitle className="text-xl tracking-[-0.3px]">CS Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Full control over agent personality, tone, models, and knowledge base. Changes apply instantly to new generations.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mx-6 mt-4 w-fit bg-[#121827] border border-[#1E293B]">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="prompt">Agent Prompt</TabsTrigger>
            <TabsTrigger value="tone">Tone Rules</TabsTrigger>
            <TabsTrigger value="kb">Knowledge Base</TabsTrigger>
          </TabsList>

          {/* 1. Agent System Prompt */}
          <TabsContent value="prompt" className="px-6 pt-4 pb-6 space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">System Prompt</Label>
              <Textarea
                value={local.systemPrompt}
                onChange={(e) => setLocal({ ...local, systemPrompt: e.target.value })}
                className="mt-2 min-h-[280px] font-mono text-sm leading-relaxed bg-[#121827] border-[#1E293B]"
              />
              <div className="flex justify-between mt-2">
                <Button variant="ghost" size="sm" onClick={() => setLocal({ ...local, systemPrompt: DEFAULT_SYSTEM_PROMPT })}>
                  Restore default Bitfinex prompt
                </Button>
                <span className="text-xs text-muted-foreground self-center">{local.systemPrompt.length} chars</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/70">This is the core personality. Edit carefully — it defines every reply.</p>
          </TabsContent>

          {/* 2. Grammar & Tone Rules */}
          <TabsContent value="tone" className="px-6 pt-4 pb-6 space-y-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-2">
                <Label>Response Style Preset</Label>
                <Select
                  value={local.activeStylePreset}
                  onValueChange={(v) => {
                    const preset = v as ToneRules["style"];
                    setLocal({
                      ...local,
                      activeStylePreset: preset,
                      toneRules: { ...local.toneRules, ...TONE_PRESETS[preset] },
                    });
                  }}
                >
                  <SelectTrigger className="bg-[#121827] border-[#1E293B]">
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

              <div className="flex items-center justify-between rounded border border-[#1E293B] bg-[#121827] p-3">
                <div>
                  <div className="text-sm">Always use full sentences</div>
                  <div className="text-xs text-muted-foreground">No fragments or shorthand</div>
                </div>
                <Switch
                  checked={local.toneRules.alwaysUseFullSentences}
                  onCheckedChange={(c) => updateTone({ alwaysUseFullSentences: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-[#1E293B] bg-[#121827] p-3">
                <div>
                  <div className="text-sm">No emojis</div>
                  <div className="text-xs text-muted-foreground">Strict professional appearance</div>
                </div>
                <Switch
                  checked={local.toneRules.noEmojis}
                  onCheckedChange={(c) => updateTone({ noEmojis: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-[#1E293B] bg-[#121827] p-3">
                <div>
                  <div className="text-sm">Direct but polite</div>
                </div>
                <Switch
                  checked={local.toneRules.beDirectButPolite}
                  onCheckedChange={(c) => updateTone({ beDirectButPolite: c })}
                />
              </div>

              <div className="flex items-center justify-between rounded border border-[#1E293B] bg-[#121827] p-3">
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
                className="mt-1.5 bg-[#121827] min-h-[84px] border-[#1E293B]"
                value={local.extraInstructions || ""}
                onChange={(e) => setLocal({ ...local, extraInstructions: e.target.value })}
              />
            </div>
          </TabsContent>

          {/* 4. General Usage Settings */}
          <TabsContent value="general" className="px-6 pt-4 pb-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Default Model</Label>
                <Input
                  value={local.defaultModelId}
                  onChange={(e) => setLocal({ ...local, defaultModelId: e.target.value })}
                  placeholder="e.g. LLAMA_3_2_1B_INST_Q4_0 or /path/to/model.gguf"
                  className="bg-[#121827] border-[#1E293B] font-mono text-sm"
                />
                <p className="text-[11px] text-muted-foreground">QVAC model ID, local path, or registry constant. Click a recommendation below, then Load to download (if needed) and cache it.</p>

                {/* Quick selects for recommended lightweight models (good at following our support tone prompt + RAG) */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {RECOMMENDED_LLM_MODELS.map((m) => (
                    <Button
                      key={m.id}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] border-[#1E293B] hover:border-[#3B82F6]/40"
                      onClick={() => setLocal({ ...local, defaultModelId: m.id })}
                    >
                      {m.label.split(" (")[0]}
                    </Button>
                  ))}
                </div>

                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={async () => {
                      const src = local.defaultModelId || DEFAULT_LLM_MODEL;
                      setModelLoadProgress(null);
                      try {
                        await loadLocalModel({
                          modelSrc: src,
                          modelType: "llm",
                          modelConfig: { ctx_size: 4096 },
                          onProgress: (p) => setModelLoadProgress(p),
                        });
                        setModelId(src);
                        toast.success("Model ready", { description: src });
                      } catch (e: any) {
                        toast.error("Load failed", { description: e?.message || "See console" });
                      } finally {
                        setModelLoadProgress(null);
                      }
                    }}
                    disabled={!!modelLoadProgress}
                    className="h-7 text-xs"
                  >
                    {modelLoadProgress ? `Loading ${Math.round(modelLoadProgress.percentage || 0)}%...` : "Load / Download this model"}
                  </Button>
                  {modelLoadProgress && (
                    <span className="ml-2 text-[10px] text-[#3B82F6]">{Math.round(modelLoadProgress.percentage || 0)}%</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Temperature — {local.temperature.toFixed(1)}</Label>
                <Slider
                  value={[local.temperature]}
                  onValueChange={([v]) => setLocal({ ...local, temperature: v })}
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
                  onValueChange={([v]) => setLocal({ ...local, maxTokens: v })}
                  min={256}
                  max={4096}
                  step={64}
                />
              </div>

              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-apply grammar check</Label>
                    <p className="text-xs text-muted-foreground">Run style pass on every generated reply</p>
                  </div>
                  <Switch
                    checked={local.autoApplyGrammarCheck}
                    onCheckedChange={(c) => setLocal({ ...local, autoApplyGrammarCheck: c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show sources &amp; confidence</Label>
                    <p className="text-xs text-muted-foreground">Display RAG citations when available</p>
                  </div>
                  <Switch
                    checked={local.showConfidenceAndSources}
                    onCheckedChange={(c) => setLocal({ ...local, showConfidenceAndSources: c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable RAG</Label>
                    <p className="text-xs text-muted-foreground">Use knowledge base in agent responses</p>
                  </div>
                  <Switch
                    checked={local.ragEnabled}
                    onCheckedChange={(c) => setLocal({ ...local, ragEnabled: c })}
                  />
                </div>
              </div>
            </div>

            {/* Optional auto-updater (manual trigger for now; full background + signed GH releases later) */}
            <div className="pt-4 border-t border-[#1E293B] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>App updates (optional)</Label>
                    <p className="text-xs text-muted-foreground">Check for new Cortex builds from GitHub Releases. Full auto-update requires a real pubkey + published latest.json (see README).</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={checkForAppUpdate} disabled={checkingUpdate} className="h-7 text-xs border-[#1E293B]">
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
          <TabsContent value="kb" className="px-6 pt-4 pb-6 space-y-5">
            <div>
              <Label>Local documents folder</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  readOnly
                  value={local.ragFolderPath || "No folder selected — Bitfinex help articles, internal runbooks, etc."}
                  className="flex-1 bg-[#121827] border-[#1E293B] text-muted-foreground font-mono text-xs"
                />
                <Button variant="outline" onClick={pickRagFolder} className="gap-2 shrink-0 border-[#1E293B]">
                  <FolderOpen className="h-4 w-4" /> Choose…
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Supported: .md, .txt, .pdf (text layer). Changes require Rebuild.</p>
            </div>

            <div className="rounded-md border border-[#1E293B] bg-[#121827] p-4 text-sm">
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

        <div className="flex items-center justify-between border-t border-[#1E293B] bg-[#121827]/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetToDefaults} className="text-muted-foreground">
              Reset to defaults
            </Button>
            <Button variant="ghost" size="sm" onClick={exportSettings} className="text-muted-foreground">Export</Button>
            <Button variant="ghost" size="sm" onClick={importSettings} className="text-muted-foreground">Import</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Close</Button>
            <Button variant="outline" onClick={() => applyChanges(false)} className="border-[#1E293B]">
              Apply
            </Button>
            <Button onClick={() => applyChanges(true)} className="btn-primary">Save &amp; Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
