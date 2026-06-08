import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAgentStore } from "@/stores/useAgentStore";
import { buildSystemPrompt, estimateTokens } from "@/lib/prompts";
import { loadLocalModel } from "@/lib/qvac";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Bot, FolderOpen, Eye, Check, ArrowRight, SkipForward } from "lucide-react";
import { RecommendedModels } from "@/components/RecommendedModels";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OnboardingWizard({ open: wizardOpen, onOpenChange }: OnboardingWizardProps) {
  const {
    settings,
    updateSettings,
    setModelId,
    completeOnboarding,
  } = useAgentStore();

  const [step, setStep] = useState(0);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelLoadProgress, setModelLoadProgress] = useState<{ percentage?: number } | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);

  const effectivePrompt = buildSystemPrompt(
    settings?.systemPrompt || "",
    settings?.toneRules,
    settings?.extraInstructions
  );

  const totalSteps = 5;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const goNext = () => setStep((s) => Math.min(s + 1, totalSteps - 1));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSkip = async () => {
    await completeOnboarding();
    onOpenChange(false);
    setStep(0);
    toast.info("Tour skipped. You can replay it anytime from Settings.");
  };

  const handleFinish = async () => {
    await completeOnboarding();
    onOpenChange(false);
    setStep(0);
    toast.success("You're all set!", { description: "Open a conversation and paste your first ticket." });
  };

  // Step 2: Model loading (reuses real load flow)
  const loadModelInWizard = async (src: string) => {
    setIsLoadingModel(true);
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
      toast.success("Model ready", { description: src });
      // Small delay so user sees the "Loaded" state before next
      setTimeout(() => {
        goNext();
      }, 600);
    } catch (e: any) {
      toast.error("Load failed", { description: e?.message || "See console" });
    } finally {
      setIsLoadingModel(false);
      setModelLoadProgress(null);
    }
  };

  // Step 3: RAG folder + index (reuses existing flows)
  const handlePickAndIndex = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select your Knowledge Base folder (PDFs, Markdown, TXT)",
    });
    if (typeof selected !== "string") return;

    await updateSettings({ ragFolderPath: selected });
    setIsIndexing(true);
    try {
      const { rebuildKnowledgeBase } = await import("@/lib/rag");
      const stats = await rebuildKnowledgeBase(selected, undefined, "EMBEDDINGGEMMA_300M_Q4_0");
      await updateSettings({
        knowledgeBaseLastIndexed: new Date().toISOString(),
        knowledgeBaseDocCount: stats.docCount,
        ragEnabled: true,
      });
      toast.success(`Indexed ${stats.docCount} documents`, {
        description: "Your internal knowledge is now available to the agent.",
      });
      setTimeout(goNext, 400);
    } catch (e: any) {
      toast.error("Index failed", { description: e?.message || "Check the folder and try again from Settings" });
    } finally {
      setIsIndexing(false);
    }
  };

  const steps = [
    // 0. Welcome
    {
      title: "Welcome to Cortex",
      subtitle: "Your 100% local Support Co-Pilot",
      content: (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Bot className="h-9 w-9 text-primary" />
          </div>
          <p className="text-lg text-foreground/90">
            Cortex helps you draft fast, consistent, professional replies — everything runs on your Mac, privately.
          </p>
          <div className="rounded-lg border border-border bg-card/60 p-4 text-left text-sm">
            <div className="font-medium mb-1">In the next 2 minutes you will:</div>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Pick the best model for your Mac (with real RAM guidance)</li>
              <li>• Connect your internal docs so answers are accurate</li>
              <li>• See exactly what prompt the model receives</li>
              <li>• Set the key behaviors that matter for support work</li>
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">You can skip any step. Everything is also available later in Settings (⌘,).</p>
        </div>
      ),
    },
    // 1. Model (highlight)
    {
      title: "Choose your model",
      subtitle: "This is the most important choice for speed and quality on your Mac",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">All models run 100% locally via QVAC. Pick one and load it now — the first download is the only wait.</p>

          <RecommendedModels
            selectedId={settings?.defaultModelId || ""}
            lastLoadedId={null} // wizard tracks via its own loading state
            loadingId={isLoadingModel ? (settings?.defaultModelId || null) : null}
            loadProgress={modelLoadProgress}
            onSelect={(id) => updateSettings({ defaultModelId: id })}
            onLoad={(id) => loadModelInWizard(id)}
            disableLoad={isLoadingModel}
          />

          <p className="text-[10px] text-center text-muted-foreground">Tip: Llama 3.2 1B is the fastest daily driver for most support work on Mac.</p>
        </div>
      ),
    },
    // 2. Knowledge Base
    {
      title: "Connect your Knowledge Base",
      subtitle: "Give Cortex your internal docs so replies are accurate and on-brand",
      content: (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/60 p-4 text-sm">
            <div className="font-medium mb-1 flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Why this matters</div>
            <p className="text-muted-foreground">Point Cortex at your folder of help articles, runbooks, policies, and past resolved tickets. It will index them locally and cite sources. Your documents never leave this machine.</p>
          </div>

          <Button
            onClick={handlePickAndIndex}
            disabled={isIndexing}
            className="w-full h-11 gap-2 btn-primary"
          >
            <FolderOpen className="h-4 w-4" />
            {isIndexing ? "Indexing…" : "Choose folder & index now"}
          </Button>
          {settings?.ragFolderPath && (
            <div className="text-xs text-center text-emerald-400">
              Current folder: {settings.ragFolderPath.split(/[/\\]/).pop()}
            </div>
          )}
          <p className="text-[10px] text-center text-muted-foreground">You can always change or rebuild later in Settings → Knowledge Base.</p>
        </div>
      ),
    },
    // 3. Effective Prompt transparency
    {
      title: "See exactly what the model receives",
      subtitle: "Transparency is one of Cortex's superpowers",
      content: (
        <div className="space-y-3">
          <div className="glass rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <Eye className="h-4 w-4 text-primary" /> Live Effective Prompt
            </div>
            <pre className="text-[11px] leading-relaxed font-mono bg-background/60 border border-border rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap text-foreground/90">
              {effectivePrompt}
            </pre>
            <div className="mt-1 text-[10px] text-muted-foreground/70 flex justify-between">
              <span>≈ {estimateTokens(effectivePrompt)} tokens</span>
              <span>Includes base + active Tone Rules + Extra Instructions</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Tone Rules (from the next tab) and any Extra Instructions you add are automatically merged. You always know what the model will see — plus any RAG context when enabled.</p>
          <Button variant="outline" size="sm" onClick={() => useAgentStore.getState().setSettingsOpen(true)} className="w-full">
            Open full Prompt & Tone editor
          </Button>
        </div>
      ),
    },
    // 4. Behavior + Finish
    {
      title: "A few quick behaviors",
      subtitle: "These make a big difference for support work",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2">
            {[
              { key: "ragEnabled", label: "Enable RAG", desc: "Use your knowledge base in replies" },
              { key: "autoApplyGrammarCheck", label: "Auto-apply grammar check", desc: "Style pass on every draft" },
              { key: "showConfidenceAndSources", label: "Show sources & confidence", desc: "Display citations when available" },
              { key: "showUsageStats", label: "Show usage stats in chat", desc: "Tokens, speed, context size" },
            ].map((t) => {
              const checked = !!(settings as any)?.[t.key];
              return (
                <div key={t.key} className="flex items-center justify-between rounded border border-border bg-card p-3 text-sm">
                  <div>
                    <div>{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={checked ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => {
                      const current = !!(settings as any)?.[t.key];
                      updateSettings({ [t.key]: !current } as any);
                    }}
                  >
                    {checked ? "On" : "Off"}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground pt-2">All of these (and many more) live in Settings. You can change them anytime.</p>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <Dialog open={wizardOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background border-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
          <DialogTitle className="text-xl tracking-[-0.3px]">Quick setup</DialogTitle>
          <DialogDescription>
            Step {step + 1} of {totalSteps} — {current.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 min-h-[380px]">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex-1 h-1 bg-muted rounded">
              <div className="h-1 bg-primary rounded transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>

          <div>
            <div className="font-semibold text-lg tracking-tight mb-1">{current.title}</div>
            {current.content}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-card/60 px-6 py-4">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={goBack}>Back</Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSkip} className="gap-1.5 text-muted-foreground">
              <SkipForward className="h-3.5 w-3.5" /> Skip tour
            </Button>
          </div>

          <div>
            {step < totalSteps - 1 ? (
              <Button onClick={goNext} className="gap-2 btn-primary">
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="gap-2 btn-primary">
                Finish & start chatting <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
