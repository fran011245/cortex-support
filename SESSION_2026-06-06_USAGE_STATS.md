# Done in this session — Chat Usage Stats (minimalist model consumption)

**Date**: 2026-06-06
**Branch**: ui/chat-usage-stats (to be merged / PR)
**Base**: main (post Phase 2 UX merge)

## What was delivered

Minimalist, always-available visibility into model consumption directly in the chat:

- **Per-assistant-message stats** (shown as a tiny monospace line under finished replies, styled exactly like the existing "Sources" tags):
  - Input tokens (prompt / context for the turn)
  - Output tokens
  - Speed (t/s) when the backend provides it
  - Graceful formatting for the stats shape that comes from the stable QVAC/llama.cpp host (prompt_n, predicted_n, timings, etc.)

- **Live streaming indicator**: While generating, a small "~47 tokens • streaming" updates in the same style under the in-progress message.

- **Header consumption hint** (subtle, always visible): A tiny summary of the last turn's usage appears next to the ModelStatus pill in the chat header. Gives "at a glance" awareness without needing to scroll messages.

All stats are persisted with the messages (via the existing Tauri Store sessions), so history shows past consumption.

**No clutter**: Everything uses the existing 10-11px muted + mono + border tags language. Hover actions remain clean.

**Future foundation laid**:
- `stats` field on Message makes it easy to build the in-app model guide later (per-turn history + aggregate views).
- The formatModelStats helper is isolated and defensive.

## Implementation notes (for the Hub)

- Extended `Message` interface (additive, backward compatible).
- Wired `result.stats` (already produced by the core) into the final `updateLastMessage`.
- Live counter incremented on every `onToken` delta (simple, accurate enough for "during generation").
- Rendering added in the messages list right after sources (parallel to how sources are shown).
- Small header summary using useMemo + the same formatter.
- Pure UI/UX + tiny wiring. Zero changes to qvac loading, bridge, host, or model core (per phase rules).

## Learnings

- The backend has been giving us rich `stats` for free the whole time — we just weren't surfacing it. Great example of "the AI core is stable, now polish the UX around it".
- Live + final authoritative is the right pattern (live for delight, final for accuracy).
- Keeping the display extremely small and in existing visual "status language" (sources, ModelStatus) makes it feel native instead of bolted on.

## Backlog / Hub updates

New high-value item completed:
- [x] Minimalist model consumption stats in chat (tokens, context/prompt, speed)

Suggested new backlog items:
- Expand header to show session totals (cumulative tokens this conversation).
- Per-model usage history view (list past turns + aggregates).
- In-app "Model Guide" (as discussed): cards for the recommended models with Mac-specific RAM, speed on M-series, ctx recommendations, power/thermal notes. Trigger from info icon on model pill or in Settings.
- Make stats optional / toggle in Settings (for users who want ultra-minimal UI).
- When we support models with different ctx sizes, surface "X / ctx" more prominently.

## Commits & verification

- All changes on `ui/chat-usage-stats`.
- Type clean.
- Recommended manual verification (run on your Mac):
  - `pnpm tauri dev`
  - Several turns with varying prompt lengths
  - Check live counter + final stats on replies
  - Regenerate updates stats on the new reply
  - Stats persist after app restart (Tauri Store)
  - Visual: tiny, consistent with glass / sources tags, no overflow on 960px min window
  - Theming: works in the deep navy + electric blue aesthetic

---

**Ready to paste** as a new comment or "Done in this session" section in the UI Improvements Hub Notion page.

Reference the branch + this file for details.
