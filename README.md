# Cortex — Support Co-Pilot

> Your personal Support Co-Pilot — 100% local, private, and always on-tone.

**Cortex** is a beautiful, high-end desktop application (built with Tauri 2 + React 19) that helps customer support agents reply faster, more consistently, and *perfectly* matching a professional, pragmatic, clear, and expert tone.

Everything runs **100% locally** using the **@qvac/sdk** (Tether's local AI engine). Zero cloud dependencies. Maximum privacy. Your tickets and internal knowledge never leave the machine.

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

*(Capture these from the running app for your demo/hackathon submission. Use the built `Cortex.app` for the final polished look.)*

**Main Chat View**
- Deep navy background (#0A0F1C)
- Glassmorphism sidebar with chat history + quick tools
- Clean composer with live streaming responses
- "Copy" and "Use as Response" buttons on every assistant message
- Sources cited when RAG is used

**Sidebar Tools (Grammar & Style, Smart Translate, Response Templates)**
- Context-aware quick actions that feed the same agent brain

**Settings Modal (the heart of the product)**
- Tabs: General | Agent Prompt | Tone Rules | Knowledge Base
- Large editable system prompt (pre-filled with excellent professional support tone)
- Structured tone controls + presets (Professional / Concise / Detailed / Empathetic)
- Temperature, max tokens, model selection, RAG toggle
- Folder picker + "Rebuild Knowledge Base" button
- Export / Import settings as JSON

**RAG in Action**
- Point to a folder of PDFs/Markdown
- Rebuild embeds everything locally
- Agent automatically pulls relevant chunks and cites sources

**Production Build Artifacts**
- `Cortex_0.1.0_aarch64.dmg` (5.2 MB)
- `Cortex.app`

*(Add high-quality screenshots here — dark theme with electric blue accents looks premium. The production .app gives the cleanest UI.)*

---

## 🛠️ How to Customize the Agent (No Code Required)

All customization lives in **Settings** (⌘/, or gear icon). Changes apply instantly to new generations.

### 1. Agent System Prompt
Large textarea. The full "personality" of Cortex. Pre-filled with a strong default that captures:
- Professional, direct, pragmatic voice
- Security & compliance awareness
- Precise crypto terminology
- "Output only the customer-facing text" discipline

Edit freely. Restore default with one click.

### 2. Tone Rules & Style Presets
- Choose preset: Professional (default), Concise, Detailed, Empathetic
- Fine-grained toggles: full sentences, no emojis, direct-but-polite, prioritize security warnings
- Max reply length guidance (slider)

### 3. Extra Instructions
Free-form text appended to every system prompt. Examples:
- "Always mention the ticket ID at the top."
- "For corporate clients, use last name only."
- "Never promise specific timelines."

### 4. Model & Generation Settings
- Default model ID (use the registry constants via the chips, or paste a local GGUF path)
- Temperature slider (0.0 = deterministic / 1.0 = creative)
- Max tokens

### 5. RAG / Knowledge Base
- Pick a folder containing your internal docs (.md, .txt, .pdf text layer)
- Toggle "Enable RAG"
- "Rebuild Knowledge Base" button (uses QVAC embeddings)
- Sources automatically injected into prompts and cited in replies

### 6. Export / Import
Export your entire tuned agent (prompt + rules + model prefs + RAG path) as JSON. Share across the team or version-control it.

**Pro tip**: The Settings *are* the product. A great support team can evolve the agent's voice and knowledge base over time without ever touching the codebase.

### Recommended Default Models (Lightweight + Task-Aligned)
We ship with `LLAMA_3_2_1B_INST_Q4_0` pre-configured as the default (in `DEFAULT_SETTINGS`). Weights are **never** bundled in the .dmg/.app — they are downloaded on first use (or first chat send) via the QVAC registry into your local `~/.qvac/models` cache. This keeps the distributable tiny.

In **Settings → General** you will find:

- Quick-select chips for the three recommended lightweight instruction-tuned models.
- A text field where you can paste any registry constant or a local path.
- The **"Load / Download this model"** button with live progress percentage while fetching.
- A **"Debug: List cached models"** helper that shows the exact contents of `~/.qvac/models` (very useful after the first download).

**Use the exact registry constant names** (the chips already do this):

- `LLAMA_3_2_1B_INST_Q4_0` (primary — ultra light, fastest, great for daily support work)
- `QWEN3_1_7B_INST_Q4` (excellent instruction following)
- `QWEN3_4B_INST_Q4_K_M` (best quality/weight trade-off of the three)

For RAG embeddings (used automatically when you enable RAG + rebuild a knowledge base): `EMBEDDINGGEMMA_300M_Q4_0`

After selecting a model and clicking Load, the choice is persisted. The chat header also has a "Load recommended model" / "Reload model" button, and sending the first message in a new session will auto-trigger the load (with progress feedback) if nothing is ready yet.

**Important**: Always use the constant names shown above (or via the chips), **not** local filenames like `Llama-3.2-1B-Instruct-Q4_0.gguf`. The latter will result in `MODEL_NOT_FOUND` on first download even if the file later appears in your cache. The Debug list button shows you the real on-disk names after a successful registry fetch.

The whole download + load pipeline (including progress reporting and name resolution) is now stable and reliable.

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

## 🌐 Landing Page + Downloadable Sync (cortesupport.lovable.app)

The current landing (built on Lovable) needs a prominent "Download for macOS" (or "Get Cortex") button / link that always points to the latest .dmg.

**Current state (as of this rename)**: We have not edited the external Lovable site yet — this is the next coordination step with you.

**Recommended flow**:
1. Build: `pnpm tauri build` (produces `src-tauri/target/release/bundle/dmg/Cortex_0.1.0_aarch64.dmg` and signatures if updater enabled).
2. Release on GH:
   - Tag + push: `git tag v0.1.0 && git push origin v0.1.0`
   - Go to GitHub → Releases → "Draft a new release" from the tag.
   - Upload the .dmg (and .sig / latest.json / .tar.gz if generated) as assets.
   - Publish (can be private release visible to your team).
3. Sync to landing:
   - **Easiest (manual)**: In the Lovable editor, edit the download button's link to the direct GH asset URL (or the release page). Update any "vX.Y.Z" text. Takes <1min.
   - **Better (auto-sync friendly)**: Host a tiny public `manifest.json` (on your VPS under easy static route, or a public gist, or GH Pages branch even for private repo, or even a free JSON bin). Landing (if it allows an HTML/JS embed or "dynamic link" component) can `fetch` the manifest and set `download.href = data.dmgUrl; versionText = data.version`.
     Example manifest (update on every release):
     ```json
     {
       "version": "0.1.0",
       "dmgUrl": "https://github.com/fran011245/cortex-support/releases/download/v0.1.0/Cortex_0.1.0_aarch64.dmg",
       "notes": "Renamed to Cortex + optional auto-updater support. Stable QVAC local model loading (registry constants + progress).",
       "sizeMB": 5
     }
     ```
4. VPS option (you have one): Add a simple static file server or just drop the .dmg + manifest in a volume mounted to a public path via Traefik. Then landing always points to `https://<your-vps>/download/cortex-latest.dmg` (you symlink or copy on deploy).

**What I suggest we do next together**:
- You show me the current structure of the Lovable page (or the specific section with the download CTA, any custom code/embed area).
- Decide: manual updates for v0.1 / hackathon, or invest 20min in a manifest + fetch (if Lovable allows) or VPS mirror.
- After next build + GH release, we update the landing link + version badge.

This keeps the "single source of truth" as the GH release (or your VPS), and the landing just references it.

---

## 📦 Hackathon / Deliverables

- ✅ Excellent README (this file) with setup, customization guide, architecture, and value explanation
- ✅ Dedicated [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md)
- ✅ Production `.dmg` and `.app` (see build artifacts above)
- ✅ Full source + all phases implemented (0–7)
- ✅ **Stable local model loading pipeline** (QVAC registry downloads, name resolution, progress, caching, RAG embeddings, streaming completions) — ready for production use by support agents. UI/UX improvements are the focus of the next development cycle.

Built with ❤️ and a deep respect for professional support work.

**Cortex** — because even the best agents deserve a co-pilot that never forgets the tone.

---

## 🔜 What's Next (New Session)

Core local AI functionality (model download from QVAC registry using the proper constant names, live progress, auto-resolution in the host, caching, streaming completions, and RAG) is now stable and reliable.

The focus of the **next development cycle** will be UI/UX improvements:
- Polish, responsiveness, better visual feedback
- Improved RAG folder management and rebuild UX
- More agent tools / templates
- Better error states and first-run experience
- General refinement of the chat and settings interfaces

The `DEBUG_MODEL_LOADING.md` file in the repo root contains the full historical debugging notes for the AI integration (useful reference but no longer required for day-to-day work).

Happy to start the new session whenever you're ready!
