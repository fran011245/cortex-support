/**
 * In-app Model Guide data — focused on Mac (Apple Silicon) users.
 * Hardcoded, easy to extend. Ties into the new chat usage stats for real-world consumption awareness.
 *
 * All models are small quantized instruction-tuned GGUF models running 100% locally via QVAC.
 * Optimized for Apple Silicon unified memory. No cloud, low power/thermal impact.
 */

export interface ModelGuideEntry {
  id: string;
  name: string;
  quant: string;
  ramMac: string; // approximate unified memory usage on Mac
  performanceMac: string; // notes for M1 / M2 / M3 / M4
  ctx: string;
  bestFor: string;
  notes: string;
  speedVsQuality: string;
}

export const MODEL_GUIDE: ModelGuideEntry[] = [
  {
    id: "LLAMA_3_2_1B_INST_Q4_0",
    name: "Llama 3.2 1B Instruct",
    quant: "Q4_0",
    ramMac: "~0.8–1.5 GB unified RAM",
    performanceMac: "Blazing fast on any M1+. Excellent battery life and very low heat. Snappy even on base MacBook Air.",
    ctx: "4k (default)",
    bestFor: "Most support tickets, quick drafts, simple queries, high-volume days.",
    notes: "Ultra-lightweight champion. Pairs perfectly with the new chat usage stats — you'll see very low token counts and fast responses.",
    speedVsQuality: "Fastest of the three. Great quality for its size; ideal daily driver on Mac.",
  },
  {
    id: "QWEN3_1_7B_INST_Q4",
    name: "Qwen3 1.7B Instruct",
    quant: "Q4",
    ramMac: "~1.2–2.2 GB unified RAM",
    performanceMac: "Very responsive on M1/M2. Still excellent battery/thermal profile. M3/M4 feel even smoother.",
    ctx: "4k (default)",
    bestFor: "Nuanced tickets (KYC, API issues, policy questions) where better instruction following helps.",
    notes: "Strong balance. The new stats in chat will show you the real token cost of more sophisticated replies.",
    speedVsQuality: "Slightly slower than 1B but noticeably smarter. Still very Mac-friendly.",
  },
  {
    id: "QWEN3_4B_INST_Q4_K_M",
    name: "Qwen3 4B Instruct",
    quant: "Q4_K_M",
    ramMac: "~2.5–4 GB unified RAM (M2+ or M3/M4 recommended for best experience)",
    performanceMac: "Comfortable on M2 Pro/Max and newer. M1 base will work but may feel warmer/louder on long sessions. Great on M3/M4.",
    ctx: "4k (default)",
    bestFor: "Complex or long-context support work, deeper reasoning, security/compliance replies.",
    notes: "Highest quality of the three while still being local and quantized. Use the chat stats to monitor consumption on longer threads.",
    speedVsQuality: "Best quality. Worth the extra resources when the ticket deserves it.",
  },
];

export const GUIDE_COMMON_NOTES = [
  "All models run 100% locally on Apple Silicon via QVAC (Metal acceleration).",
  "Default context: 4k tokens (tunable in advanced loads).",
  "Smaller models = longer battery life and cooler operation.",
  "Use the minimalist usage stats now shown in the chat (tokens in/out, context, t/s) to see real consumption on your specific Mac and prompts.",
  "All are instruction-tuned and work great with Cortex's professional support tone system prompt + RAG.",
];
