import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgentStore } from "@/stores/useAgentStore";
import { QUICK_TEMPLATES, type QuickTemplateKey } from "@/lib/prompts";
import { getEffectiveSystemPrompt } from "@/lib/settings";
import { streamCompletion } from "@/lib/qvac";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATE_OPTIONS: { key: QuickTemplateKey; label: string; desc: string }[] = [
  { key: "withdrawalIssue", label: "Withdrawal Issue", desc: "Stuck/pending withdrawal, needs details" },
  { key: "depositMissing", label: "Deposit Not Credited", desc: "Missing deposit investigation" },
  { key: "kycHelp", label: "KYC / Verification", desc: "Documents or review help" },
  { key: "apiIssue", label: "API / Integration", desc: "Key, rate limit, signature problems" },
  { key: "securityConcern", label: "Security / Account", desc: "Compromised, 2FA, suspicious activity" },
  { key: "generalAck", label: "General Acknowledgement", desc: "Standard ticket received reply" },
];

export function ResponseTemplates() {
  const [selected, setSelected] = useState<QuickTemplateKey>("withdrawalIssue");
  const [extraContext, setExtraContext] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentModelId = useAgentStore((s) => s.currentModelId);
  const settings = useAgentStore((s) => s.settings);

  const generate = async () => {
    setIsProcessing(true);
    setOutput("");

    try {
      const systemPrompt = await getEffectiveSystemPrompt();

      const base = QUICK_TEMPLATES[selected];
      const contextNote = extraContext.trim()
        ? `\n\nAdditional context from the ticket (use this to customize):\n${extraContext.trim()}`
        : "";

      const task = `Using the professional support guidelines and tone in the system prompt, generate a high-quality, ready-to-send customer reply for the following common scenario.

Scenario template (base structure and recommended points):
${base}
${contextNote}

Instructions:
- Start directly with the customer-facing text (no "Here's a draft" or meta).
- Follow all current tone rules (full sentences, direct but polite, security emphasis, no emojis, concise where possible).
- Incorporate the additional context naturally.
- Make it feel written by an expert support agent.
- End with a clear next step or request for information if needed.

Output only the final reply text.`;

      const history = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: task },
      ];

      const modelId = currentModelId || settings?.defaultModelId || "";
      if (!modelId) {
        toast.error("Load a model first (use the button in chat header or Settings).");
        setIsProcessing(false);
        return;
      }

      let full = "";
      await streamCompletion({
        modelId,
        history,
        temperature: settings?.temperature ?? 0.2,
        maxTokens: 1200,
        onToken: (delta) => {
          full += delta;
          setOutput(full);
        },
      });

      setOutput(full.trim());
      toast.success("Template generated");
    } catch (e: any) {
      toast.error("Generation failed", { description: e?.message });
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
    toast.info("Copied — paste into chat or your ticket tool");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium mb-2">Common ticket type</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelected(opt.key)}
              className={cn(
                "text-left rounded-xl border p-3 transition hover:border-[#3B82F6]/40",
                selected === opt.key
                  ? "border-[#3B82F6] bg-[#121827]"
                  : "border-[#1E293B] bg-[#121827]/40"
              )}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Extra context (optional)</div>
        <Textarea
          value={extraContext}
          onChange={(e) => setExtraContext(e.target.value)}
          placeholder="E.g. Customer TXID: abc123, amount 0.45 BTC, sent 3h ago, from external wallet..."
          className="min-h-[90px] bg-[#121827] border-[#1E293B]"
        />
      </div>

      <Button onClick={generate} disabled={isProcessing} className="btn-primary gap-2">
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate Professional Reply
      </Button>

      {output && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Generated response</div>
          <div className="glass border border-[#1E293B] rounded-xl p-4 whitespace-pre-wrap text-sm leading-relaxed min-h-[140px]">
            {output}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyOutput} className="gap-2 border-[#1E293B]">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy
            </Button>
            <Button variant="ghost" onClick={useInChat} className="gap-2">
              Use as Response
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Generated using the live CS Agent prompt + tone rules from Settings. Great starting point — always review before sending.
      </p>
    </div>
  );
}
