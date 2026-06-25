import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAgentStore } from "@/stores/useAgentStore";
import { QUICK_TEMPLATES, type QuickTemplateKey } from "@/lib/prompts";
import { getEffectiveSystemPrompt } from "@/lib/settings";
import { streamCompletion } from "@/lib/qvac";
import { toast } from "sonner";
import {
  Loader2,
  Copy,
  Check,
  Plus,
  Pencil,
  Trash2,
  RotateCw,
  ChevronDown,
  Eye,
} from "lucide-react";
import { useToolModel } from "./useToolModel";
import { ToolLoadingPanel } from "./ToolLoadingPanel";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadCustomTemplates,
  addCustomTemplate,
  updateCustomTemplate,
  deleteCustomTemplate,
  loadHiddenBuiltins,
  hideBuiltin,
  restoreBuiltin,
  type CustomResponseTemplate,
} from "@/lib/responseTemplates";

const TEMPLATE_OPTIONS: { key: QuickTemplateKey; label: string; desc: string }[] = [
  { key: "withdrawalIssue", label: "Withdrawal Issue", desc: "Stuck/pending withdrawal, needs details" },
  { key: "depositMissing", label: "Deposit Not Credited", desc: "Missing deposit investigation" },
  { key: "kycHelp", label: "KYC / Verification", desc: "Documents or review help" },
  { key: "apiIssue", label: "API / Integration", desc: "Key, rate limit, signature problems" },
  { key: "securityConcern", label: "Security / Account", desc: "Compromised, 2FA, suspicious activity" },
  { key: "generalAck", label: "General Acknowledgement", desc: "Standard ticket received reply" },
];

type SelectedTemplate =
  | { kind: "builtin"; key: QuickTemplateKey }
  | { kind: "custom"; id: string };

interface TemplateForm {
  name: string;
  description: string;
  baseContent: string;
}

export function ResponseTemplates() {
  const [selected, setSelected] = useState<SelectedTemplate>({ kind: "builtin", key: "withdrawalIssue" });
  const [extraContext, setExtraContext] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const { statusText, ensureModelLoaded } = useToolModel("Generating professional reply…");

  // Custom templates + hidden builtins (both persisted in the same store)
  const [customTemplates, setCustomTemplates] = useState<CustomResponseTemplate[]>([]);
  const [hiddenBuiltins, setHiddenBuiltins] = useState<QuickTemplateKey[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Add/Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomResponseTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>({ name: "", description: "", baseContent: "" });

  // Full management dialog (rich list for administer / delete / etc.)
  const [manageOpen, setManageOpen] = useState(false);
  const [manageSearch, setManageSearch] = useState("");

  const settings = useAgentStore((s) => s.settings);

  // Load persisted custom templates + hidden builtins on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [customList, hiddenList] = await Promise.all([
          loadCustomTemplates(),
          loadHiddenBuiltins(),
        ]);
        if (mounted) {
          setCustomTemplates(customList);
          setHiddenBuiltins(hiddenList);
        }
      } catch (e) {
        console.warn("[ResponseTemplates] failed to load templates/hidden", e);
      } finally {
        if (mounted) setIsLoadingTemplates(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Keep selection valid: if current selected builtin was hidden, switch away
  useEffect(() => {
    if (selected.kind === "builtin" && hiddenBuiltins.includes(selected.key)) {
      const firstVisible = TEMPLATE_OPTIONS.find((o) => !hiddenBuiltins.includes(o.key));
      if (firstVisible) {
        setSelected({ kind: "builtin", key: firstVisible.key });
      } else if (customTemplates.length > 0) {
        setSelected({ kind: "custom", id: customTemplates[0].id });
      }
    }
  }, [hiddenBuiltins, selected, customTemplates]);

  // Resolve the base scenario text for the currently selected (builtin or custom)
  const getSelectedBaseContent = (): string => {
    if (selected.kind === "builtin") {
      return QUICK_TEMPLATES[selected.key];
    }
    const found = customTemplates.find((t) => t.id === selected.id);
    return found?.baseContent || "";
  };

  const generate = async () => {
    const base = getSelectedBaseContent();
    if (!base) {
      toast.error("No template selected or template content is empty");
      return;
    }

    setIsProcessing(true);
    setOutput("");

    try {
      const systemPrompt = await getEffectiveSystemPrompt();

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

      const modelId = await ensureModelLoaded();

      let full = "";
      const result = await streamCompletion({
        modelId,
        history,
        temperature: settings?.temperature ?? 0.2,
        maxTokens: 1200,
        onToken: (delta) => {
          full += delta;
          setOutput(full);
        },
      });

      const finalText = (result.text || full).trim();
      setOutput(finalText);
      if (finalText) {
        toast.success("Template generated");
      } else if (result.thinking?.trim()) {
        // Reasoning model spent its budget thinking and never emitted a final answer.
        toast.error("No final answer", {
          description: "The model reasoned but didn't produce a reply. Try again or raise Max tokens in Settings.",
        });
      } else {
        toast.error("No text returned", { description: "The model returned nothing. Try again." });
      }
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

  // --- Custom template admin handlers ---

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", description: "", baseContent: "" });
    setDialogOpen(true);
  };

  const openEdit = (tpl: CustomResponseTemplate) => {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      description: tpl.description || "",
      baseContent: tpl.baseContent,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    // small delay so state doesn't flash while closing
    setTimeout(() => {
      setEditing(null);
      setForm({ name: "", description: "", baseContent: "" });
    }, 150);
  };

  const handleSaveTemplate = async () => {
    const name = form.name.trim();
    const base = form.baseContent.trim();
    if (!name || !base) {
      toast.error("Name and base scenario text are required");
      return;
    }

    try {
      if (editing) {
        const updated = await updateCustomTemplate(editing.id, {
          name,
          description: form.description.trim() || undefined,
          baseContent: base,
        });
        if (updated) {
          setCustomTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          // keep selection on it
          setSelected({ kind: "custom", id: updated.id });
          toast.success("Template updated");
        }
      } else {
        const created = await addCustomTemplate({
          name,
          description: form.description.trim() || undefined,
          baseContent: base,
        });
        setCustomTemplates((prev) => [created, ...prev]);
        setSelected({ kind: "custom", id: created.id });
        toast.success("Custom template created");
      }
      closeDialog();
    } catch (e: any) {
      toast.error("Failed to save template", { description: e?.message });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete custom template "${name}"?`)) return;
    try {
      const ok = await deleteCustomTemplate(id);
      if (ok) {
        setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
        // If the deleted one was selected, fall back to first builtin
        if (selected.kind === "custom" && selected.id === id) {
          setSelected({ kind: "builtin", key: "withdrawalIssue" });
        }
        toast.success("Template deleted");
      }
    } catch (e: any) {
      toast.error("Failed to delete", { description: e?.message });
    }
  };

  const handleCustomizeBuiltin = (key: QuickTemplateKey, label: string) => {
    const base = QUICK_TEMPLATES[key];
    setEditing(null);
    setForm({
      name: label,
      description: "",
      baseContent: base,
    });
    setDialogOpen(true);
  };

  // Hide (user "delete") a built-in from their personal view
  const handleHideBuiltin = async (key: QuickTemplateKey, label: string) => {
    if (!confirm(`Remove "${label}" from your Common ticket types? You can restore it later from Manage.`)) {
      return;
    }
    try {
      await hideBuiltin(key);
      const nextHidden = await loadHiddenBuiltins(); // re-read to be safe
      setHiddenBuiltins(nextHidden);

      // If the currently selected one was just hidden, fall back
      if (selected.kind === "builtin" && selected.key === key) {
        const firstVisible = TEMPLATE_OPTIONS.find((o) => !nextHidden.includes(o.key));
        if (firstVisible) {
          setSelected({ kind: "builtin", key: firstVisible.key });
        } else if (customTemplates.length > 0) {
          setSelected({ kind: "custom", id: customTemplates[0].id });
        }
      }

      toast.success(`"${label}" hidden from your list`);
    } catch (e: any) {
      toast.error("Failed to hide", { description: e?.message });
    }
  };

  const handleRestoreBuiltin = async (key: QuickTemplateKey, label: string) => {
    try {
      await restoreBuiltin(key);
      const nextHidden = await loadHiddenBuiltins();
      setHiddenBuiltins(nextHidden);
      toast.success(`"${label}" restored`);
    } catch (e: any) {
      toast.error("Failed to restore", { description: e?.message });
    }
  };

  const isBuiltinSelected = (key: QuickTemplateKey) =>
    selected.kind === "builtin" && selected.key === key;
  const isCustomSelected = (id: string) =>
    selected.kind === "custom" && selected.id === id;

  // Only show builtins that the user hasn't hidden/removed
  const visibleBuiltins = TEMPLATE_OPTIONS.filter(
    (opt) => !hiddenBuiltins.includes(opt.key)
  );

  // Human label of the currently selected scenario (for the persistent indicator)
  const selectedName =
    selected.kind === "builtin"
      ? TEMPLATE_OPTIONS.find((o) => o.key === selected.key)?.label || "—"
      : customTemplates.find((t) => t.id === selected.id)?.name || "—";

  // Filtered list for the Manage dialog (only customs for now, builtins are shown separately)
  const filteredCustoms = useMemo(() => {
    const q = manageSearch.trim().toLowerCase();
    if (!q) return customTemplates;
    return customTemplates.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  }, [customTemplates, manageSearch]);

  return (
    <div className="space-y-6">
      {/* Unified scenario picker — built-ins + customs as peers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">
            Scenarios
            {customTemplates.length > 0 && (
              <span className="ml-1.5 text-muted-foreground font-normal">· {customTemplates.length} custom</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setManageOpen(true)}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Manage
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={openNew}
              className="h-7 px-2 text-xs gap-1 border-[#1E293B]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>

        {isLoadingTemplates ? (
          <div className="text-xs text-muted-foreground py-2">Loading your templates…</div>
        ) : visibleBuiltins.length === 0 && customTemplates.length === 0 ? (
          <div className="text-xs text-muted-foreground py-3 border border-dashed border-[#1E293B] rounded-lg px-3">
            No scenarios available. <span className="font-medium">Add</span> your team’s recurring cases, or restore the built-in ones from <span className="font-medium">Manage</span>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Built-in scenarios */}
            {visibleBuiltins.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelected({ kind: "builtin", key: opt.key })}
                className={cn(
                  "group text-left rounded-xl border p-3 transition hover:border-[#3B82F6]/40 relative",
                  isBuiltinSelected(opt.key)
                    ? "border-[#3B82F6] bg-[#121827]"
                    : "border-[#1E293B] bg-[#121827]/40"
                )}
              >
                <div className="font-medium text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>

                {/* Quick way to turn a builtin into a starting point for a custom */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCustomizeBuiltin(opt.key, opt.label);
                  }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/10 transition"
                  title="Create custom template based on this"
                >
                  Customize
                </button>
              </button>
            ))}

            {/* Custom scenarios */}
            {customTemplates.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setSelected({ kind: "custom", id: tpl.id })}
                className={cn(
                  "group text-left rounded-xl border p-3 transition hover:border-[#3B82F6]/40 relative",
                  isCustomSelected(tpl.id)
                    ? "border-[#3B82F6] bg-[#121827]"
                    : "border-[#1E293B] bg-[#121827]/40"
                )}
              >
                <div className="flex items-center gap-1.5 pr-14">
                  <span className="font-medium text-sm truncate">{tpl.name}</span>
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-[#1E293B] text-muted-foreground">Custom</span>
                </div>
                {tpl.description ? (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {tpl.description}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    Updated {formatDistanceToNow(new Date(tpl.updatedAt), { addSuffix: true })}
                  </div>
                )}

                {/* Admin actions (do not trigger selection) */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(tpl);
                    }}
                    className="p-1 rounded hover:bg-[#1E293B] text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tpl.id, tpl.name);
                    }}
                    className="p-1 rounded hover:bg-[#1E293B] text-muted-foreground hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compose zone: selected scenario + preview + extra context + generate */}
      <div className="space-y-3 rounded-xl border border-[#1E293B] bg-[#121827]/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm min-w-0">
            <span className="text-muted-foreground">Selected:</span>{" "}
            <span className="font-medium">{selectedName}</span>
          </div>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
            title="Show the base scenario text that guides the model"
          >
            <Eye className="h-3 w-3" />
            Preview
            <ChevronDown className={cn("h-3 w-3 transition-transform", showPreview && "rotate-180")} />
          </button>
        </div>

        {showPreview && (
          <div className="glass border border-[#1E293B] rounded-lg p-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {getSelectedBaseContent() || "This scenario has no base text."}
          </div>
        )}

        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Extra context (optional)</div>
          <Textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            placeholder="E.g. Customer TXID: abc123, amount 0.45 BTC, sent 3h ago, from external wallet..."
            className="min-h-[90px] bg-[#121827] border-[#1E293B]"
          />
        </div>

        <Button onClick={generate} disabled={isProcessing} className="btn-primary gap-2">
          {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isProcessing ? "Generating…" : "Generate Professional Reply"}
        </Button>
      </div>

      {isProcessing && !output ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Generated response</div>
          <ToolLoadingPanel statusText={statusText} minH="min-h-[140px]" />
        </div>
      ) : output ? (
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            Generated response
            {isProcessing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </div>
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
            <Button variant="ghost" onClick={generate} disabled={isProcessing} className="gap-2">
              <RotateCw className="h-4 w-4" />
              Regenerate
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Generated using the live CS Agent prompt + tone rules from Settings. Great starting point — always review before sending.
      </p>

      {/* Add / Edit Custom Template Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent className="max-w-lg bg-[#0A0F1C] border-[#1E293B]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit custom template" : "New custom template"}</DialogTitle>
            <DialogDescription>
              The base scenario text is used exactly like the built-in ones to guide the model. Add as much detail as you want.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="tpl-name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. VIP Corporate Withdrawal"
                className="mt-1 bg-[#121827] border-[#1E293B]"
              />
            </div>

            <div>
              <Label htmlFor="tpl-desc" className="text-xs text-muted-foreground">Short description (optional)</Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="For high-value clients, > $50k, multi-chain"
                className="mt-1 bg-[#121827] border-[#1E293B]"
              />
            </div>

            <div>
              <Label htmlFor="tpl-base" className="text-xs text-muted-foreground">Base scenario text</Label>
              <Textarea
                id="tpl-base"
                value={form.baseContent}
                onChange={(e) => setForm((f) => ({ ...f, baseContent: e.target.value }))}
                placeholder="Thank you for reaching out. To assist with the withdrawal please provide: 1. Withdrawal ID or TXID..."
                className="mt-1 min-h-[140px] font-mono text-sm bg-[#121827] border-[#1E293B]"
              />
              <div className="text-[10px] text-muted-foreground mt-1">
                This text is injected into the prompt as the “Scenario template”. The model will adapt it with the current tone + any extra context you provide.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} className="btn-primary">
              {editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Templates Dialog — now includes both hardcoded (built-in) + custom so user can "delete"/hide any of them */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl bg-[#0A0F1C] border-[#1E293B]">
          <DialogHeader>
            <DialogTitle>Manage templates</DialogTitle>
            <DialogDescription>
              All templates (built-in + your customs). You can hide/remove built-in ones from your "Common ticket types" picker and restore them anytime. Customs can be fully edited or deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-1">
            <Input
              placeholder="Search your custom templates…"
              value={manageSearch}
              onChange={(e) => setManageSearch(e.target.value)}
              className="bg-[#121827] border-[#1E293B]"
            />
            <Button
              onClick={() => {
                setManageOpen(false);
                openNew();
              }}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" /> New custom
            </Button>
          </div>

          {/* Built-in (hardcoded) templates — user can hide them here */}
          <div className="mt-2">
            <div className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-1.5 px-1">Built-in templates</div>
            <div className="max-h-[220px] overflow-auto rounded-lg border border-[#1E293B] divide-y divide-[#1E293B] bg-[#0A0F1C] mb-4">
              {TEMPLATE_OPTIONS.map((opt) => {
                const isHidden = hiddenBuiltins.includes(opt.key);
                return (
                  <div
                    key={opt.key}
                    className="flex items-start justify-between gap-4 p-3 hover:bg-[#121827]/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{opt.label}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-muted-foreground">Built-in</span>
                        {isHidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400">Hidden</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      {!isHidden ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-400 hover:text-red-400 hover:bg-red-950/30"
                          onClick={() => handleHideBuiltin(opt.key, opt.label)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-[#1E293B]"
                          onClick={() => handleRestoreBuiltin(opt.key, opt.label)}
                        >
                          Restore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setManageOpen(false);
                          handleCustomizeBuiltin(opt.key, opt.label);
                        }}
                      >
                        Customize
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom user templates */}
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground/70 mb-1.5 px-1">Your custom templates</div>
            <div className="max-h-[260px] overflow-auto rounded-lg border border-[#1E293B] divide-y divide-[#1E293B] bg-[#0A0F1C]">
              {filteredCustoms.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {manageSearch
                    ? "No custom templates match your search."
                    : customTemplates.length === 0
                      ? "No custom templates yet."
                      : "No matches."}
                </div>
              ) : (
                filteredCustoms.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="flex items-start justify-between gap-4 p-3 hover:bg-[#121827]/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{tpl.name}</div>
                      {tpl.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tpl.description}</div>
                      )}
                      <div className="mt-1 text-[10px] text-muted-foreground/70">
                        Created {formatDistanceToNow(new Date(tpl.createdAt), { addSuffix: true })}
                        {tpl.updatedAt !== tpl.createdAt && (
                          <> · updated {formatDistanceToNow(new Date(tpl.updatedAt), { addSuffix: true })}</>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => {
                          setManageOpen(false);
                          setSelected({ kind: "custom", id: tpl.id });
                        }}
                      >
                        Use
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs border-[#1E293B] gap-1"
                        onClick={() => {
                          setManageOpen(false);
                          openEdit(tpl);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-red-400 hover:text-red-400 hover:bg-red-950/30"
                        onClick={() => {
                          setManageOpen(false);
                          handleDelete(tpl.id, tpl.name);
                        }}
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
