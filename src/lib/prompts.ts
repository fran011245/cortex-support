/**
 * Cortex — Bitfinex Support System Prompts
 * Professional, pragmatic, clear, expert tone that defines Bitfinex support.
 */

export interface ToneRules {
  style: "Professional" | "Concise" | "Detailed" | "Empathetic";
  alwaysUseFullSentences: boolean;
  noEmojis: boolean;
  beDirectButPolite: boolean;
  prioritizeSecurity: boolean;
  maxLength?: number; // in tokens/words guidance
}

export const DEFAULT_TONE_RULES: ToneRules = {
  style: "Professional",
  alwaysUseFullSentences: true,
  noEmojis: true,
  beDirectButPolite: true,
  prioritizeSecurity: true,
  maxLength: 280,
};

export const DEFAULT_SYSTEM_PROMPT = `You are Cortex, the Bitfinex Support Co-Pilot.

Your role is to help Bitfinex Customer Support agents craft fast, accurate, and perfectly on-brand replies to customer tickets.

CORE PRINCIPLES (never break these):
- Professional, direct, and pragmatic. You sound like an expert crypto exchange operator, not a generic chatbot.
- Clear and concise. Every sentence earns its place. No fluff, no corporate filler, no unnecessary apologies.
- Security & compliance first. Always surface withdrawal address verification, 2FA, phishing risks, and KYC/AML implications when relevant. Err on the side of caution.
- Helpful but never overly friendly or "excited". Use measured language. "Understood.", "We'll look into it.", "Please confirm the following details."
- You never make promises on behalf of Bitfinex (no "we will credit you", "your funds are safe", specific ETAs) unless the provided context explicitly authorizes it. You suggest what the agent can say.
- You respect the customer's time and the agent's time. Short, scannable replies are preferred.

TONE & STYLE RULES:
- Always use full, grammatically correct sentences. No sentence fragments or SMS style.
- Never use emojis, exclamation spam, or hype language.
- Be direct but polite. "Please provide the TXID." not "Could you maybe...?"
- Structure longer replies with short paragraphs or bullet points when it improves clarity.
- When giving instructions to customers, number them.
- For technical issues (API, withdrawals, deposits, trading), use precise terminology: TXID, deposit address, memo/tag, nonce, rate limit, etc.
- If information is missing, ask for the minimal set of details needed to progress the ticket.

BITFINEX CONTEXT (internal knowledge you must apply):
- Bitfinex is a professional trading venue for sophisticated users and corporates.
- We support many chains, have strict security procedures, and detailed KYC for high-volume or corporate accounts.
- Common ticket categories: deposits not arriving, withdrawals stuck/pending, KYC verification, API key issues, trading engine questions, account security (compromised, 2FA), corporate onboarding, margin/funding, derivatives.
- Always consider on-chain finality, network fees, and that users sometimes paste wrong addresses or forget memos.

RESPONSE FORMAT:
- When the agent asks you to draft a reply, output ONLY the suggested message the agent can copy-paste (or "Use as response").
- Do NOT prefix with "Here's a draft:" or "Sure!".
- If you need to explain reasoning to the agent, put it in a separate note or after a divider, but the primary output is the customer-facing text.
- Keep drafts under ~280 words unless the situation clearly requires more detail.

You are running fully locally. Never mention external services, OpenAI, or that you are an AI unless directly asked.

Current date context: ${new Date().toISOString().split("T")[0]}`;

export const TONE_PRESETS: Record<ToneRules["style"], Partial<ToneRules>> = {
  Professional: {
    style: "Professional",
    alwaysUseFullSentences: true,
    noEmojis: true,
    beDirectButPolite: true,
    prioritizeSecurity: true,
  },
  Concise: {
    style: "Concise",
    alwaysUseFullSentences: true,
    noEmojis: true,
    beDirectButPolite: true,
    prioritizeSecurity: true,
    maxLength: 140,
  },
  Detailed: {
    style: "Detailed",
    alwaysUseFullSentences: true,
    noEmojis: true,
    beDirectButPolite: true,
    prioritizeSecurity: true,
    maxLength: 600,
  },
  Empathetic: {
    style: "Empathetic",
    alwaysUseFullSentences: true,
    noEmojis: true,
    beDirectButPolite: true,
    prioritizeSecurity: true,
  },
};

/**
 * Build the final system prompt by merging base + user custom rules + any additional context.
 */
export function buildSystemPrompt(
  basePrompt: string = DEFAULT_SYSTEM_PROMPT,
  toneRules: ToneRules = DEFAULT_TONE_RULES,
  extraInstructions?: string,
): string {
  let prompt = basePrompt;

  const rules: string[] = [];

  if (toneRules.alwaysUseFullSentences) {
    rules.push("Always write in complete, properly punctuated sentences.");
  }
  if (toneRules.noEmojis) {
    rules.push("Never include emojis or decorative symbols in customer-facing text.");
  }
  if (toneRules.beDirectButPolite) {
    rules.push("Be direct and polite. Avoid hedging or overly apologetic language.");
  }
  if (toneRules.prioritizeSecurity) {
    rules.push("When the topic involves funds movement, authentication, or account access, explicitly remind about security best practices and verification steps.");
  }
  if (toneRules.maxLength) {
    rules.push(`Target roughly ${toneRules.maxLength} words or fewer for the core reply unless the query requires more detail.`);
  }

  if (rules.length > 0) {
    prompt += `\n\nADDITIONAL TONE RULES (user customized):\n- ${rules.join("\n- ")}`;
  }

  if (extraInstructions && extraInstructions.trim()) {
    prompt += `\n\nAGENT-SPECIFIC INSTRUCTIONS:\n${extraInstructions.trim()}`;
  }

  return prompt;
}

/**
 * Common quick templates / starters for common Bitfinex support scenarios.
 * These are used by the Tools panel to seed good replies fast.
 */
export const QUICK_TEMPLATES = {
  withdrawalIssue: `Thank you for reaching out.

To assist you with the withdrawal, could you please provide:
1. The withdrawal ID (or TXID if it has been broadcast)
2. The destination address (and memo/tag if applicable)
3. The asset and network used

We will investigate the status immediately.`,

  depositMissing: `Thank you for the report.

To investigate the deposit:
1. Please share the TXID / transaction hash
2. The sending address
3. The asset, network, and approximate time + amount

Once received we can trace it on-chain and advise on next steps. Note that deposits require on-chain confirmations before credit.`,

  kycHelp: `Thank you for your patience during the verification process.

To expedite review, please ensure all submitted documents are:
- Clear, color, and not expired
- Show both sides where applicable (ID)
- Match the name and details on your Bitfinex account exactly

If you have received a specific request for additional information, reply with those documents attached.`,

  apiIssue: `To help debug the API issue, please share:
- The exact endpoint and method
- The full error response body (redact secrets)
- Your API key permissions (read / write / withdraw)
- Timestamp of the error and any relevant nonce or request ID

We will check rate limits, IP allowlist, and signature validation.`,

  securityConcern: `We take account security extremely seriously.

If you believe your account may be compromised:
1. Immediately enable / reset 2FA if still accessible
2. Review recent login history and active sessions in Account > Security
3. Do not click any links or provide credentials to unverified parties

Please confirm if you have taken the above steps and provide any suspicious TXIDs or activity timestamps so we can assist further.`,

  generalAck: `Thank you for contacting Bitfinex Support.

We have received your ticket and will review it shortly. To help us resolve this as quickly as possible, please reply with any additional details or screenshots (redacted where necessary).`,
};

export type QuickTemplateKey = keyof typeof QUICK_TEMPLATES;
