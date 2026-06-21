import { describe, it, expect } from "vitest";
import { detectTicketType } from "./ticketDetection";

describe("detectTicketType", () => {
  describe("withdrawal inquiries", () => {
    it.each([
      "my withdrawal is stuck",
      "TXID not found on chain",
      "pending transfer to external wallet",
      "funds not arrived after withdraw",
    ])('detects "%s"', (text) => {
      expect(detectTicketType(text)).toBe("withdrawal inquiry");
    });
  });

  describe("deposit inquiries", () => {
    it.each([
      "my deposit is not credited",
      "missing funds from yesterday",
      "deposit not showing in balance",
      "funds not received after transfer",
    ])('detects "%s"', (text) => {
      expect(detectTicketType(text)).toBe("deposit inquiry");
    });
  });

  describe("KYC / verification", () => {
    it.each([
      "I need help with KYC",
      "please verify my identity document",
      "account limit requires id proof",
      "verification is pending",
    ])('detects "%s"', (text) => {
      expect(detectTicketType(text)).toBe("KYC / verification");
    });
  });

  describe("API / integration issues", () => {
    it.each([
      "api key not working",
      "signature error on the endpoint",
      "hit the rate limit again",
      "nonce mismatch on request",
      "integration with your api fails",
    ])('detects "%s"', (text) => {
      expect(detectTicketType(text)).toBe("API / integration issue");
    });
  });

  describe("security concerns", () => {
    it.each([
      "my account was hacked",
      "suspicious 2fa request I did not initiate",
      "unauthorized access to account",
      "account compromised",
    ])('detects "%s"', (text) => {
      expect(detectTicketType(text)).toBe("security concern");
    });
  });

  describe("fallback behavior", () => {
    it('returns "support ticket" for long unmatched text', () => {
      const long = "I have a general question about how the platform works for new users";
      expect(detectTicketType(long)).toBe("support ticket");
    });

    it("returns null for short unmatched text", () => {
      expect(detectTicketType("hi")).toBeNull();
      expect(detectTicketType("help")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(detectTicketType("")).toBeNull();
    });
  });

  describe("case insensitivity", () => {
    it("matches regardless of case", () => {
      expect(detectTicketType("MY WITHDRAWAL IS STUCK")).toBe("withdrawal inquiry");
      expect(detectTicketType("KYC Pending Review")).toBe("KYC / verification");
      expect(detectTicketType("API KEY INVALID")).toBe("API / integration issue");
    });
  });

  describe("priority order", () => {
    it("withdrawal takes priority over deposit when both keywords present", () => {
      // TXID is a withdrawal keyword; the function checks withdrawal first
      expect(detectTicketType("TXID for deposit not credited")).toBe("withdrawal inquiry");
    });
  });
});
