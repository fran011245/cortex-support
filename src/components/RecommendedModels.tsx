import { RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { MODEL_GUIDE } from "@/lib/modelGuide";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecommendedModelsProps {
  /** Currently selected model id (for "Selected" state and button variant) */
  selectedId: string;
  /** The model id that was successfully loaded in this session (shows "Loaded" badge) */
  lastLoadedId?: string | null;
  /** Which model is currently being loaded (for progress UI) */
  loadingId?: string | null;
  /** Current load progress (only shown for the loadingId) */
  loadProgress?: { percentage?: number } | null;
  /** Called when user clicks a card to select it (live persist) */
  onSelect: (id: string) => void;
  /** Called when user clicks the Load button for a model */
  onLoad: (id: string) => void;
  /** Disable all load buttons (e.g. while something else is loading) */
  disableLoad?: boolean;
  className?: string;
}

/**
 * Shared 2x2 (future-proof) grid of recommended models.
 * Used in both Settings (General tab) and the Onboarding Wizard.
 *
 * The component is presentational: parents control selection state,
 * loading state, and the actual load logic.
 */
export function RecommendedModels({
  selectedId,
  lastLoadedId,
  loadingId,
  loadProgress,
  onSelect,
  onLoad,
  disableLoad = false,
  className,
}: RecommendedModelsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {RECOMMENDED_LLM_MODELS.map((m) => {
        const guide = MODEL_GUIDE.find((g) => g.id === m.id);
        const short = m.label.split(" (")[0];
        const isSelected = selectedId === m.id;
        const isLoadingThis = loadingId === m.id;
        const isLoaded = lastLoadedId === m.id;

        return (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            className={cn(
              "glass rounded-lg border p-2.5 cursor-pointer transition-all active:scale-[0.985]",
              isSelected ? "border-primary/60 ring-1 ring-primary/15" : "border-border hover:border-border/70",
              isLoadingThis && "opacity-95"
            )}
            title={m.label}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-[13px] tracking-[-0.1px] leading-tight">{short}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {guide?.quant} • {guide?.ramMac.split("–")[0].trim() || ""}
                </div>
              </div>
              <div className="text-right shrink-0 text-[10px] leading-none pt-0.5">
                {isLoaded ? (
                  <span className="text-emerald-400 font-medium">Loaded</span>
                ) : isSelected ? (
                  <span className="text-primary/80">Selected</span>
                ) : null}
              </div>
            </div>

            <div className="mt-1 text-[10px] leading-snug text-muted-foreground/90 line-clamp-2">
              {guide?.bestFor}
            </div>
            <div className="mt-0.5 text-[9px] text-muted-foreground/70">
              {guide?.speedVsQuality}
            </div>

            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              {isLoadingThis ? (
                <div className="space-y-1">
                  <div className="h-1 bg-muted rounded overflow-hidden border border-border/40">
                    <div
                      className="h-1 bg-primary transition-all"
                      style={{ width: `${Math.max(3, Math.round(loadProgress?.percentage || 0))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] tabular-nums text-primary">
                    <span>{Math.round(loadProgress?.percentage || 0)}%</span>
                    <span className="text-muted-foreground/60">downloading / loading</span>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className={cn("h-7 text-xs w-full justify-center", isSelected && "btn-primary")}
                  onClick={() => onLoad(m.id)}
                  disabled={disableLoad}
                >
                  {isSelected ? "Load / Download" : "Select & Load"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
