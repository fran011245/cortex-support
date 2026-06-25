import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared loading panel shown in a tool's result area while a model is loading or
 * generating (i.e. `isProcessing && !output`). `statusText` is driven by
 * useToolModel ("Loading model… X%" / the tool's generating label).
 */
export function ToolLoadingPanel({
  statusText,
  minH = "min-h-[120px]",
}: {
  statusText: string;
  minH?: string;
}) {
  return (
    <div
      className={cn(
        "glass border border-[#1E293B] rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-center",
        minH
      )}
    >
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <div className="text-sm text-muted-foreground">{statusText}</div>
      <div className="text-xs text-muted-foreground/60 max-w-[320px]">
        Running 100% locally. Larger models can take a few seconds to start, depending on your Mac.
      </div>
    </div>
  );
}
