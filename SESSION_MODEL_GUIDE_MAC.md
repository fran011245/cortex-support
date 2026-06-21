# Done in this session — In-App Model Guide (Mac-Optimized)

**Date**: 2026-06-06
**Branch**: ui/in-app-model-guide
**Previous context**: Chat usage stats (tokens / context / speed) already landed and visible in chat + header. This completes the full request.

## What was delivered

A polished, discoverable **in-app guide** for the three recommended models, with all content focused on **Apple Silicon / Mac** realities:

- Entry point: "Guía de modelos (Mac)" ghost button with Info icon, placed right in the model selection area of Settings → General (after the recommended chips).
- Optional: Small (i) icon next to the ModelStatus in the chat header that opens Settings (guide is the prominent new thing in General).
- When clicked → beautiful Dialog "Guía de Modelos — Optimizado para Mac" with 3 glass cards.
- Each card contains:
  - Name + quant + ctx
  - RAM en Mac (unified memory estimates)
  - Performance en Apple Silicon (M1/M2/M3/M4 notes, thermal/battery)
  - Mejor para (support ticket types)
  - Velocidad vs Calidad
  - Notes that explicitly reference the new chat usage stats
- Common notes section + tip about using stats + guide together.
- Data lives in clean `src/lib/modelGuide.ts` (easy to extend later).

All styling reuses the existing glass + navy + blue accent + small text language. No new heavy dependencies.

## Key files
- `src/lib/modelGuide.ts` (new data + types)
- `src/components/SettingsModal.tsx` (trigger + full guide Dialog + state)
- `src/components/ChatInterface.tsx` (small optional info icon in header)

## How it advances the UI phase + ties to previous work
- Completes the user's explicit request: stats for consumption visibility + educational guide with Mac technical requirements.
- The guide directly references the minimalist stats we added ("Las estadísticas minimalistas de consumo que ahora ves en el chat...").
- Makes model choice intentional instead of trial-and-error on Mac hardware.
- Pure UI/UX, zero impact on the stable AI core.

## Learnings / notes for Hub
- Small, contextual "info" affordances (button + icon) feel native and don't clutter the main flows.
- Hardcoded Mac-focused data is the right call for v1 (no network, easy maintenance, real user value).
- Dialog keeps the guide "in-app" without polluting the Settings tabs.

## Backlog / Hub updates
- [x] In-app model guide with Mac technical requirements and characteristics (ties to new chat stats)
- Suggested follow-ups:
  - Make the guide also available as a standalone popover or command-palette item.
  - Add more models or advanced notes (e.g. ctx tuning impact on RAM).
  - Bilingual (ES/EN) version of the guide text if needed for users.

## Verification performed
- TypeScript clean.
- Visual consistency with existing glass/dialog/chip patterns.
- Trigger works from both Settings and (lightly) from chat header.
- Content is scannable, Mac-specific, and references the consumption stats feature.

## Next steps (per Hub protocol)
- Merge the branch (or PR).
- Paste this text (or the shorter version) as a "Done in this session" update on the UI Improvements Hub Notion page.
- Optionally create corresponding tasks in the Cortex UI Tasks DB.

**References**: ui/in-app-model-guide branch, modelGuide.ts, the stats work from the prior session.

Ready for user review + Notion update.
