import { useState, useRef, useEffect } from "react";
import { useAgentStore } from "@/stores/useAgentStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, Check, Bot, User, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { loadLocalModel, streamCompletion, initQVAC } from "@/lib/qvac";
import { getEffectiveSystemPrompt, DEFAULT_LLM_MODEL, RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { ModelStatus } from "@/components/ModelStatus";

export function ChatInterface() {
  const {
    currentSession,
    appendMessage,
    updateLastMessage,
    isStreaming,
    setStreaming,
    isLoading,
    setLoading,
    currentModelId,
    setModelId,
    abortCurrent,
    settings,
  } = useAgentStore();

  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = currentSession?.messages ?? [];

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const copyToClipboard = async (text: string, id?: string) => {
    await navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1400);
    }
    toast.success("Copied to clipboard");
  };

  const handleUseAsResponse = (text: string) => {
    copyToClipboard(text);
    toast.info("Ready to paste into support ticket", { description: "Use ⌘V / Ctrl+V in your support tool" });
  };

  // Load the recommended default (or current settings default). Supports onProgress for download feedback.
  const [loadProgress, setLoadProgress] = useState<{ percentage?: number } | null>(null);

  const loadTestModel = async (modelSrcOverride?: string, silent = false) => {
    setIsLoadingModel(true);
    setLoadProgress(null);
    try {
      await initQVAC();
      const src = modelSrcOverride || DEFAULT_LLM_MODEL;
      const handle = await loadLocalModel({
        modelSrc: src,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
        onProgress: (p) => setLoadProgress(p),
      });
      setModelId(handle); // runtime handle (hash), not the src
      if (!silent) {
        const label = RECOMMENDED_LLM_MODELS.find((m) => m.id === src)?.label || src;
        toast.success("Model loaded", { description: `${label} ready` });
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Failed to load model", {
        description: e?.message || "Check Node availability and console for host errors",
      });
    } finally {
      setIsLoadingModel(false);
      setLoadProgress(null);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userText = input.trim();
    setInput("");

    // Add user turn to visible chat
    appendMessage({ role: "user", content: userText });

    // Add streaming assistant placeholder
    appendMessage({ role: "assistant", content: "", isStreaming: true });

    setStreaming(true);
    setLoading(true);

    // === Core CS Agent: always use the current effective system prompt from Settings ===
    // This is the "main CS Agent" implementation for Phase 2.
    // It enforces the professional, direct, pragmatic, security-aware support tone.
    const systemPrompt = await getEffectiveSystemPrompt();

    // Use fresh store state (avoids stale closures after async model load etc.)
    let state = useAgentStore.getState();
    const sessionMessages = state.currentSession?.messages || [];

    // The last message is the empty assistant placeholder we just added for live updates.
    // For the model, we only want turns up to (and including) the current user message.
    const turnsForModel = sessionMessages.slice(0, -1);

    const conversation = turnsForModel
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    let fullHistory = [
      { role: "system" as const, content: systemPrompt },
      ...conversation,
    ];

    // RAG integration (Phase 5): if enabled, retrieve relevant chunks and inject as context
    let sources: any[] = [];
    const ragEnabled = state.settings?.ragEnabled;
    const ragFolder = state.settings?.ragFolderPath;
    if (ragEnabled && ragFolder && userText) {
      try {
        const { searchKnowledge } = await import("@/lib/rag");
        const hits = await searchKnowledge(userText, "cortex-kb", 5);
        if (hits.length > 0) {
          sources = hits;
          const contextBlock = hits
            .map((h: any, i: number) => `[Source ${i + 1}: ${h.source}]\n${h.text}`)
            .join("\n\n");
          // Insert RAG context right after the main system prompt
          fullHistory = [
            fullHistory[0],
            { role: "system" as const, content: `Relevant internal knowledge (cite sources by number if used):\n${contextBlock}` },
            ...fullHistory.slice(1),
          ];
        }
      } catch (e) {
        console.warn("[RAG] search failed in chat", e);
      }
    }

    // Ensure a model is loaded for the desired src (from settings or default). currentModelId holds the *runtime handle*
    // (the hash returned by loadLocalModel), which must be passed to streamCompletion. The src spec (registry ID)
    // is what we load *with*. We always ensure-load here so first message after start (or after settings change)
    // works without requiring manual "Load" click.
    const desiredSrc = state.settings?.defaultModelId || DEFAULT_LLM_MODEL;
    let modelId = state.currentModelId;
    if (!modelId) {
      toast.info(`Loading model (${desiredSrc}) for the CS Agent...`);
      try {
        await loadTestModel(desiredSrc, true /*silent, info toast already shown*/);
        state = useAgentStore.getState();
        modelId = state.currentModelId || "";
      } catch {
        // Will surface error in the stream call below
      }
    }
    if (!modelId) {
      modelId = desiredSrc; // last resort (will likely fail in SDK with MODEL_NOT_FOUND if not loaded)
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let liveText = "";

    try {
      const result = await streamCompletion({
        modelId,
        history: fullHistory,
        temperature: state.settings?.temperature ?? 0.2,
        maxTokens: state.settings?.maxTokens ?? 1024,
        onToken: (delta) => {
          liveText += delta;
          updateLastMessage({ content: liveText, isStreaming: true });
        },
        onThinking: (delta) => {
          const msgs = state.currentSession?.messages || [];
          const last = msgs[msgs.length - 1] as any;
          updateLastMessage({ thinking: ((last?.thinking || "") + delta) });
        },
        signal: controller.signal,
      });

      const finalText = result.text || liveText;
      updateLastMessage({
        content: finalText,
        isStreaming: false,
        thinking: result.thinking,
        sources: sources.length ? sources : undefined,
      });
    } catch (e: any) {
      const msgs = state.currentSession?.messages || [];
      const lastContent = msgs[msgs.length - 1]?.content || "";
      if (e?.name === "AbortError" || String(e?.message || "").includes("Abort")) {
        updateLastMessage({ content: (liveText || lastContent) + "\n\n[stopped]", isStreaming: false });
      } else {
        const errMsg = e?.message || "Model error";
        updateLastMessage({
          content: (liveText || lastContent) + `\n\n[error: ${errMsg}]`,
          isStreaming: false,
        });
        toast.error("Generation failed", { description: errMsg });
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape" && isStreaming) {
      handleAbort();
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    abortCurrent(); // updates store UI state
  };

  if (!currentSession) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No active session
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0A0F1C]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-[#1E293B] px-6 py-3 bg-[#0A0F1C]/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-semibold tracking-[-0.2px]">{currentSession.title}</div>
            <ModelStatus
              currentModelId={currentModelId}
              defaultModelId={settings?.defaultModelId}
              isLoading={isLoadingModel}
              progress={loadProgress?.percentage}
              onLoad={() => loadTestModel()}
              className="mt-0.5"
              compact
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="rounded bg-[#121827] px-2 py-0.5 border border-[#1E293B]">100% private</div>
          {isStreaming && (
            <Button variant="ghost" size="sm" onClick={handleAbort} className="h-7 text-xs">
              Stop
            </Button>
          )}
          {currentModelId && (
            <Button size="sm" variant="ghost" onClick={() => loadTestModel()} disabled={isLoadingModel} className="h-7 text-xs">
              Reload model
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef as any}>
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {messages.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#121827] ring-1 ring-inset ring-white/10">
                <Bot className="h-8 w-8 text-[#3B82F6]" />
              </div>
              <div className="text-2xl font-semibold tracking-[-0.5px]">How can I help with this ticket?</div>
              <p className="mt-3 max-w-md mx-auto text-sm text-muted-foreground">
                Your Cortex Support Agent — always on-tone, 100% local. Uses your current Settings for personality, tone, and knowledge base.
              </p>

              {!currentModelId && (
                <div className="mt-4">
                  <ModelStatus
                    currentModelId={currentModelId}
                    defaultModelId={settings?.defaultModelId}
                    isLoading={isLoadingModel}
                    progress={loadProgress?.percentage}
                    onLoad={() => loadTestModel()}
                    className="justify-center"
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground/70">Load once — subsequent chats are instant from cache.</div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs">
                {["Check deposit status", "Draft reply for delayed withdrawal", "Translate to Spanish", "Review my draft for tone", "KYC document help"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border border-[#1E293B] bg-[#121827]/60 px-3.5 py-1.5 hover:border-[#3B82F6]/40 hover:bg-[#121827] transition-all active:scale-[0.985]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-10 text-[10px] text-muted-foreground/60 tracking-widest uppercase">Type a message or use a sidebar tool</div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn("group flex gap-3", msg.role === "user" ? "justify-end" : "")}
            >
              {msg.role !== "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#1E293B] text-[#3B82F6]">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={cn("max-w-[82%] space-y-1.5", msg.role === "user" ? "items-end" : "")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-[#3B82F6] text-white rounded-br-md"
                      : "glass border border-white/5 rounded-bl-md",
                  )}
                >
                  {msg.content || (msg.isStreaming ? "…" : "")}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 align-[-1px] bg-white/70 animate-pulse" />
                  )}
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="pl-1 text-[10px] text-muted-foreground/70 flex gap-1.5 items-center">
                    Sources: {msg.sources.map((s, i) => (
                      <span key={i} className="rounded bg-[#121827] px-1.5 py-px border border-[#1E293B]">{s.source.split("/").pop()}</span>
                    ))}
                  </div>
                )}

                {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                  <div className="flex items-center gap-1.5 pl-1 opacity-70 group-hover:opacity-100 transition">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                      onClick={() => copyToClipboard(msg.content, msg.id)}
                    >
                      {copiedId === msg.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-[#3B82F6]"
                      onClick={() => handleUseAsResponse(msg.content)}
                    >
                      Use as response
                    </Button>
                  </div>
                )}
              </div>

              {msg.role === "user" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#1E293B] text-foreground/70">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages.length > 0 && !messages[messages.length - 1]?.isStreaming && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-10">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer */}
      <div className="border-t border-[#1E293B] bg-[#0A0F1C] p-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Cortex to draft a reply, improve text, or look up policy…"
              className="min-h-[92px] resize-y bg-[#121827] border-[#1E293B] pr-14 text-[15px] placeholder:text-muted-foreground/60 focus:border-[#3B82F6]/60"
              disabled={isStreaming}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="absolute bottom-3 right-3 h-8 w-8 btn-primary disabled:opacity-60"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-1.5 px-1 text-[10px] text-muted-foreground/60 flex justify-between">
            <span>Enter to send • Shift+Enter for newline • Esc to stop</span>
            <span>Local only • No data leaves this machine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
