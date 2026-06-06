import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getModelDisplayLabel } from "@/lib/settings";

export interface ModelStatusProps {
  currentModelId?: string;
  defaultModelId?: string;
  isLoading?: boolean;
  progress?: number;
  onLoad?: () => void;
  className?: string;
  /** Compact for side panels / tools headers */
  compact?: boolean;
}

export function ModelStatus({
  currentModelId,
  defaultModelId,
  isLoading,
  progress,
  onLoad,
  className,
  compact,
}: ModelStatusProps) {
  const displayLabel = getModelDisplayLabel(defaultModelId);
  const isReady = !!currentModelId;

  const dotClass = cn(
    "inline-block h-1.5 w-1.5 rounded-full shrink-0",
    isReady ? "bg-emerald-500" : defaultModelId ? "bg-amber-500" : "bg-slate-500",
  );

  const pillClass = cn(
    "rounded border border-[#1E293B] bg-[#121827] px-1.5 py-0.5 text-[10px] font-mono text-foreground/90 flex items-center gap-1",
    compact && "px-1 py-px text-[9px]",
  );

  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span>Local model</span>
        <span className={dotClass} />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3 w-20 inline-block align-middle" />
          {typeof progress === "number" && (
            <span className="text-[10px] text-[#3B82F6] tabular-nums">{Math.round(progress)}%</span>
          )}
        </div>
      ) : (
        <div className={pillClass} title={defaultModelId || undefined}>
          {displayLabel}
        </div>
      )}

      {!isReady && onLoad && (
        <Button
          size="sm"
          variant="outline"
          onClick={onLoad}
          disabled={isLoading}
          className={cn(
            "h-6 gap-1 border-[#1E293B] text-[10px] px-2",
            "hover:border-[#3B82F6]/50 hover:text-[#3B82F6]",
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Cpu className="h-3 w-3" />
          )}
          {isLoading && typeof progress === "number"
            ? `Loading ${Math.round(progress)}%`
            : "Load model"}
        </Button>
      )}

      {isReady && onLoad && !compact && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onLoad}
          disabled={isLoading}
          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Reload
        </Button>
      )}
    </div>
  );
}
