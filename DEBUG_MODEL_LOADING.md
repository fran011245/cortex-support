# Cortex Model Loading Debug Session Summary (Historical — AI Integration is now Stable)

> **Note**: As of the latest updates, the QVAC registry model download + load pipeline is stable and working reliably (with the fixes described below).  
> This file is kept for reference during future deep debugging of the sidecar/host.  
> For normal usage and current best practices, see the "Recommended Default Models" section in [README.md](README.md).

---

## Current Status (as of last session + this session fixes)
- Permissions: Fixed in `src-tauri/capabilities/default.json`
  - shell:allow-spawn (for node)
  - shell:allow-execute (for node)
  - shell:allow-stdin-write (for node)
- Model IDs: Must use **exact SDK registry constants** (not local filenames or .gguf variants)
  - Correct: `LLAMA_3_2_1B_INST_Q4_0`, `QWEN3_1_7B_INST_Q4`, `QWEN3_4B_INST_Q4_K_M`
  - Embed: `EMBEDDINGGEMMA_300M_Q4_0`
  - **Do NOT use**: "Llama-3.2-1B-Instruct-Q4_0", "Qwen3-1.7B-Q4_0.gguf", etc.
- **Key runtime rule (the previous hidden bug)**: load with registry const → get back *handle* (hash) → pass *only the handle* to complete/stream. settings.defaultModelId always holds the const.
- **Download rule (the bug being fixed in *this* session)**: the "const" you pass as modelSrc must be (or resolve to) the *descriptor object* exported by the SDK (the one with .src = "registry://..."), not the bare string name. The host now resolves the string names we use in UI/settings to the objects. Also needs "bare" in PATH so the worker that performs the actual download can start.
- Debug UI added: In Settings > General, "Debug: List cached models" button (calls listModels in host)
- Model type: Use "llamacpp-completion" (not "llm")
- This session: descriptor object resolution (so registry downloads actually happen for our chips/defaults), bare worker PATH auto-fix in host, stdout line buffering for reliable progress, plus prior handle/src work. Run pnpm tauri dev to test downloads.

## How to Start Fresh Debugging
```bash
cd /Users/fsimonai/cortex-support
pnpm tauri dev   # ALWAYS use this for debugging, not the packaged .app
```

## Key Debugging Steps
1. Run in dev mode.
2. Open the app window → right-click → Inspect (WebView DevTools).
3. In Settings (gear icon):
   - Go to General tab.
   - Use the chips (they now set the correct registry IDs).
   - Or manually paste a correct ID, e.g. `LLAMA_3_2_1B_INST_Q4_0`
   - Click "Load / Download this model"
4. Click the **"Debug: List cached models"** button — this shows exact files in `~/.qvac/models`
5. Watch two places for logs:
   - Terminal running `pnpm tauri dev` (look for `[qvac-host stderr]`, `[qvac-bridge]`)
   - DevTools Console (filter "qvac", "load", "MODEL_NOT_FOUND", "bridge")
6. Common success path:
   - First load of a model triggers download (progress % shown).
   - After success, model is cached in `~/.qvac/models/<something>.gguf`
   - Subsequent loads are instant.
   - Chat send should then work (auto-loads default if needed).

## Common Pitfalls & Fixes
- Using wrong ID format (filename or .gguf or wrong case) → MODEL_NOT_FOUND (even if file exists in the list the SDK prints). Use exact e.g. LLAMA_3_2_1B_INST_Q4_0 .
- Running the old packaged `.app` instead of `pnpm tauri dev` (code changes not reflected).
- Persisted settings have old bad ID → always override via Settings input + Apply (then Load).
- List cached models shows 0 files → normal until first successful load.
- The long "Available models: ..." list in errors = SDK's view of local files or known registry. Use the **registry constants** for load requests.
- Model type deprecation warning → fixed by using "llamacpp-completion".
- Port 1420 in use → kill stale vite: `kill $(lsof -t -i:1420)`
- After Settings "Load" the pill turns green but first chat send fails with model error → was the handle vs src mix (now fixed in this session's edits). If reappears, check console for what value is in currentModelId vs what load returned.
- ctx_size mismatch between load calls → different hashes, treated as separate models (now standardized to 4096).
- **Download never starts for the "correct" string IDs from chips** (the main thing being fixed now): the SDK registry constants like `LLAMA_3_2_1B_INST_Q4_0` are exported as *descriptor objects* `{name, src: "registry://...", expectedSize, ...}` (not bare strings). Passing the plain string name hits the local-file `resolveLocalOrCachedFile` path → MODEL_NOT_FOUND (the error lists .gguf names). Only the object (or its `.src`) triggers `downloadModelFromRegistry` + real progress + files in `~/.qvac/models`. We now resolve the name → object in the host (single place that covers UI loads + internal RAG embed loads). See the new "bare" gotcha below too.
- "bare" command not found / worker never starts: the @qvac/sdk does `spawn("bare", [worker.js, {HOME_DIR, IPC}])` (the bare runtime + worker do the actual registry downloads, p2p, and inference). If "bare" isn't in the PATH of the node host process, you get spawn errors before any download. The host now auto-discovers the bare bin from bare-runtime (transitive dep) and prepends it. Watch stderr for the "Ensured bare" line.
- Progress % never updates (or only final "ready" toast) even while downloading: the stdout NDJSON handler had no line buffer. Data chunks can split progress lines → dropped as "Non-JSON". Fixed with accumulator + remainder. You should now see live updates on the Load button and in the chat header during first-time registry downloads.

## To Force Fresh State
```bash
# Clear persisted settings (if needed)
rm -f ~/Library/Application\ Support/cortex-support/cortex-settings.json 2>/dev/null || true

# Clear QVAC cache (nuclear option, will re-download)
rm -rf ~/.qvac/models/*

# Rebuild if testing packaged app
pnpm tauri build
```

## Next Things to Try in New Session
- Start with `pnpm tauri dev`
- (Optional) rm -rf ~/.qvac/models/* to force re-download (or the settings json).
- In terminal watch for the new "[qvac-host] Ensured bare runtime in PATH" line at host startup (critical for the worker that does downloads).
- Open app, go to chat, type a message and send WITHOUT opening Settings first → should now trigger a real registry download for the default (watch % in header + logs).
- Open Settings → General, click a chip (e.g. first Llama), click "Load / Download this model". The button should live-update with "Loading XX%..." (thanks to the line buffer) and you should see modelProgress / registry download chatter in [qvac-host stderr].
- Use "Debug: List cached models" before/after — after success you should see a `<hash>_Llama-3.2-1B-Instruct-Q4_0.gguf` (or sharded/ subdir) appear. Compare size to the descriptor's expectedSize if you log it.
- Send a chat message after ready (should now get tokens, not MODEL_NOT_FOUND).
- Test RAG Rebuild on a tiny .md folder too (exercises the embed descriptor path).
- If still nothing: paste the full stderr (especially anything about bare, spawn, provide, registry, download, ModelNotFound) + the Debug list output + what the chip string was.

## Files Modified Recently (for reference)
- src/lib/settings.ts (model IDs + defaults — now derive strings from imported descriptor objects)
- src-tauri/capabilities/default.json (shell perms)
- src-tauri/qvac-host.cjs (the big one for this session: resolveModelSrc helper for name→descriptor, findAndPrependBareBinToPATH at startup, applied to LLM + RAG embed loads, listModels, comments)
- src/lib/qvac-bridge.ts (stdout NDJSON line buffer for reliable progress during downloads)
- src/lib/qvac.ts (listCachedModels wrapper + ...)
- src/components/SettingsModal.tsx (Debug + Load)
- src/stores/useAgentStore.ts (handle handling)
- src/components/ChatInterface.tsx (auto-load)
- DEBUG_MODEL_LOADING.md + README (new gotchas for descriptors + bare + buffering)
- (no change to UI call sites — they keep using the nice string ids; resolution is transparent in the host)

## Critical Gotcha Fixed (root cause of "MODEL_NOT_FOUND" on chat even after "Load" success)
- `loadLocalModel({modelSrc: "LLAMA_..."})` returns a **runtime handle** = short hash generated as `hash("llamacpp-completion:LLAMA_...:<config>")` (see SDK server/rpc/handlers/load-model/handler.js).
- This handle (not the registry string) **must** be passed to `streamCompletion` / `completion` / `embed` as `modelId`.
- `settings.defaultModelId` (and RECOMMENDED) must **always** stay as registry constants (for re-loads after restart, and for "Debug list" to match against cache files).
- Previous code mixed them: Settings load did `setModelId(src)` (src), store init+set persisted the src into currentModelId, chat send passed src (or stale) to complete → MODEL_NOT_FOUND.
- Now: currentModelId = only the handle (ephemeral, not persisted); settings.defaultModelId = the src spec; send logic calls loadTestModel(desiredSrc) to get fresh handle before complete; Load button persists src + sets handle.

## Quick Commands
```bash
# See the actual descriptor objects (these are what must reach sdk.loadModel for registry downloads)
node -e '
  const sdk = require("@qvac/sdk");
  const d = sdk.LLAMA_3_2_1B_INST_Q4_0;
  console.log("name:", d && d.name);
  console.log("has src (registry)?:", !!(d && d.src && String(d.src).startsWith("registry:")));
  console.log("expectedSize:", d && d.expectedSize);
'
# The strings we use in settings/UI are the .name; the host resolves the name back to the object.
```

This file captures the state so you can start a clean new debugging session with full context.
