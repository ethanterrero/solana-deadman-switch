// Small formatting helpers shared across the UI.

export function shortAddr(addr: string | null | undefined, head = 4, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 3) return addr;
  return addr.slice(0, head) + "..." + addr.slice(-tail);
}

export function fmtSeconds(s: number): string {
  if (s === 0) return "off";
  if (s >= 86400) return Math.floor(s / 86400) + "D";
  if (s >= 3600) return Math.floor(s / 3600) + "H";
  if (s >= 60) return Math.floor(s / 60) + "M";
  return s + "s";
}

export function fmtInterval(days: number): string {
  if (days >= 365 && days % 365 === 0) {
    const y = days / 365;
    return y + " YEAR" + (y > 1 ? "S" : "");
  }
  if (days >= 30 && days % 30 === 0) return days / 30 + " MO";
  if (days >= 7 && days % 7 === 0) return days / 7 + " WK";
  return days + " DAY" + (days > 1 ? "S" : "");
}

export function fmtUtc(ts: number | Date): string {
  const d = ts instanceof Date ? ts : new Date(ts);
  return (
    d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }) + " UTC"
  );
}

/** Decompose remaining seconds into days/hours/min/sec parts (clamped at 0). */
export function decomposeRemaining(seconds: number) {
  const r = Math.max(0, Math.floor(seconds));
  return {
    days: Math.floor(r / 86400),
    hours: Math.floor((r % 86400) / 3600),
    mins: Math.floor((r % 3600) / 60),
    secs: r % 60,
  };
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

/** Cheap client-side base58 + length check. Real validation is PublicKey.isOnCurve. */
export function looksLikeSolanaAddress(s: string): boolean {
  const v = s.trim();
  return v.length >= 32 && v.length <= 44 && BASE58_RE.test(v);
}
