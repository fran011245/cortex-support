import { useState, useRef, useEffect } from "react";
import { useAgentStore } from "@/stores/useAgentStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Settings, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const {
    sessions,
    currentSession,
    loadSession,
    newSession,
    deleteSession,
    renameSession,
    setSettingsOpen,
    activeTool,
    setActiveTool,
  } = useAgentStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = () => {
    if (renamingId) {
      renameSession(renamingId, renameValue);
      setRenamingId(null);
    }
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitRename(); }
    if (e.key === "Escape") cancelRename();
  };

  return (
    <div className="flex h-full w-72 flex-col border-r border-[#1E293B] bg-[#0A0F1C]/95">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-[#3B82F6] flex items-center justify-center">
            <span className="text-[13px] font-semibold text-white tracking-[-1px]">C</span>
          </div>
          <div>
            <div className="font-semibold tracking-[-0.3px] text-lg leading-none">Cortex</div>
            <div className="text-[10px] text-muted-foreground -mt-0.5">Support Co-Pilot</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSettingsOpen(true)}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* New Chat */}
      <div className="p-3">
        <Button
          onClick={newSession}
          className="w-full justify-start gap-2 btn-primary h-9 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      {/* Chat History */}
      <div className="px-3 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium pl-4">
        History
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-1">
          {sessions.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              No conversations yet
            </div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => renamingId !== session.id && loadSession(session.id)}
              className={cn(
                "group flex items-center justify-between rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-[#121827] transition-colors",
                currentSession?.id === session.id && "bg-[#121827] border-l-2 border-[#3B82F6]",
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5 flex-1">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                {renamingId === session.id ? (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-[#1E293B] border border-[#3B82F6]/50 rounded px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-0"
                  />
                ) : (
                  <span className="truncate text-foreground/90">{session.title}</span>
                )}
              </div>

              {renamingId !== session.id && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => startRename(session.id, session.title, e)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Tools */}
      <div className="border-t border-[#1E293B] p-3 space-y-1">
        <div className="px-1 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-medium">
          Tools
        </div>
        {[
          { key: "chat" as const, label: "Chat Agent" },
          { key: "grammar" as const, label: "Grammar & Style" },
          { key: "translate" as const, label: "Smart Translate" },
          { key: "templates" as const, label: "Response Templates" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTool(t.key)}
            className={cn(
              "w-full text-left text-sm px-3 py-1.5 rounded hover:bg-[#121827] flex items-center gap-2 transition-colors",
              activeTool === t.key && "text-[#3B82F6] bg-[#121827]/70",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-3 text-[10px] text-muted-foreground/50 border-t border-[#1E293B]">
        100% local · QVAC
      </div>
    </div>
  );
}
