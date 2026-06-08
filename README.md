# Cortex — Support Co-Pilot

> Your personal Support Co-Pilot — 100% local, private, and always on-tone.

**Cortex** is a beautiful, high-end desktop application (built with Tauri 2 + React 19) that helps customer support agents reply faster, more consistently, and *perfectly* matching a professional, pragmatic, clear, and expert tone.

Everything runs **100% locally** using the **@qvac/sdk** (Tether's local AI engine). Zero cloud dependencies. Maximum privacy. Your tickets and internal knowledge never leave the machine.

This project is open source. We believe great support tools should be transparent, customizable, and community-driven. Contributions, feedback, and forks are welcome!

## Why Open Source Cortex?

Support work is high-stakes, high-context, and deeply human. The tools agents use should reflect that.

We open-sourced Cortex because:

- **Transparency & Trust** — When handling sensitive customer issues (especially in finance, crypto, or enterprise), teams need to be able to audit exactly what the AI is doing and what data it sees. 100% local + visible prompts (the Live Effective Prompt) is table stakes.
- **Customization Without Lock-in** — Every support team has its own voice, policies, internal runbooks, and edge cases. Cortex lets teams evolve the agent's personality and knowledge entirely through Settings — no code changes required. Open source means you can always fork, extend, or self-host if your needs change.
- **Better Tools Through Community** — Local AI for professional use is still early. By sharing the patterns (Tauri + local LLM orchestration, thoughtful RAG UX, Mac-optimized model guidance, calm and premium interface), we hope to raise the bar for everyone building in this space.
- **Respect for the Craft** — Support agents are experts. Cortex is designed to amplify their expertise, not replace their judgment. Open source aligns with that respect — the project belongs to the people who use it every day.

By making Cortex open source we hope more teams can:
- Run a private, fully-controlled co-pilot internally
- Contribute improvements that benefit the whole community (new tools, better onboarding, refined tone systems, etc.)
- Learn from and build upon a real-world example of beautiful, responsible local AI UX

We’re not trying to build the next big AI company. We’re trying to build a tool that makes excellent support work a little easier, clearer, and more consistent — and we believe the best way to do that is together.

---

## ✨ What Cortex Does for Support Teams

Customer support agents (especially in crypto and financial services) handle sophisticated users and corporate accounts. Responses must be:

- Direct but polite
- Security- and compliance-first
- Free of fluff, emojis, or corporate-speak
- Precise with terminology (TXID, memo/tag, nonce, rate limits, etc.)
- Consistent with the brand's expert, no-nonsense voice

Cortex acts as an always-available co-pilot that:
- Drafts high-quality replies in a consistent professional tone
- Lets agents fully customize the agent's personality and rules (no code changes needed)
- Provides quick tools for grammar/style fixes, smart translation (EN ↔ ES + others), and ready-made templates for common tickets
- Uses local RAG over your own folder of help articles, runbooks, and internal guidelines — with sources cited in replies

**Result**: Agents reply faster, with higher consistency and quality, while staying fully in control.

---

## 🚀 Quick Start

### Prerequisites
- macOS (Apple Silicon recommended for speed)
- [Rust](https://www.rust-lang.org/tools/install) (via rustup)
- [pnpm](https://pnpm.io/)

### Run in Development
```bash
cd cortex-support
pnpm install
pnpm tauri dev
```

The first run (or first chat send) will automatically download the configured default model via QVAC if it is not yet cached locally. Use the chips in **Settings → General** (or the input field) with the exact registry constant names, then click **"Load / Download this model"** (live progress % is shown). Subsequent runs and generations are instant from the local cache (`~/.qvac/models`).

A **"Debug: List cached models"** button in the same panel lets you inspect exactly what is on disk. The system now correctly resolves the friendly constant names (e.g. `LLAMA_3_2_1B_INST_Q4_0`) to the proper registry descriptors under the hood.

### Production Build
```bash
pnpm tauri build
```

Produces:
- `src-tauri/target/release/bundle/macos/Cortex.app`
- `src-tauri/target/release/bundle/dmg/Cortex_0.1.0_aarch64.dmg`

The `.dmg` is ready for distribution (codesign/notarize for wider release if desired).

---

## ⌨️ Keyboard Shortcuts

| Shortcut       | Action                        |
|----------------|-------------------------------|
| `⌘/` or `Ctrl+,` | Open / close Settings        |
| `⌘N` / `Ctrl+N`  | New conversation             |
| `⌘K` / `Ctrl+K`  | Focus message input          |
| `Enter`          | Send message                 |
| `Shift+Enter`    | New line in composer         |
| `Esc`            | Stop current generation      |

---

## 🖼️ Screenshots

*(Add high-quality screenshots from the running `Cortex.app` — the polished dark theme with the custom brain logo looks great.)*

**Sidebar & Branding**
- Custom purple brain/neural network logo (the official Cortex icon)
- "Cortex" rendered in Space Grotesk for strong brand presence
- "Support Co-Pilot" in Inter for clean readability
- Glassmorphism design, deep navy theme

**Main Chat View**
- Deep navy background (#0A0F1C)
- Glassmorphism sidebar with chat history + tools
- Clean composer with live streaming responses
- "Copy" and "Use as Response" buttons
- Sources cited when RAG is used
- Minimal usage stats (tokens, speed, context)

**First-Run Experience**
- Onboarding Wizard that guides new users through:
  - Model selection (beautiful 2×2 grid of recommended Mac-optimized models with RAM/performance info)
  - Knowledge Base setup (RAG folder + one-click index)
  - Live Effective Prompt transparency
  - Key behavior toggles
- Skippable at any step, re-playable from Settings

**Settings Modal (highly polished)**
- Tabs: General | Agent Prompt | Tone Rules | Knowledge Base
- **General tab**: 2×2 recommended model cards (with load progress, "Loaded"/"Selected" states), custom model input, temperature + max tokens side-by-side, behavior toggles in a clean 2×2 grid
- **Agent Prompt tab**: Large system prompt editor + prominent "Live Effective Prompt" hero card (shows exactly what the model receives, with live token estimate + copy button)
- Tone Rules with presets + fine-grained controls
- Knowledge Base: folder picker, rebuild button, status, and privacy note
- Export / Import full agent configuration as JSON

**RAG in Action**
- Point to any local folder of .md / .txt / .pdf (text layer)
- Fully local embeddings via QVAC
- Agent pulls relevant context + cites sources in replies

**Production Build Artifacts**
- `Cortex_0.1.0_aarch64.dmg`
- `Cortex.app`

*(Recommended: capture clean screenshots showing the new brain logo, the 2×2 model grid, the Live Effective Prompt card, and the first-run wizard.)*

---

## 🛠️ How to Customize the Agent (No Code Required)

All customization lives in **Settings** (⌘/, or gear icon). Changes apply instantly to new generations.

**New users**: On first launch you will be greeted by a friendly **Onboarding Wizard** that walks you through the most important setup steps (model selection with the beautiful 2×2 grid, knowledge base / RAG folder, seeing your live effective prompt, and key toggles). The wizard is skippable and can be replayed anytime from Settings.

### 1. Model Selection (now in a premium 2×2 grid)
In **Settings → General** the recommended models are presented as elegant cards showing:
- Name + quantization + approximate RAM on Mac
- "Best for" description
- Speed vs Quality notes
- Live "Loaded" / "Selected" states + integrated download progress

Click a card to select, then "Load / Download". Custom GGUF paths or other registry IDs are supported in the text field below.

### 2. Agent System Prompt
Large textarea. The full "personality" of Cortex. Pre-filled with a strong default that captures:
- Professional, direct, pragmatic voice
- Security & compliance awareness
- Precise crypto terminology
- "Output only the customer-facing text" discipline

Edit freely. Restore default with one click.

### 3. Live Effective Prompt (the transparency hero)
In the **Agent Prompt** tab you will see a prominent "Live Effective Prompt" card that shows *exactly* what will be sent to the model (base prompt + active Tone Rules + your Extra Instructions), with live token estimate and a one-click Copy button.

This is one of the most powerful and delightful parts of Cortex — you always know what the agent "thinks".

### 4. Tone Rules & Style Presets
- Choose preset: Professional (default), Concise, Detailed, Empathetic
- Fine-grained toggles: full sentences, no emojis, direct-but-polite, prioritize security warnings
- Max reply length guidance (slider)

### 5. Extra Instructions
Free-form text appended to every system prompt. Examples:
- "Always mention the ticket ID at the top."
- "For corporate clients, use last name only."
- "Never promise specific timelines."

### 6. Generation Settings
- Temperature slider (0.0 = deterministic / 1.0 = creative)
- Max tokens

These now live in a clean side-by-side layout under "Generation settings".

### 7. RAG / Knowledge Base
- Pick a folder containing your internal docs (.md, .txt, .pdf text layer)
- Toggle "Enable RAG"
- "Rebuild Knowledge Base" button (uses QVAC embeddings)
- Sources automatically injected into prompts and cited in replies
- Status shows last indexed date + document count

### 8. Behavior Toggles
The most useful toggles (Auto-apply grammar, Show sources & confidence, Enable RAG, Show usage stats) are presented in a tidy 2×2 card grid for quick scanning.

### 9. Export / Import
Export your entire tuned agent (prompt + rules + model prefs + RAG path) as JSON. Share across the team or version-control it.

**Pro tip**: The Settings *are* the product. A great support team can evolve the agent's voice and knowledge base over time without ever touching the codebase.

### Recommended Default Models (Lightweight + Task-Aligned)
We ship with `LLAMA_3_2_1B_INST_Q4_0` pre-configured as the default. Weights are **never** bundled — they are downloaded on first use via the QVAC registry into your local `~/.qvac/models` cache.

The 2×2 grid in Settings makes choosing easy, with Mac-specific RAM and performance guidance from the in-app model guide.

**Use the exact registry constant names** (shown on the cards):

- `LLAMA_3_2_1B_INST_Q4_0` (primary — ultra light, fastest, great for daily support work)
- `QWEN3_1_7B_INST_Q4` (excellent instruction following)
- `QWEN3_4B_INST_Q4_K_M` (best quality/weight trade-off of the three)

For RAG embeddings: `EMBEDDINGGEMMA_300M_Q4_0`

The download + load pipeline (with live progress and correct name resolution) is stable and reliable. The chat header and empty state also provide easy "Load model" access.

---

## 🎬 Demo Video Script

See the detailed, ready-to-record script in [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md) (2:30–3:00 target length, with timing, narration, b-roll order, and recording tips).

It is optimized for hackathon / internal leadership demos and emphasizes real value for support agents.

---

## 🏆 How Cortex Helps Support Teams

- **Speed**: Agents get excellent first drafts in seconds instead of minutes.
- **Consistency**: Every reply matches the exact tone and quality bar, even on night shifts or for new hires.
- **Quality & Compliance**: Security warnings, precise terminology, and "no fluff" discipline are enforced by default.
- **Customization at Scale**: Team leads can tune the voice and load the latest internal runbooks without engineering involvement.
- **Privacy & Trust**: 100% local. No data leaves the laptop. Critical for handling high-value corporate and trader accounts.
- **Knowledge Leverage**: RAG turns scattered PDFs and Markdown into instantly usable institutional knowledge.
- **Reduced Cognitive Load**: Tools for grammar, translation, and templating remove repetitive work so agents can focus on the hard cases.

Cortex doesn't replace agents — it makes great agents dramatically more effective.

---

## 🏗️ Architecture & Tech

- **Desktop**: Tauri 2 (Rust backend + React frontend) → native macOS .app/.dmg with tiny footprint.
- **Frontend**: React 19 + TypeScript + Vite + Tailwind v4 + shadcn/ui + Zustand.
- **AI Engine**: @qvac/sdk (Tether's local inference stack) running via a Node child process (host script) for full access to embeddings, RAG, and streaming completions.
- **Persistence**: Tauri Store plugin (settings) + localStorage (chat sessions).
- **RAG**: Folder-based, QVAC embeddings, workspace-isolated, sources cited in every relevant reply.
- **Theme**: Deep navy (#0A0F1C) + accent blue (#3B82F6) + glassmorphism. 2026 Linear/Vercel/crypto-finance aesthetic.

All heavy lifting (model loading, RAG, inference) happens locally. The webview only orchestrates.

**Stability note (as of this release)**: The full local AI pipeline is now stable:
- Registry model discovery + first-time download with live progress (LLM + embeddings)
- Correct resolution of the friendly constant names (`LLAMA_3_2_1B_INST_Q4_0` etc.) to real registry descriptors
- Auto-load on first chat send
- Reliable cache inspection via the Debug button
- Streaming completions + RAG with cited sources

Next work will focus on UI/UX polish and additional agent features. The core QVAC integration (via the Node sidecar) is solid.

---

## 📦 Distribution & Auto-Updates (optional)

- Development: `pnpm tauri dev`
- Production: `pnpm tauri build` → ready-to-distribute .dmg (now named `Cortex_0.1.0_....dmg` and `Cortex.app`)
- The app includes **optional auto-updater** integration via `@tauri-apps/plugin-updater`.
  - In Settings (General tab) there is a "Check for updates" button + install flow.
  - To activate real updates:
    1. `pnpm tauri signer generate -a cortex-updater` (creates private key + .pub)
    2. Copy the content of the `.pub` file into `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`
    3. On release: use `pnpm tauri build` (it will produce the updater artifacts including latest.json + signatures if configured)
    4. Upload the release assets (including signatures) to GitHub Releases (tag matching version).
  - For **private repo**: GH release assets are private by default. Either:
    - Make specific release "public" assets, or
    - Host a public `latest.json` + .dmg somewhere (VPS, GH Pages, or even the landing site assets) and point the endpoint there.
  - The updater is fully optional — agents can always download the latest .dmg manually.

See also "Landing page + downloadable sync" below.

---

## 🛠️ Development

```bash
cd cortex-support
pnpm install
pnpm tauri dev
```

**Best way to debug while testing locally**:
- Always run from a terminal: `pnpm tauri dev`. The terminal shows Rust/Tauri logs, Vite output, and uncaught errors.
- Open WebView DevTools in the running window (F12, Cmd+Opt+I, or right-click → Inspect). This is now enabled by default in dev (`"devtools": true` in tauri.conf).
  - Renderer `console.log`/`warn`/`error` (from App, Chat, qvac.ts, bridge, tools, etc.) appear here.
  - qvac-host process logs surface as `[qvac-host stderr]` (and prefixed `[qvac-host]` inside the host) in the **same WebView DevTools console** — search for them. Also echoed to the tauri dev terminal.
- On host startup you should see a one-time `[qvac-host] Ensured bare runtime in PATH: ...` line (the sidecar automatically makes the `bare` worker runtime available so registry downloads and the QVAC provider can start).
- Other useful logs: `[QVAC]`, `[Cortex]`, `[RAG]`, `[qvac-bridge]` etc. for easy filtering.
- Vite HMR for frontend changes (instant). Rust changes recompile visibly in the terminal.
- To simulate "first run" (force re-download of defaults): `rm -rf ~/.qvac/models/*` (or the platform equivalent). Then use Settings → Load or just send a message in chat.
- The "Debug: List cached models" button (Settings → General) is the easiest way to verify what actually landed on disk.
- Advanced host debugging: you can still run `node src-tauri/qvac-host.cjs` standalone and feed it NDJSON commands on stdin for low-level testing. The host now auto-discovers the `bare` runtime needed by the QVAC worker.
- Model download / first-time registry fetch now has reliable live progress in the UI and rich logs in both the tauri dev terminal (`[qvac-host stderr]`) and the WebView console.

See `src-tauri/qvac-host.cjs` for the Node-side QVAC bridge (the secret sauce that lets the renderer use the full SDK while keeping the webview clean).

The local model loading + download pipeline (LLM + embeddings) is stable. See the "Recommended Default Models" section for the current best IDs and workflow.

---

## 📄 License

Internal tooling for professional support teams (to be defined by the team).

---

## 🌐 Website & Distribution

A public website / landing page can point to GitHub Releases for the latest `.dmg`.

**Recommended release flow** (once you're ready for public distribution):
1. `pnpm tauri build`
2. Create a GitHub Release with the `.dmg` (and updater artifacts if using the auto-updater).
3. Update your website's download button to point to the latest release asset or release page.

We keep the GitHub release as the single source of truth. A small `manifest.json` (hosted on GitHub Pages, a gist, or your own static hosting) can be used by the website to dynamically show version + direct download link.

See the "Distribution & Auto-Updates" section above for more details on optional auto-updater setup.

---

## 🤝 Contributing

We welcome contributions! Whether it's:

- Bug reports and feature requests (open an issue)
- UI/UX polish and new agent tools
- Improvements to the onboarding wizard or settings experience
- Documentation, translations, or example knowledge base folders
- Better error handling or performance in the local AI pipeline

Please open an issue first for bigger changes so we can discuss the approach.

---

## 📄 License

This project is open source. See `LICENSE` (we recommend the MIT License for maximum openness and adoption by support teams and companies).

---

## 🔜 Roadmap & Future Work

Core local AI functionality is stable (model registry downloads with progress, correct constant resolution, RAG, streaming, caching).

Current focus areas:
- Continued UI/UX refinement (the "suprema" settings experience and first-run wizard are recent highlights)
- Additional high-value agent tools
- Even better RAG UX and folder management
- Cross-platform support (currently optimized for macOS / Apple Silicon)
- Community contributions welcome!

The `DEBUG_MODEL_LOADING.md` file contains historical debugging notes for the QVAC integration (useful reference).

Built with ❤️ and deep respect for professional support work.

**Cortex** — because even the best agents deserve a co-pilot that never forgets the tone.
