# Cortex — Support Co-Pilot

> Your personal Support Co-Pilot — 100% local, private, and always on-tone.

**Built for [QVAC Hackathon I — Unleash Edge AI](https://dorahacks.io/hackathon/qvac-unleach-edge-ai-i/detail) · General Purpose Track · June 2026**

---

**Cortex** is a production-ready desktop application that helps customer support agents draft fast, professional, perfectly on-tone replies — with zero cloud dependencies, zero API keys, and zero data leaving the machine.

All AI inference and RAG run entirely on-device via the **[@qvac/sdk](https://qvac.tether.io/dev/sdk/)** — Tether's local inference engine. No OpenAI. No Anthropic. No external APIs of any kind. One laptop, full capability.

**Track:** General Purpose — runs on Apple Silicon Macs (16 GB RAM recommended, tested on M-series). The QVAC SDK handles model loading, streaming completions, embeddings, and RAG entirely on the local machine.

This project is open source. We believe great support tools should be transparent, customizable, and community-driven.

---

## The Problem

Customer support agents in crypto and financial services handle sophisticated users and high-stakes tickets every day. Every reply must be:

- Direct but polite — no fluff, no corporate-speak
- Security- and compliance-first (TXID, 2FA, KYC, withdrawal verification)
- Consistent with the brand's expert, no-nonsense voice
- Fast — hundreds of tickets per shift

Today agents either write everything from scratch (slow, inconsistent) or use cloud-based AI tools (privacy risk, cost at scale, vendor lock-in).

**Cortex solves this entirely on-device.**

---

## What Cortex Does

- **Chat Agent** — paste a ticket, get a professional draft in seconds. Streaming output. One-click "Use as Response."
- **Grammar & Style** — polish any draft to match the exact tone and professionalism standard
- **Smart Translate** — EN ↔ ES ↔ FR ↔ PT ↔ DE ↔ IT ↔ ZH while preserving technical terminology
- **Response Templates** — 6 pre-built templates for the most common ticket types (withdrawal issues, missing deposits, KYC, API problems, security concerns, general acknowledgements)
- **Local RAG** — point to any folder of `.md`, `.txt`, or `.pdf` docs. QVAC embeds them locally. The agent cites sources in replies.
- **Full customization** — editable system prompt, tone presets, extra instructions, behavior toggles. No code changes required.

**Result:** Every agent replies faster, with higher consistency and quality, while staying fully in control. And your customers' data never leaves the building.

---

## QVAC SDK Integration

Cortex uses `@qvac/sdk` for **all** local AI operations:

| Operation | QVAC feature used |
|---|---|
| LLM inference (chat, grammar, translate, templates) | `llamacpp-completion` via `loadModel` + `streamCompletion` |
| Knowledge base embeddings | `EMBEDDINGGEMMA_300M_Q4_0` via `loadModel` |
| RAG retrieval | `searchKnowledge` with locally indexed chunks |
| Model download + caching | QVAC registry (`LLAMA_3_2_1B_INST_Q4_0`, `QWEN3_*`) |

The SDK runs in a **Node.js sidecar** (`src-tauri/qvac-host.cjs`) spawned by the Tauri Rust backend. This keeps `@qvac/sdk` (a Node/Bare runtime package) completely out of the webview bundle while giving the React UI full access to streaming completions and RAG via a clean IPC bridge.

**Recommended models** (all downloaded on first use, cached locally in `~/.qvac/models`):
- `LLAMA_3_2_1B_INST_Q4_0` — default, ultra-light (~0.5–1 GB), fastest daily driver
- `QWEN3_1_7B_INST_Q4` — excellent instruction following
- `QWEN3_4B_INST_Q4_K_M` — best quality/weight trade-off

---

## Quick Start

### Prerequisites
- macOS (Apple Silicon recommended)
- [Rust](https://www.rust-lang.org/tools/install) (via rustup)
- [pnpm](https://pnpm.io/)

### Run in Development
```bash
git clone https://github.com/fran011245/cortex-support
cd cortex-support
pnpm install
pnpm tauri dev
```

On first chat send, Cortex auto-downloads the configured model via the QVAC registry (live progress shown in UI). Subsequent runs are instant from the local cache at `~/.qvac/models`.

### Production Build
```bash
pnpm tauri build
```

Produces:
- `src-tauri/target/release/bundle/macos/Cortex.app`
- `src-tauri/target/release/bundle/dmg/Cortex_0.1.0_aarch64.dmg`

### Run Tests
```bash
pnpm test:run   # single pass
pnpm test       # watch mode
pnpm test:ui    # browser UI
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘,` / `Ctrl+,` | Open / close Settings |
| `⌘N` / `Ctrl+N` | New conversation |
| `⌘K` / `Ctrl+K` | Focus message input |
| `Enter` | Send message |
| `Shift+Enter` | New line in composer |
| `Esc` | Stop current generation |

---

## How to Customize the Agent (No Code Required)

All customization lives in **Settings** (⌘,). Changes apply instantly to new generations.

### Agent System Prompt
Pre-filled with a strong default for crypto/fintech support. Fully editable. Restore default with one click.

### Live Effective Prompt (transparency hero)
The **Agent Prompt** tab shows exactly what the model receives — base prompt + active Tone Rules + Extra Instructions — with a live token estimate and one-click copy. You always know what the agent "thinks."

### Tone Rules & Style Presets
- Presets: Professional (default), Concise, Detailed, Empathetic
- Fine-grained toggles: full sentences, no emojis, direct-but-polite, prioritize security warnings
- Max reply length slider

### Extra Instructions
Free-form text appended to every prompt:
- "Always mention the ticket ID at the top."
- "For corporate clients, use last name only."
- "Never promise specific timelines."

### Knowledge Base (RAG)
- Pick a folder of `.md`, `.txt`, `.pdf` files
- QVAC embeddings index them locally (one click, no cloud)
- Agent automatically pulls relevant context and cites sources
- Toggle "Enable RAG" to activate

### Export / Import
Export your full agent configuration (prompt + rules + model prefs + RAG path) as JSON. Share across the team or version-control it.

---

## Architecture

```
Tauri 2 (Rust backend)
  └── spawns qvac-host.cjs (Node.js sidecar)
        └── @qvac/sdk — model loading, embeddings, streaming completions

React 19 frontend (webview)
  └── sends IPC commands to Rust → forwarded as NDJSON to qvac-host
  └── receives streaming tokens back via IPC events
```

**Stack:**
- **Desktop:** Tauri 2 — native macOS `.app` / `.dmg`, tiny footprint
- **Frontend:** React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Zustand
- **AI Engine:** `@qvac/sdk` (all inference + embeddings + RAG — 100% local)
- **Persistence:** Tauri Store plugin (settings) + localStorage (chat sessions)
- **Theme:** Deep navy (#0A0F1C) + accent blue (#3B82F6) + glassmorphism

**Why a Node sidecar?** `@qvac/sdk` uses native addons and the Bare/Hypercore runtime — it cannot be bundled into a browser webview. Running it as a child process is the clean, stable solution. All communication is NDJSON over stdin/stdout, brokered by Tauri IPC.

---

## Why Open Source?

Support work is high-stakes, high-context, and deeply human. The tools agents use should reflect that.

- **Transparency & Trust** — Teams handling sensitive financial accounts need to audit exactly what the AI sees. 100% local + the Live Effective Prompt is table stakes.
- **No vendor lock-in** — Every team has its own voice and policies. Cortex lets teams evolve the agent entirely through Settings. Fork, extend, or self-host anytime.
- **Respect for the craft** — Support agents are experts. Cortex amplifies their expertise, it doesn't replace their judgment.

We're not trying to build the next big AI company. We're building a tool that makes excellent support work a little easier, clearer, and more consistent.

---

## Contributing

We welcome contributions:

- Bug reports and feature requests (open an issue)
- New agent tools or UI improvements
- Better onboarding or settings experience
- Documentation, translations, example knowledge base folders
- Cross-platform support (currently macOS / Apple Silicon)

Please open an issue first for bigger changes to align on the approach.

---

## Demo

A ready-to-record demo script (2:30–3:00 min, hackathon-optimized) is in [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md).

**Suggested flow:** App launch → model load → paste a support ticket → streaming draft → "Use as Response" → Grammar tool → Response Templates → Settings customization → RAG folder setup.

---

## License

MIT — see [LICENSE](LICENSE).
