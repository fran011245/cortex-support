import { useState, useRef, useEffect, useMemo } from "react";
import { useAgentStore } from "@/stores/useAgentStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, Check, Bot, User, Loader2, RefreshCw, ClipboardPaste, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadLocalModel, streamCompletion, initQVAC } from "@/lib/qvac";
import { getEffectiveSystemPrompt, DEFAULT_LLM_MODEL, RECOMMENDED_LLM_MODELS } from "@/lib/settings";
import { ModelStatus } from "@/components/ModelStatus";
import { detectTicketType } from "@/lib/ticketDetection";

// Custom markdown components styled for the Cortex dark theme.
const mdComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
  code: ({ className, children }) => {
    const isBlock = !!className;
    return isBlock ? (
      <code className="font-mono text-[12px] text-emerald-400">{children}</code>
    ) : (
      <code className="bg-[#0A0F1C] rounded px-1 py-0.5 text-[12px] font-mono text-[#3B82F6]">{children}</code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-[#0A0F1C] border border-[#1E293B] rounded-lg px-3 py-2.5 my-2 overflow-x-auto text-xs font-mono">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-[#3B82F6]/50 pl-3 my-2 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => <h1 className="font-semibold text-base mb-1.5 mt-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="font-semibold text-sm mb-1 mt-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="font-medium text-sm mb-1 mt-2 first:mt-0">{children}</h3>,
  hr: () => <hr className="border-[#1E293B] my-3" />,

  // GFM tables + basic structure
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded border border-[#1E293B]">
      <table className="min-w-full text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#0A0F1C]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-[#1E293B] bg-[#121827]/30">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-[#1E293B] last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="border-r border-[#1E293B] px-2 py-1 text-left font-semibold text-foreground/90 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-r border-[#1E293B] px-2 py-1 align-top text-foreground/90 last:border-r-0">
      {children}
    </td>
  ),
};

export function ChatInterface() {
  const {
    currentSession,
    appendMessage,
    updateLastMessage,
    removeLastAssistantMessage,
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
  const [loadProgress, setLoadProgress] = useState<{ percentage?: number } | null>(null);
  const [ticketInput, setTicketInput] = useState("");
  const [isTicketPaneOpen, setIsTicketPaneOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ticketRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const messages = currentSession?.messages ?? [];

  const detectedType = useMemo(() => detectTicketType(ticketInput), [ticketInput]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Auto-expand main composer
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [input]);

  // Auto-expand ticket textarea
  useEffect(() => {
    const el = ticketRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 220) + "px";
  }, [ticketInput]);

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

  const loadTestModel = async (modelSrcOverride?: string, silent = false) => {
    setIsLoadingModel(true);
    setLoadProgress(null);
    try {
      await initQVAC();
      const src = modelSrcOverride || settings?.defaultModelId || DEFAULT_LLM_MODEL;
      const handle = await loadLocalModel({
        modelSrc: src,
        modelType: "llamacpp-completion",
        modelConfig: { ctx_size: 4096 },
        onProgress: (p) => setLoadProgress(p),
      });
      setModelId(handle);
      if (!silent) {
        const label = RECOMMENDED_LLM_MODELS.find((m) => m.id === src)?.label || src;
        toast.success("Model loaded", { description: `${label} ready` });
      }
    } catch (e: any) {
      toast.error("Failed to load model", { description: e?.message || "Check console for errors" });
    } finally {
      setIsLoadingModel(false);
      setLoadProgress(null);
    }
  };

  // Core generation — accepts optional text so regenerate can bypass the input field.
  const sendMessageWithText = async (userText: string) => {
    appendMessage({ role: "user", content: userText });
    appendMessage({ role: "assistant", content: "", isStreaming: true });

    setStreaming(true);
    setLoading(true);

    const systemPrompt = await getEffectiveSystemPrompt();
    let state = useAgentStore.getState();
    const sessionMessages = state.currentSession?.messages || [];
    const turnsForModel = sessionMessages.slice(0, -1);

    const conversation = turnsForModel
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    let fullHistory = [
      { role: "system" as const, content: systemPrompt },
      ...conversation,
    ];

    // RAG: inject relevant KB chunks when enabled
    let sources: any[] = [];
    if (state.settings?.ragEnabled && state.settings?.ragFolderPath) {
      try {
        const { searchKnowledge } = await import("@/lib/rag");
        const hits = await searchKnowledge(userText, "cortex-kb", 5);
        if (hits.length > 0) {
          sources = hits;
          const contextBlock = hits
            .map((h: any, i: number) => `[Source ${i + 1}: ${h.source}]\n${h.text}`)
            .join("\n\n");
          fullHistory = [
            fullHistory[0],
            { role: "system" as const, content: `Relevant internal knowledge (cite sources by number if used):\n${contextBlock}` },
            ...fullHistory.slice(1),
          ];
        }
      } catch (e) {
        console.warn("[RAG] search failed", e);
      }
    }

    // Ensure model is loaded — auto-load on first send if needed
    const desiredSrc = state.settings?.defaultModelId || DEFAULT_LLM_MODEL;
    let modelId = state.currentModelId;
    if (!modelId) {
      toast.info(`Loading model…`);
      try {
        await loadTestModel(desiredSrc, true);
        state = useAgentStore.getState();
        modelId = state.currentModelId || "";
      } catch {
        // will surface in stream call
      }
    }
    if (!modelId) modelId = desiredSrc;

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
          const msgs = useAgentStore.getState().currentSession?.messages || [];
          const last = msgs[msgs.length - 1] as any;
          updateLastMessage({ thinking: ((last?.thinking || "") + delta) });
        },
        signal: controller.signal,
      });

      updateLastMessage({
        content: result.text || liveText,
        isStreaming: false,
        thinking: result.thinking,
        sources: sources.length ? sources : undefined,
      });
    } catch (e: any) {
      const msgs = useAgentStore.getState().currentSession?.messages || [];
      const lastContent = msgs[msgs.length - 1]?.content || "";
      if (e?.name === "AbortError" || String(e?.message || "").includes("Abort")) {
        updateLastMessage({ content: (liveText || lastContent) + "\n\n[stopped]", isStreaming: false });
      } else {
        updateLastMessage({
          content: (liveText || lastContent) + `\n\n[error: ${e?.message || "Model error"}]`,
          isStreaming: false,
        });
        toast.error("Generation failed", { description: e?.message });
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendMessageWithText(text);
  };

  const handleRegenerate = async () => {
    if (isStreaming) return;
    const userText = removeLastAssistantMessage();
    if (!userText) return;
    await sendMessageWithText(userText);
  };

  const handleTicketDraft = async () => {
    const ticket = ticketInput.trim();
    if (!ticket) return;
    setTicketInput("");
    setIsTicketPaneOpen(false);
    const label = detectedType ? ` (${detectedType})` : "";
    const prompt = `The following is a real customer support message${label}. Draft a clear, professional, direct reply that the agent can copy-paste. Use the customer's details exactly. Be concise but complete.\n\n---\n${ticket}\n---`;
    await sendMessageWithText(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === "Escape" && isStreaming) handleAbort();
  };

  const handleTicketKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsTicketPaneOpen(false);
      setTicketInput("");
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    abortCurrent();
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
          {currentModelId && !isStreaming && (
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
            <div className="py-12 text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-3xl bg-[#121827] ring-1 ring-inset ring-white/10">
                <Bot className="h-7 w-7 text-[#3B82F6]" />
              </div>
              <div className="text-2xl font-semibold tracking-[-0.5px]">How can I help with this ticket?</div>
              <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
                Paste a customer message for an instant draft, or describe the situation in the chat below.
              </p>

              {!currentModelId && (
                <div className="mt-4 flex flex-col items-center gap-1">
                  <ModelStatus
                    currentModelId={currentModelId}
                    defaultModelId={settings?.defaultModelId}
                    isLoading={isLoadingModel}
                    progress={loadProgress?.percentage}
                    onLoad={() => loadTestModel()}
                    className="justify-center"
                  />
                  <div className="text-[10px] text-muted-foreground/60">Load once — subsequent chats are instant from cache.</div>
                </div>
              )}

              {/* Ticket paste panel */}
              <div className="mt-8 mx-auto max-w-xl">
                {!isTicketPaneOpen ? (
                  <button
                    onClick={() => { setIsTicketPaneOpen(true); setTimeout(() => ticketRef.current?.focus(), 50); }}
                    className="w-full flex items-center gap-3 rounded-xl border border-dashed border-[#1E293B] bg-[#121827]/40 px-5 py-4 text-left hover:border-[#3B82F6]/40 hover:bg-[#121827]/70 transition-all group"
                  >
                    <ClipboardPaste className="h-5 w-5 text-[#3B82F6]/60 group-hover:text-[#3B82F6] shrink-0 transition-colors" />
                    <div>
                      <div className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">Paste a customer message</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Cortex will draft a ready-to-send reply instantly</div>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-xl border border-[#3B82F6]/30 bg-[#121827] p-4 text-left shadow-lg shadow-[#3B82F6]/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ClipboardPaste className="h-4 w-4 text-[#3B82F6]" />
                        <span className="text-sm font-medium">Customer message</span>
                        {detectedType && (
                          <span className="rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 px-2 py-0.5 text-[10px] text-[#3B82F6] font-medium">
                            {detectedType}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setIsTicketPaneOpen(false); setTicketInput(""); }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      ref={ticketRef}
                      value={ticketInput}
                      onChange={(e) => setTicketInput(e.target.value)}
                      onKeyDown={handleTicketKeyDown}
                      placeholder="Paste the customer's message here…"
                      className="w-full min-h-[100px] resize-none bg-[#0A0F1C] border border-[#1E293B] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#3B82F6]/50 focus:outline-none focus:ring-0 transition-colors"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[10px] text-muted-foreground/60">
                        Esc to cancel
                      </div>
                      <Button
                        onClick={handleTicketDraft}
                        disabled={!ticketInput.trim() || isStreaming}
                        className="btn-primary h-8 px-4 text-sm gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Draft reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick chips */}
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
                {["Draft reply for delayed withdrawal", "KYC document requirements", "API key troubleshooting", "Translate to Spanish", "Review my draft for tone"].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setInput(ex)}
                    className="rounded-full border border-[#1E293B] bg-[#121827]/60 px-3.5 py-1.5 hover:border-[#3B82F6]/40 hover:bg-[#121827] transition-all active:scale-[0.985]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mt-8 text-[10px] text-muted-foreground/50 tracking-widest uppercase">Or use a sidebar tool</div>
            </div>
          )}

          {messages.map((msg, idx) => (
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
                    "rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed",
                    msg.role === "user"
                      ? "bg-[#3B82F6] text-white rounded-br-md whitespace-pre-wrap"
                      : "glass border border-white/5 rounded-bl-md",
                  )}
                >
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                        {msg.content || (msg.isStreaming ? "…" : "")}
                      </ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 align-[-1px] bg-white/70 animate-pulse" />
                      )}
                    </>
                  ) : (
                    msg.content
                  )}
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="pl-1 text-[10px] text-muted-foreground/70 flex flex-wrap gap-1.5 items-center">
                    <span>Sources:</span>
                    {msg.sources.map((s, i) => (
                      <span key={i} className="rounded bg-[#121827] px-1.5 py-px border border-[#1E293B]">
                        {s.source.split("/").pop()}
                      </span>
                    ))}
                  </div>
                )}

                {msg.role === "assistant" && msg.content && !msg.isStreaming && (
                  <div className="flex items-center gap-1.5 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
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
                    {/* Only show Regenerate on the last assistant message */}
                    {idx === messages.length - 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={handleRegenerate}
                        disabled={isStreaming}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Regenerate
                      </Button>
                    )}
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
              placeholder="Describe the situation, ask for a draft, or request edits…"
              className="min-h-[72px] max-h-[280px] overflow-y-auto resize-none bg-[#121827] border-[#1E293B] pr-14 text-[15px] placeholder:text-muted-foreground/60 focus:border-[#3B82F6]/60"
              disabled={isStreaming}
              rows={1}
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
          <div className="mt-1.5 px-1 text-[10px] text-muted-foreground/50 flex justify-between">
            <span>Enter to send · Shift+Enter for newline · Esc to stop</span>
            <span>100% local · no data leaves this machine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
