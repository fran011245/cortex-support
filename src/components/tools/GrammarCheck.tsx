import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentStore } from "@/stores/useAgentStore";
import { getEffectiveSystemPrompt } from "@/lib/settings";
import { streamCompletion } from "@/lib/qvac";
import { toast } from "sonner";
import { Loader2, Copy, Check, ArrowRight } from "lucide-react";
import { useToolModel } from "./useToolModel";
import { ToolLoadingPanel } from "./ToolLoadingPanel";

export function GrammarCheck() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const settings = useAgentStore((s) => s.settings);
  const { statusText, ensureModelLoaded } = useToolModel("Improving your text…");

  const runCheck = async () => {
    if (!input.trim()) {
      toast.error("Please enter some text to check");
      return;
    }

    setIsProcessing(true);
    setOutput("");

    try {
      const systemPrompt = await getEffectiveSystemPrompt();

      const task = `Perform a Grammar & Style Check on the support-related text below.

Rules (in addition to the system prompt above):
- Correct grammar, spelling, punctuation, and sentence structure.
- Make it professional, direct, pragmatic, clear and concise.
- Enforce professional support tone: no emojis, no fluff, no overly friendly language, be security-aware where relevant.
- Improve flow and scannability (short paragraphs, bullets if it helps).
- Preserve all factual details, numbers, names, and the original intent exactly.
- Output ONLY the cleaned/improved version. Do not add meta comments like "Here's the improved version:" or explanations.

Original text to improve:
${input.trim()}

Improved version:`;

      const history = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: task },
      ];

      const modelId = await ensureModelLoaded();

      let full = "";
      const result = await streamCompletion({
        modelId,
        history,
        temperature: Math.min(settings?.temperature ?? 0.2, 0.3), // low temp for style/grammar
        maxTokens: 2048,
        onToken: (delta) => {
          full += delta;
          setOutput(full);
        },
      });

      const finalText = (result.text || full).trim();
      setOutput(finalText);
      if (finalText) {
        toast.success("Style & grammar improved");
      } else if (result.thinking?.trim()) {
        // Reasoning model spent its budget thinking and never emitted a final answer.
        toast.error("No final answer", {
          description: "The model reasoned but didn't produce a reply. Try again or raise Max tokens in Settings.",
        });
      } else {
        toast.error("No text returned", { description: "The model returned nothing. Try again." });
      }
    } catch (e: any) {
      toast.error("Check failed", { description: e?.message || "See console" });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const useInChat = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    useAgentStore.getState().setActiveTool("chat");
    toast.info("Copied — switch to chat and paste or use as response");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium mb-2">Text to improve</div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the draft reply, customer message, or note you want to polish for professional tone and correctness..."
          className="min-h-[140px] bg-[#121827] border-[#1E293B]"
        />
      </div>

      <div className="flex gap-3">
        <Button onClick={runCheck} disabled={isProcessing || !input.trim()} className="btn-primary gap-2">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {isProcessing ? "Improving..." : "Improve with Professional Tone"}
        </Button>
        {output && (
          <>
            <Button variant="outline" onClick={copyOutput} className="gap-2 border-[#1E293B]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy
            </Button>
            <Button variant="ghost" onClick={useInChat} className="gap-2">
              Use as Response
            </Button>
          </>
        )}
      </div>

      {isProcessing && !output ? (
        <div>
          <div className="text-sm font-medium mb-2 flex items-center gap-2">
            Improved version
            <span className="text-[10px] text-muted-foreground font-normal">(enforces current agent settings)</span>
          </div>
          <ToolLoadingPanel statusText={statusText} minH="min-h-[120px]" />
        </div>
      ) : output ? (
        <div>
          <div className="text-sm font-medium mb-2 flex items-center gap-2">
            Improved version
            {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            <span className="text-[10px] text-muted-foreground font-normal">(enforces current agent settings)</span>
          </div>
          <div className="glass border border-[#1E293B] rounded-xl p-4 whitespace-pre-wrap text-sm leading-relaxed min-h-[120px]">
            {output}
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Uses your current CS Settings (system prompt + tone rules) + low temperature for consistent, high-quality style fixes.
      </p>
    </div>
  );
}
