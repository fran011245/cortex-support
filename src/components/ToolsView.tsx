import { useAgentStore } from "@/stores/useAgentStore";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { cn, isMac } from "@/lib/utils";
import { GrammarCheck } from "./tools/GrammarCheck";
import { SmartTranslate } from "./tools/SmartTranslate";
import { ResponseTemplates } from "./tools/ResponseTemplates";

const toolTitles: Record<string, string> = {
  grammar: "Grammar & Style Check",
  translate: "Smart Translation",
  templates: "Response Templates",
};

export function ToolsView() {
  const activeTool = useAgentStore((s) => s.activeTool);
  const setActiveTool = useAgentStore((s) => s.setActiveTool);

  const title = toolTitles[activeTool || ""] || "Tool";

  return (
    <div className="flex h-full flex-col bg-[#0A0F1C]">
      {/* Tool header */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-[#1E293B] px-6 bg-[#0A0F1C]/80 backdrop-blur",
          isMac ? "pt-[28px] pb-3" : "py-3"
        )}
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveTool("chat")}
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Chat
          </Button>
          <div>
            <div className="font-semibold tracking-[-0.2px]">{title}</div>
            <div className="text-[11px] text-muted-foreground">Quick action using current CS Agent settings & tone</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground rounded bg-[#121827] px-2 py-0.5 border border-[#1E293B]">
          100% local
        </div>
      </div>

      {/* Tool content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl">
          {activeTool === "grammar" && <GrammarCheck />}
          {activeTool === "translate" && <SmartTranslate />}
          {activeTool === "templates" && <ResponseTemplates />}
        </div>
      </div>
    </div>
  );
}
