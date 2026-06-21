import { describe, it, expect } from "vitest";
import { getModelDisplayLabel, RECOMMENDED_LLM_MODELS, DEFAULT_LLM_MODEL } from "./settings";

describe("getModelDisplayLabel", () => {
  it('returns "No model" for undefined', () => {
    expect(getModelDisplayLabel(undefined)).toBe("No model");
  });

  it('returns "No model" for empty string', () => {
    expect(getModelDisplayLabel("")).toBe("No model");
  });

  it("returns a clean short label for known registry model IDs", () => {
    RECOMMENDED_LLM_MODELS.forEach(({ id }) => {
      const label = getModelDisplayLabel(id);
      expect(label.length).toBeGreaterThan(0);
      // Should strip the parenthetical detail "(Q4_0, ultra-light...)"
      expect(label).not.toContain("(");
    });
  });

  it("the default model has a usable display label", () => {
    const label = getModelDisplayLabel(DEFAULT_LLM_MODEL);
    expect(label).toContain("Llama");
  });

  it("strips .gguf extension from local file paths", () => {
    expect(getModelDisplayLabel("/Users/foo/models/my-custom-model.gguf")).toBe(
      "my-custom-model"
    );
  });

  it("returns the last path segment for custom paths without extension", () => {
    expect(getModelDisplayLabel("/path/to/custom-model")).toBe("custom-model");
    expect(getModelDisplayLabel("C:\\models\\local-llm")).toBe("local-llm");
  });

  it("truncates unknown IDs longer than 28 chars with an ellipsis", () => {
    const longId = "UNKNOWN_REGISTRY_ID_THAT_IS_WAY_TOO_LONG_FOR_UI";
    const label = getModelDisplayLabel(longId);
    expect(label).toContain("…");
    expect(label.length).toBeLessThanOrEqual(28);
  });

  it("returns short unknown IDs as-is", () => {
    const shortId = "MY_CUSTOM_ID";
    expect(getModelDisplayLabel(shortId)).toBe(shortId);
  });
});
