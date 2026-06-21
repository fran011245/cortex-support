import { useRef, useEffect, useState } from "react";
import { RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { MODEL_GUIDE } from "@/lib/modelGuide";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ModelDownloadProgress } from "@/lib/qvac";

interface RecommendedModelsProps {
  /** Currently selected model id (for "Selected" state and button variant) */
  selectedId: string;
  /** The model id that was successfully loaded in this session (shows "Loaded" badge) */
  lastLoadedId?: string | null;
  /** Which model is currently being loaded (for progress UI) */
  loadingId?: string | null;
  /** Current load progress (only shown for the loadingId) */
  loadProgress?: ModelDownloadProgress | null;
  /** Called when user clicks a card to select it (live persist) */
  onSelect: (id: string) => void;
  /** Called when user clicks the Load button for a model */
  onLoad: (id: string) => void;
  /** Disable all load buttons (e.g. while something else is loading) */
  disableLoad?: boolean;
  className?: string;
  /** Called when user wants to cancel an in-progress download for this model id */
  onCancel?: (id: string) => void;
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
  onCancel,
}: RecommendedModelsProps) {
  // For download speed calculation (simple delta based)
  const lastProgressRef = useRef<{ bytes?: number; time: number } | null>(null);
  const [downloadSpeed, setDownloadSpeed] = useState<string | null>(null);

  // Compute speed when progress updates for the loading item
  useEffect(() => {
    if (!loadProgress || !loadingId) {
      lastProgressRef.current = null;
      setDownloadSpeed(null);
      return;
    }

    const now = Date.now();
    const currentBytes = loadProgress.bytesLoaded;

    if (currentBytes != null && lastProgressRef.current) {
      const prev = lastProgressRef.current;
      const deltaBytes = currentBytes - (prev.bytes || 0);
      const deltaTime = (now - prev.time) / 1000; // seconds

      if (deltaTime > 0.2 && deltaBytes > 0) { // ignore too small intervals
        const bytesPerSec = deltaBytes / deltaTime;
        const mbps = bytesPerSec / (1024 * 1024);
        setDownloadSpeed(`${mbps.toFixed(1)} MB/s`);
      }
    }

    if (currentBytes != null) {
      lastProgressRef.current = { bytes: currentBytes, time: now };
    }
  }, [loadProgress, loadingId]);

  const formatGB = (bytes?: number) => {
    if (bytes == null) return null;
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const formatETA = (progress: ModelDownloadProgress | null | undefined, speedMBps: string | null) => {
    if (!progress?.bytesLoaded || !progress?.bytesTotal || !speedMBps) return null;
    const mbps = parseFloat(speedMBps);
    if (!mbps || mbps <= 0) return null;
    const remainingBytes = progress.bytesTotal - progress.bytesLoaded;
    const remainingMB = remainingBytes / (1024 * 1024);
    const etaSec = Math.round(remainingMB / mbps);
    if (etaSec < 60) return `~${etaSec}s left`;
    const etaMin = Math.round(etaSec / 60);
    return `~${etaMin}m left`;
  };

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
                  {guide?.paramCount} • {guide?.quant} • {guide?.ramMac.split("–")[0].trim() || ""}
                </div>
              </div>
              <div className="text-right shrink-0 text-[10px] leading-none pt-0.5 flex flex-col items-end gap-0.5">
                {isLoaded ? (
                  <span className="text-emerald-400 font-medium">Loaded</span>
                ) : isSelected ? (
                  <span className="text-primary/80">Selected</span>
                ) : null}
                {guide?.recommended && (
                  <span className="text-[9px] px-1.5 py-0 rounded bg-emerald-500/15 text-emerald-400 font-medium">Recommended</span>
                )}
              </div>
            </div>

            <div className="mt-1 text-[10px] leading-snug text-muted-foreground/90 line-clamp-2">
              {guide?.bestFor}
            </div>
            <div className="mt-0.5 text-[9px] text-muted-foreground/70">
              {guide?.speedVsQuality}
            </div>
            {guide?.fidelity && (
              <div className="mt-0.5 text-[9px] text-amber-400/80 line-clamp-1" title={guide.fidelity}>
                {guide.fidelity.split(". ")[0]}.
              </div>
            )}

            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              {isLoadingThis ? (
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-muted rounded overflow-hidden border border-border/40">
                    <div
                      className="h-1.5 bg-primary transition-all"
                      style={{ width: `${Math.max(3, Math.round(loadProgress?.percentage || 0))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] tabular-nums">
                    <div className="text-primary font-medium">
                      {Math.round(loadProgress?.percentage || 0)}%
                    </div>

                    <div className="text-muted-foreground/80 text-right">
                      {loadProgress?.bytesLoaded != null && loadProgress?.bytesTotal != null ? (
                        <>
                          {formatGB(loadProgress.bytesLoaded)} / {formatGB(loadProgress.bytesTotal)}
                          {downloadSpeed && <span className="ml-1.5 text-primary/90">• {downloadSpeed}</span>}
                          {loadProgress && downloadSpeed && (
                            <span className="ml-1.5 text-primary/70">• {formatETA(loadProgress, downloadSpeed)}</span>
                          )}
                        </>
                      ) : (
                        downloadSpeed || "downloading..."
                      )}
                    </div>
                  </div>
                  <div className="text-[9px] text-muted-foreground/60 text-center">Downloading…</div>

                  {onCancel && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs w-full justify-center"
                      onClick={() => onCancel(m.id)}
                    >
                      Cancel download
                    </Button>
                  )}
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
