import { formatINR } from "@creatorx/schema/india";

/** Format paise → "₹1,20,000" (Indian lakh/crore comma style). Kept as fmtMoney for backwards compatibility across the app. */
export function fmtMoney(paise: number, opts?: { compact?: boolean; sign?: boolean }) {
  const s = formatINR(Math.abs(paise), { compact: opts?.compact });
  if (opts?.sign) {
    return (paise < 0 ? "-" : "+") + s;
  }
  return (paise < 0 ? "-" : "") + s;
}

export { formatINR };

export function fmtCompact(n: number) {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(n >= 10_00_00_000 ? 0 : 1)}Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(n >= 10_00_000 ? 0 : 1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString("en-IN");
}

export function fmtDate(iso: string, style: "short" | "long" | "month-day" = "short") {
  const d = new Date(iso);
  if (style === "long") {
    return d.toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
  if (style === "month-day") {
    return d.toLocaleString("en-IN", { month: "short", day: "numeric" });
  }
  return d.toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export function humanizeCount(n: number, unit: string) {
  if (n === 1) return `1 ${unit}`;
  return `${n.toLocaleString("en-IN")} ${unit}s`;
}

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
