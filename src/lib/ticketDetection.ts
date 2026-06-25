/**
 * Heuristic detection of common support ticket categories.
 * Used by the "Paste a customer message" workflow to give the agent
 * a little extra context without requiring the user to classify manually.
 *
 * This is intentionally simple and keyword-based. It is *not* a classifier model.
 * Falls back gracefully.
 */
export function detectTicketType(text: string): string | null {
  const t = text.toLowerCase();

  if (/\b(txid|withdrawal|withdraw|pending transfer|stuck|not arrived)\b/.test(t)) {
    return "withdrawal inquiry";
  }
  if (/\b(deposit|credited|not received|missing funds|not showing)\b/.test(t)) {
    return "deposit inquiry";
  }
  if (/\b(kyc|verification|document|identity|id proof|account limit)\b/.test(t)) {
    return "KYC / verification";
  }
  if (/\b(api|endpoint|rate.?limit|signature|nonce|api key|integration)\b/.test(t)) {
    return "API / integration issue";
  }
  if (/\bcompromis|\b(2fa|hacked|suspicious|unauthorized|account.?access|security)\b/.test(t)) {
    return "security concern";
  }

  if (text.trim().length > 40) {
    return "support ticket";
  }

  return null;
}
