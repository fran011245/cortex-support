# Cortex — Product Features Reference

> For landing page copy. Everything in this doc is built and working in the current v0.1.0 release. Nothing speculative.

---

## What Cortex is

Cortex is a macOS desktop app for customer support agents. It runs entirely on-device — no internet connection, no cloud APIs, no data leaving the machine. Agents open it alongside their ticket tool and use it to draft replies, check tone, translate, and tap ready-made templates for common ticket types.

The core idea: every reply that goes out should sound like it was written by your best support agent on their best day. Cortex makes that the baseline for everyone on the team, every shift.

---

## The five things Cortex does

### 1. Chat Agent — draft replies from a ticket description

The main panel. An agent pastes in the customer's message (or describes the situation in their own words) and Cortex generates a professional, ready-to-send reply.

**What makes it different from a generic chatbot:**
- Replies are shaped by a detailed professional support persona baked into the system prompt — direct, no-fluff, security-aware, no emojis, precise with technical terminology (TXID, memo/tag, nonce, deposit address, 2FA, KYC)
- Streaming output — text appears word by word, no waiting for the full generation
- Every reply has a **Copy** button and a **"Use as Response"** button (copies to clipboard, ready to paste into the ticket tool)
- Full conversation history — multiple sessions, named automatically, each one preserved and deletable
- **Stop generation** at any time with Esc
- Suggested prompts in the empty state for new agents who aren't sure where to start

---

### 2. Grammar & Style Check — clean up any draft text

An agent writes a rough draft or pastes in a reply they're not confident about. Cortex rewrites it to match the professional support standard.

**What it does:**
- Corrects grammar, spelling, punctuation, and sentence structure
- Removes filler, corporate-speak, and overly apologetic language
- Applies the same tone rules as the Chat Agent (full sentences, no emojis, direct but polite)
- Preserves all original facts, numbers, names, and intent — it only polishes the writing
- Outputs only the cleaned version — no "here's the improved version:" wrapper
- One click to copy or send directly back to Chat

**Temperature is capped at 0.3** — the model stays close to the original, it doesn't rewrite from scratch.

---

### 3. Smart Translate — translate while keeping the support tone

Translates a message or draft between 7 languages without losing the professional voice.

**Languages:** English, Spanish, French, Portuguese, German, Italian, Chinese

**What it does:**
- Translates the text accurately, preserving technical terms (TXID, wallet address, etc.), numbers, and intent
- After translating, lightly polishes the result to match professional support tone in the target language
- Swap-language button (one click to flip source and target)
- Outputs only the translated + polished text
- Copy or use directly in Chat

Works in both directions — translate incoming customer messages to English for the agent, or translate English drafts to the customer's language before sending.

---

### 4. Response Templates — full drafts for the 6 most common ticket types

When an agent gets a ticket they've answered a hundred times, Templates generates a complete professional reply in seconds instead of starting from scratch.

**Available ticket types:**
| Template | What it generates |
|---|---|
| **Withdrawal Issue** | Asks for withdrawal ID / TXID, destination address, asset and network. Acknowledges the issue professionally. |
| **Deposit Not Credited** | Requests TXID, sending address, asset, network, time and amount. Explains on-chain confirmation requirement. |
| **KYC / Verification** | Guides on document requirements, clear/color/not expired, matching account details. |
| **API / Integration** | Asks for endpoint, error body, key permissions, nonce and timestamp. Explains what will be checked. |
| **Security / Account** | Security-first response: immediate 2FA reset, session review, warning against phishing. Asks for suspicious TXIDs or timestamps. |
| **General Acknowledgement** | Standard ticket received + request for any additional context. |

**Extra context field:** The agent can add ticket-specific details (customer TXID, asset, amount, timestamps) and the template incorporates them naturally into the generated reply.

---

### 5. Knowledge Base (RAG) — answers grounded in your internal docs

Cortex can search your team's internal documentation before generating a reply, so answers reference your actual policies, runbooks, and help articles instead of generic knowledge.

**How it works:**
- Point Cortex at any local folder (PDFs, Markdown, plain text)
- Hit "Rebuild Knowledge Base" — QVAC builds local vector embeddings, entirely on-device
- When RAG is enabled, relevant chunks from your docs are automatically injected into every reply
- Sources are cited in the output when content was used (can be toggled off)
- Last indexed date and document count shown in settings

**Supported file types:** `.pdf` (text layer), `.md`, `.txt`

No sync required. The folder can be a shared Dropbox or Notion export — agents just rebuild when docs change.

---

## Settings — full control, no code required

Everything is configurable from the Settings panel (⌘, or the gear icon). Changes apply instantly to all new generations.

### Agent Prompt tab
- Full system prompt in an editable textarea — this is the "personality" of Cortex
- Character counter
- One-click restore to the built-in professional support default

### Tone Rules tab
Four style presets (Professional / Concise / Detailed / Empathetic) that set a bundle of rules at once, plus individual fine-grained controls:

| Control | What it does |
|---|---|
| **Always use full sentences** | No fragments, no shorthand |
| **No emojis** | Strict professional appearance |
| **Direct but polite** | Avoids hedging ("could you maybe...?") |
| **Prioritize security warnings** | Surfaces 2FA, verification steps, phishing risks whenever funds or auth are in scope |
| **Max reply length slider** | Sets a word-count target (60–1200) |
| **Extra instructions** | Free-text appended to every system prompt — "Always include the ticket ID at the top", "For corporate clients use last name only", etc. |

### General tab
- **Model selection** — pick from 3 recommended lightweight models or paste any registry ID or local GGUF path
- **Load / Download model** button with live download progress (%)
- **Temperature slider** (0.0 = deterministic → 1.0 = creative)
- **Max tokens per reply** slider (256–4096)
- **Auto-apply grammar check** toggle
- **Show sources & confidence** toggle (controls whether RAG citations appear)
- **Enable RAG** toggle
- **Check for updates** button

### Knowledge Base tab
- Folder picker (OS native file dialog)
- Last indexed date + document count
- Rebuild button with spinner

### Export / Import
Settings can be exported as a JSON file and imported on another machine. Useful for standardizing agent configuration across the team — one team lead sets up the prompt, tone rules, and knowledge base path, exports the file, and shares it. New agents import in one click.

---

## Local AI — 100% on-device, zero cloud

Cortex uses **QVAC** (Tether's local inference stack) to run AI models entirely on the laptop.

**What this means in practice:**
- Ticket content, customer messages, and internal docs never leave the machine
- Works offline, on a plane, in a restricted network environment
- No API keys, no usage bills, no rate limits
- First chat after install triggers a one-time model download (cached in `~/.qvac/models` — subsequent loads are instant)

**Recommended models (pre-configured, one click to download):**
| Model | Size | Best for |
|---|---|---|
| Llama 3.2 1B Instruct (Q4_0) | ~0.5–1 GB | Daily support work, fastest generation |
| Qwen3 1.7B Instruct (Q4) | ~1–1.5 GB | Stronger instruction following |
| Qwen3 4B Instruct (Q4_K_M) | ~2–3 GB | Best reply quality, still lightweight |

Agents can also point Cortex at any local GGUF model they already have on disk.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘,` or `Ctrl+,` | Open / close Settings |
| `⌘N` / `Ctrl+N` | New conversation |
| `⌘K` / `Ctrl+K` | Focus message input |
| `Enter` | Send message |
| `Shift+Enter` | New line in composer |
| `Esc` | Stop current generation |

---

## What Cortex is not (important for landing page honesty)

- It does not connect to your ticket system (Zendesk, Intercom, etc.) — agents copy-paste between Cortex and their tool
- It does not access live exchange data or customer account information — it only knows what the agent types in
- The auto-updater is built in but requires setup (GitHub Releases + signed pubkey) for fully automatic updates — v0.1 ships with a manual "Check for updates" button
- RAG only works with local files — no URL crawling or live web access

---

## Distribution

- macOS only (Apple Silicon recommended for speed)
- Ships as a signed `.dmg` (~5 MB download, model weights download separately on first use)
- `.app` for direct install
- No subscription, no account, no telemetry
