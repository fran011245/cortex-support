import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  estimateTokens,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TONE_RULES,
  QUICK_TEMPLATES,
} from "./prompts";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("returns at least 1 for any non-empty string", () => {
    expect(estimateTokens("hi")).toBeGreaterThanOrEqual(1);
  });

  it("scales with text length", () => {
    const short = estimateTokens("hello");
    const long = estimateTokens("hello ".repeat(100));
    expect(long).toBeGreaterThan(short);
  });

  it("approximates ~3.7 chars per token", () => {
    // 370 chars ≈ 100 tokens
    const count = estimateTokens("a".repeat(370));
    expect(count).toBeGreaterThanOrEqual(95);
    expect(count).toBeLessThanOrEqual(105);
  });
});

describe("buildSystemPrompt", () => {
  it("returns base prompt unchanged when all tone rules are off", () => {
    const result = buildSystemPrompt("Base prompt", {
      style: "Professional",
      alwaysUseFullSentences: false,
      noEmojis: false,
      beDirectButPolite: false,
      prioritizeSecurity: false,
    });
    expect(result).toBe("Base prompt");
  });

  it("appends ADDITIONAL TONE RULES section when rules are enabled", () => {
    const result = buildSystemPrompt("Base", {
      ...DEFAULT_TONE_RULES,
      maxLength: undefined,
    });
    expect(result).toContain("ADDITIONAL TONE RULES");
    expect(result).toContain("complete, properly punctuated sentences");
    expect(result).toContain("Never include emojis");
    expect(result).toContain("direct and polite");
    expect(result).toContain("security best practices");
  });

  it("includes maxLength guidance when set", () => {
    const result = buildSystemPrompt("Base", { ...DEFAULT_TONE_RULES, maxLength: 140 });
    expect(result).toContain("140 words");
  });

  it("appends extra instructions under their own section", () => {
    const result = buildSystemPrompt("Base", DEFAULT_TONE_RULES, "Always include ticket ID.");
    expect(result).toContain("AGENT-SPECIFIC INSTRUCTIONS");
    expect(result).toContain("Always include ticket ID.");
  });

  it("ignores blank extra instructions", () => {
    const result = buildSystemPrompt("Base", DEFAULT_TONE_RULES, "   ");
    expect(result).not.toContain("AGENT-SPECIFIC INSTRUCTIONS");
  });

  it("uses DEFAULT_SYSTEM_PROMPT when called with no arguments", () => {
    const result = buildSystemPrompt();
    expect(result).toContain("You are Cortex");
  });

  it("extra instructions appear after tone rules, not before", () => {
    const result = buildSystemPrompt("Base", DEFAULT_TONE_RULES, "Extra note.");
    const toneIndex = result.indexOf("ADDITIONAL TONE RULES");
    const extraIndex = result.indexOf("AGENT-SPECIFIC INSTRUCTIONS");
    expect(toneIndex).toBeLessThan(extraIndex);
  });
});

describe("DEFAULT_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof DEFAULT_SYSTEM_PROMPT).toBe("string");
    expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("mentions Cortex and professional support context", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Cortex");
    expect(DEFAULT_SYSTEM_PROMPT).toContain("customer support");
  });
});

describe("QUICK_TEMPLATES", () => {
  const expectedKeys = [
    "withdrawalIssue",
    "depositMissing",
    "kycHelp",
    "apiIssue",
    "securityConcern",
    "generalAck",
  ] as const;

  it("has all expected template keys", () => {
    expectedKeys.forEach((key) => {
      expect(QUICK_TEMPLATES).toHaveProperty(key);
    });
  });

  it("every template is a non-empty string", () => {
    Object.values(QUICK_TEMPLATES).forEach((template) => {
      expect(typeof template).toBe("string");
      expect(template.trim().length).toBeGreaterThan(0);
    });
  });
});
