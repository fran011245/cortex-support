import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAgentStore } from "@/stores/useAgentStore";
import { getEffectiveSystemPrompt } from "@/lib/settings";
import { streamCompletion } from "@/lib/qvac";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";

const LANGUAGES = [
  { code: "es", label: "Spanish (ES)" },
  { code: "en", label: "English (EN)" },
  { code: "fr", label: "French (FR)" },
  { code: "pt", label: "Portuguese (PT)" },
  { code: "de", label: "German (DE)" },
  { code: "it", label: "Italian (IT)" },
  { code: "zh", label: "Chinese (ZH)" },
];

export function SmartTranslate() {
  const [input, setInput] = useState("");
  const [fromLang, setFromLang] = useState("en");
  const [toLang, setToLang] = useState("es");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentModelId = useAgentStore((s) => s.currentModelId);
  const settings = useAgentStore((s) => s.settings);

  const swap = () => {
    setFromLang(toLang);
    setToLang(fromLang);
  };

  const runTranslate = async () => {
    if (!input.trim()) {
      toast.error("Enter text to translate");
      return;
    }
    if (fromLang === toLang) {
      toast.error("Source and target languages must be different");
      return;
    }

    setIsProcessing(true);
    setOutput("");

    try {
      const systemPrompt = await getEffectiveSystemPrompt();

      const fromLabel = LANGUAGES.find((l) => l.code === fromLang)?.label || fromLang;
      const toLabel = LANGUAGES.find((l) => l.code === toLang)?.label || toLang;

      const task = `You are a professional translator for Bitfinex Customer Support.

Translate the following text from ${fromLabel} to ${toLabel}.

Requirements:
- Preserve the exact original meaning, numbers, names, technical terms (TXID, wallet address, etc.), and intent.
- After translating, lightly polish the result to match Bitfinex support tone (professional, direct, pragmatic, clear, concise, no emojis, security-aware where appropriate) while staying faithful to the source.
- Do not add or remove information.
- Output ONLY the final translated + polished text. No prefixes, no explanations.

Text to translate:
${input.trim()}

Translated version in ${toLabel}:`;

      const history = [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: task },
      ];

      const modelId = currentModelId || settings?.defaultModelId || "";
      if (!modelId) {
        toast.error("No model loaded. Load one in Chat or set in Settings.");
        setIsProcessing(false);
        return;
      }

      let full = "";
      await streamCompletion({
        modelId,
        history,
        temperature: 0.15,
        maxTokens: 2048,
        onToken: (delta) => {
          full += delta;
          setOutput(full);
        },
      });

      setOutput(full.trim());
      toast.success(`Translated to ${toLabel}`);
    } catch (e: any) {
      toast.error("Translation failed", { description: e?.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1400);
  };

  const useInChat = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    useAgentStore.getState().setActiveTool("chat");
    toast.info("Copied to clipboard — ready for chat or external use");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <div className="text-sm mb-1.5">From</div>
          <Select value={fromLang} onValueChange={setFromLang}>
            <SelectTrigger className="bg-[#121827] border-[#1E293B]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center md:pb-2">
          <Button variant="ghost" size="icon" onClick={swap} className="h-9 w-9" title="Swap languages">
            ↔
          </Button>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm mb-1.5">To</div>
          <Select value={toLang} onValueChange={setToLang}>
            <SelectTrigger className="bg-[#121827] border-[#1E293B]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium mb-2">Text to translate</div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste customer message or draft to translate while preserving Bitfinex professional tone..."
          className="min-h-[120px] bg-[#121827] border-[#1E293B]"
        />
      </div>

      <div>
        <Button onClick={runTranslate} disabled={isProcessing || !input.trim()} className="btn-primary gap-2">
          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isProcessing ? "Translating..." : "Translate & Polish"}
        </Button>
      </div>

      {output && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Result ({LANGUAGES.find((l) => l.code === toLang)?.label})</div>
          <div className="glass border border-[#1E293B] rounded-xl p-4 whitespace-pre-wrap text-sm leading-relaxed min-h-[100px]">
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
        Smart translate uses the current CS Agent prompt so the result stays on-tone for Bitfinex support.
      </p>
    </div>
  );
}
