# Contributing to Cortex

Thank you for your interest in contributing to Cortex! We're building a high-quality, 100% local AI co-pilot for professional support teams, and community contributions help make it better for everyone.

## Code of Conduct

Be respectful, constructive, and assume good intent. Support work is high-pressure — we're here to build tools that reduce cognitive load, not add friction.

## Getting Started

### Prerequisites
- macOS (Apple Silicon strongly recommended for development)
- Rust (via rustup)
- pnpm

### Development Setup
```bash
git clone https://github.com/fran011245/cortex-support.git
cd cortex-support
pnpm install
pnpm tauri dev
```

The first run will download the default model. Use the **Settings** (gear icon or ⌘/,) to explore the full experience, including the Onboarding Wizard on clean profiles.

### Useful Commands
- `pnpm tauri dev` — Run with full logs and WebView DevTools (F12 / Cmd+Opt+I)
- `pnpm tauri build` — Production build (produces .app and .dmg)
- To simulate first-run: `rm -rf ~/.qvac/models/*` then restart

See the main [README.md](./README.md) for architecture details, debugging tips, and how the local QVAC integration works.

## Project Philosophy & Vision

Cortex is more than just another LLM wrapper. Key principles:

- **100% Local & Private** — Everything stays on the user's machine.
- **Professional Tone First** — The agent must feel like an expert colleague, not a generic chatbot.
- **Transparency** — Users should always understand what prompt the model is actually receiving (see the Live Effective Prompt in Settings).
- **Mac-Native Delight** — Glassmorphism, calm micro-interactions, excellent typography (Space Grotesk for the brand, Inter for body), and respect for the user's hardware (RAM-aware model guidance).
- **Customization Without Code** — The Settings experience (including the first-run wizard) is the primary way teams shape the agent.
- **Clarity Over Features** — Progressive disclosure. Powerful for power users, approachable for everyone.

Recent major UI work (the "suprema" phase) focused on:
- Beautiful 2×2 model selection grid with live states and integrated loading
- Prominent Live Effective Prompt as a first-class citizen
- Rebalanced, harmonious Settings layout
- First-run Onboarding Wizard that teaches the important concepts

When contributing UI/UX changes, please keep these principles in mind.

## How to Contribute

### Reporting Issues
- Use the GitHub Issues tab.
- Include: macOS version, steps to reproduce, screenshots or logs if relevant, and what you expected vs what happened.
- For model/RAG issues, mention which model you're using and whether RAG is enabled.

### Pull Requests
1. Fork the repo and create a feature branch from `main`.
2. Make your changes.
3. Test thoroughly:
   - Normal usage
   - First-run simulation (clear `~/.qvac/models` or settings)
   - The Onboarding Wizard flow
   - Settings changes apply live
4. Update documentation if your change affects user experience or setup.
5. Open a Pull Request against `main`.

We prefer small, focused PRs. For larger features (new tools, major architecture changes), please open an issue first to discuss.

### Areas Where Help is Welcome
- UI/UX polish and consistency (especially in Settings and the wizard)
- New high-value agent tools or templates
- Improved error states and empty states
- RAG UX improvements (folder management, rebuild feedback, relevance)
- Documentation, examples, and sample knowledge bases
- Cross-platform support (Windows/Linux)
- Performance, stability, or better model guidance for different hardware
- Accessibility and keyboard navigation

## Style & Quality Guidelines

- **TypeScript** — Strict mode is on. Avoid `any` when possible.
- **Components** — Prefer composition. The current SettingsModal and wizard show the desired level of polish and live reactivity.
- **State** — Use the existing Zustand store (`useAgentStore`) for global state. Local state for UI-only concerns.
- **Persistence** — Settings go through `updateSettings` / Tauri Store. Don't bypass it.
- **Live Apply** — Changes in Settings should feel instant. Protect this behavior.
- **Theming** — Stick to the existing glassmorphism + deep navy + accent system. Use Tailwind + the CSS variables in `index.css`.
- **Fonts** — "Cortex" uses Space Grotesk. Body text and most UI uses Inter.
- **Logo** — The brain icon is the official mark. Use the asset from `assets/cortex-logo.svg` (or the React import if available). Do not create new logo variations without discussion.

## Commit Messages

Use clear, descriptive messages. Examples:
- `feat(ui): add live token estimate to Effective Prompt card`
- `fix(onboarding): prevent wizard from re-showing after skip on same profile`
- `docs: improve first-run instructions in README`

## Questions?

Open an issue with the `question` label or start a discussion. We're happy to help people get set up, especially if you're new to Tauri or local LLMs.

---

Thank you for helping make support agents more effective while keeping everything private and under their control. Every good contribution makes a real difference for the people who use this every day.

Built with respect for the craft of support work.