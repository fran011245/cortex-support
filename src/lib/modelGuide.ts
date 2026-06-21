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
  /** Number of parameters (for user decision making) */
  paramCount: string;
  /** Explicit minimum Mac specs for the model to run "relatively well" */
  minMacSpec: string;
  /** Honest note on factual fidelity / hallucination risk for this model size */
  fidelity: string;
  /** Show a "Recommended" badge in the model selector for better quality */
  recommended?: boolean;
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
    paramCount: "1 billion parameters",
    minMacSpec: "M1 (8 GB unified RAM minimum). Runs well on base MacBook Air for typical support volume.",
    fidelity: "Moderate to lower on factual precision. Smallest model — higher chance of minor hallucinations or simplified reasoning. Best for speed + high-volume simple tickets when paired with RAG.",
    recommended: false,
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
    paramCount: "1.7 billion parameters",
    minMacSpec: "M1/M2 (8–16 GB unified). Comfortable daily driver on most Apple Silicon Macs.",
    fidelity: "Better instruction following than 1B. Still limited factual grounding on complex or rare cases without strong RAG context.",
    recommended: true,
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
    paramCount: "4 billion parameters",
    minMacSpec: "M2 or newer recommended (16 GB+ unified for best experience). M1 base possible but expect more thermal/noise on longer generations.",
    fidelity: "Highest factual reliability and reasoning of the three, but still a small local model. Can hallucinate specifics (TXIDs, policy details, names). Always cross-check critical facts.",
    recommended: true,
  },
  {
    id: "DEEPSEEK_R1_7B",
    name: "DeepSeek R1 Distill 7B",
    quant: "Q4_K_M",
    ramMac: "~4-5 GB unified RAM",
    performanceMac: "Good on M2+ / M3/M4. Excellent reasoning for size.",
    ctx: "4k+",
    bestFor: "Complex reasoning, coding, math, analysis. Strong instruction following.",
    notes: "Distilled from R1, very capable for its size. Use via official HF for correct build.",
    speedVsQuality: "Slower than Qwen 1.7B but significantly better reasoning. Recommended for quality.",
    paramCount: "~7B parameters",
    minMacSpec: "M2 or newer with 16GB+ recommended.",
    fidelity: "High for open models. Still review for critical facts.",
    recommended: true,
  },
];

export const GUIDE_COMMON_NOTES = [
  "All models run 100% locally on Apple Silicon via QVAC (Metal acceleration).",
  "Default context: 4k tokens (tunable in advanced loads).",
  "Smaller models = longer battery life and cooler operation.",
  "Use the minimalist usage stats now shown in the chat (tokens in/out, context, t/s) to see real consumption on your specific Mac and prompts.",
  "All are instruction-tuned and work great with Cortex's professional support tone system prompt + RAG.",
  "Small local models have inherent fidelity limits. Enable RAG and review drafts — Cortex is a co-pilot, not an autonomous agent.",
];
