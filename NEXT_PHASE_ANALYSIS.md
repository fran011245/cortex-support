# Cortex — Next Phase Analysis

> Deep product read based on the actual codebase. Every point is grounded in what exists today.

---

## Where the product stands right now

The core AI loop is solid. Model loading, streaming, RAG, and all four tools work. What's missing is not features — it's **workflow**. Cortex is a powerful engine wrapped in an interface that doesn't yet know how support agents actually work.

The gap between "technically functional" and "fits into a real support shift" is the main thing to close.

---

## The five biggest friction points today

### 1. Markdown renders as raw text

This is the most visible bug in daily use. Cortex generates replies with numbered steps, bullets, and bold terms — that's the right call for support content. But the chat renders plain `whitespace-pre-wrap`, so agents see:

```
**TXID** not found in our system. Please provide:
1. The transaction hash
2. The **sending address** (not receiving)
```

The asterisks, the ugly formatting — all visible. When an agent goes to copy this and paste it into a ticket tool, it either looks broken or they have to clean it up manually. The fix is one library (`react-markdown` or similar), but the UX impact is significant. Right now the output looks unpolished even when the content is perfect.

### 2. No regenerate button

The most common flow in any AI drafting tool is: "close, but not quite — give me another version." Today, that requires typing a new follow-up message like "make it shorter" or "try again." There's no Regenerate button on assistant messages. For a professional support context where agents are judging drafts quickly, this is a real daily cost.

### 3. Tools and Chat are completely isolated

Grammar Check, Translate, and Templates each live in their own panel. They do their job, produce output, and have a "Use as Response" button that copies to clipboard. That's fine for a terminal action. But you can't feed a tool's output back into Chat for further refinement. Real workflow:

- Agent pastes a draft into Grammar Check, gets a polished version
- They want to ask Cortex "can you make the opening sentence warmer without losing the directness?"
- They have to copy the output, go back to Chat, paste it in, add the instruction

There's no continuity. The tools feel like separate apps, not like capabilities of the same agent.

### 4. Sessions are named by the first 48 characters of the first message

Auto-title is fine as a default. But the sidebar fills up with things like `"Customer says their withdrawal of 0.45 BTC..."` and `"Hi, I need to reply to a..."`. There's no rename in the UI. After a few hours of use the history becomes useless for navigation.

### 5. History lives in localStorage only

All conversation sessions are persisted in `localStorage`. This means:
- App reinstall = all history gone
- localStorage getting cleared (e.g. browser storage settings on a shared machine) = gone
- No way to back up, share, or review past sessions

For a professional tool that's building an institutional memory for a support team, this is a meaningful risk. Tauri has a Store plugin (already used for settings) — conversations should live there too.

---

## What the logical next phases look like

### Phase 2 — Remove daily friction (1–2 weeks)

These are one-by-one fixes that would make the current feature set feel finished. No new capabilities, just polishing what's already there.

**Markdown rendering in chat**
Add `react-markdown` to the message renderer. Bullets become bullets. Bold becomes bold. Numbered steps look like steps. The drafts Cortex produces are already well-structured — they just need to render properly.

**Regenerate button**
Add a "Regenerate" button alongside Copy and "Use as Response" on every assistant message. It re-runs the same prompt (same user turn, same context) with a different random seed. One click, new draft.

**Rename conversations**
Click on the session title in the sidebar to rename it inline. Or add a context menu. The auto-title is fine as a starting point — agents just need to be able to fix it.

**Auto-expand composer**
The textarea grows as the agent types instead of staying fixed at 92px. Pasting a long customer ticket into the chat input today is awkward.

**Persist sessions to Tauri Store**
Move sessions out of localStorage and into the same Tauri Store file used for settings. Survives reinstalls. Can be backed up.

---

### Phase 3 — Make the core workflow smarter (2–4 weeks)

These are the features that change how the product actually gets used, not just how it looks.

**Ticket paste mode**

This is the biggest single UX unlock. The primary use case — "I got a ticket, help me reply" — has no dedicated flow today. An agent either pastes the customer message into the chat input (fine but clunky) or describes it in their own words.

What it should look like: a dedicated "Paste ticket" area, visually separate from the chat input. When the agent pastes text there, Cortex:
1. Identifies the ticket type (withdrawal, deposit, KYC, API, security, etc.)
2. Pre-fills the composer with a suggested prompt ("Draft a reply to this withdrawal inquiry")
3. Or goes straight to generating a first draft

This removes the step where the agent has to figure out how to ask. They go from "here's the ticket" to "here's a draft" in one action.

**RAG in all tools**

Right now the knowledge base only activates in Chat. Templates, Grammar Check, and Translate all generate prompts but none of them inject KB context. A KYC template generated without checking your company's actual KYC policy is a missed opportunity. All three tools should run the same RAG lookup that Chat runs, so every generated output is grounded in your docs.

**Tool-to-chat continuity**

When an agent is in Grammar Check or Templates and has a result they want to refine further, they should be able to hit "Continue in Chat" — which opens the chat with the tool's input and output already loaded as context. The agent can then keep iterating with the full agent brain instead of being stuck in a single-shot tool.

**Thinking traces (collapsible)**

The code already captures `thinking` tokens from the model — they're stored on messages but never rendered. For support work, trust in the draft matters. An agent who can see "Cortex considered checking the TXID format, flagged that the user might have used the wrong network, and decided to ask for confirmation before accusing user error" will trust and use the draft more than one that just appears.

Add a collapsible "Reasoning" section below each assistant message, hidden by default. Agents who want to verify the logic can open it; agents who just want the draft don't see it.

---

### Phase 4 — Team enablement (4–8 weeks)

These are the features that turn Cortex from a tool one person uses into something a support team runs together.

**Team config profile**

Today, every agent configures their own copy. Export/import helps but it's still manual — and when the team lead updates the tone rules or the KB path, every machine needs a fresh import.

Better model: the team lead maintains a `team-config.json` on a shared drive or synced folder. Cortex checks for it at startup and applies it. Individual agents can still make personal overrides. This makes "standardize the team's voice" a one-person job, not a coordination nightmare.

**KB visibility**

When an agent rebuilds the knowledge base they see "47 documents, ~380 chunks." That's it. They have no idea what's actually in there, which documents were indexed, or what Cortex "knows" from any given file. There should be a simple KB browser: list of indexed files, last-indexed date per file, ability to preview the chunks extracted from any given doc, and a test query field ("what does the KB say about withdrawal confirmations?").

**Save a reply as a template**

When an agent sends a draft and it's exactly right, there's no way to capture that. Add a "Save as template" button on any assistant message. It goes into a personal templates list (separate from the built-in six). Over time, agents build their own library of high-quality responses for recurring situations.

**Reply quality feedback**

Add a thumbs up / thumbs down on assistant messages. This data stays local. Over time it becomes a signal for two things: (1) which models/temperature settings produce better results for this team's use case, and (2) a corpus of "good" and "bad" replies that could inform future fine-tuning if the team ever goes that route.

---

### Phase 5 — Native macOS experience (ongoing)

These are the features that make Cortex feel like it belongs on macOS, not like a web app in a Tauri shell.

**Global keyboard shortcut**

Select any text in any app (browser, email client, ticket tool), press a shortcut (e.g. ⌥Space), and Cortex opens with that text pre-loaded in Grammar Check or Chat. This is the difference between "I open Cortex when I remember to" and "Cortex is always one keystroke away." Tauri supports global shortcuts at the OS level.

**Menu bar presence**

A menu bar icon means Cortex is always there without taking up dock space or needing to be in the foreground. Click it to bring the window forward, see the model status, trigger a quick action. For a tool agents use constantly throughout a shift, this is the right posture.

**Clipboard listener (opt-in)**

When an agent copies a block of text that looks like a customer message (long text, contains keywords like "withdrawal", "transaction", "verification"), Cortex surfaces a subtle notification: "Looks like a ticket — want me to draft a reply?" Opt-in, non-intrusive, but dramatically reduces the steps from "got a ticket" to "have a draft."

---

## What I'd prioritize if I had to pick one thing

**Ticket paste mode** (Phase 3).

Everything else is polish or infrastructure. This is the product insight. Cortex is fundamentally a "help me reply to this ticket" tool. But the UX currently assumes the agent knows how to frame that request — they have to translate a customer message into an instruction to Cortex. Ticket paste mode eliminates that translation step entirely.

It would also make for the clearest demo moment on the landing page: drop a ticket in here, get a ready-to-send reply in seconds.

---

## Things to not do yet

- **Ticket system integrations (Zendesk, Intercom, etc.)** — too early, too much surface area, and the copy-paste workflow is fine for v0.1. Come back to this when you have users who ask for it repeatedly.
- **Fine-tuning or custom model training** — the local inference pipeline is solid but fine-tuning adds infra complexity that isn't justified at this stage.
- **Windows/Linux support** — macOS first, ship the core experience right, then expand.
- **Web/cloud version** — the entire value proposition is local privacy. Don't dilute it.

---

## Summary priority order

| Priority | What | Why |
|---|---|---|
| 1 | Markdown rendering | Current output looks broken even when content is perfect |
| 2 | Ticket paste mode | Core workflow shortcut — the demo moment |
| 3 | Regenerate button | Biggest missing action in the drafting loop |
| 4 | RAG in all tools | Doubles the value of every KB doc |
| 5 | Persist sessions properly | Risk mitigation — agents will lose history otherwise |
| 6 | Rename conversations | Sidebar becomes usable |
| 7 | Tool-to-chat continuity | Removes the biggest workflow silo |
| 8 | Team config profile | Unlocks actual team deployment vs. individual use |
| 9 | Save reply as template | Builds institutional memory over time |
| 10 | Global shortcut | Native macOS feel, always-available |
