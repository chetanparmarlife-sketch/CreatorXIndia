/**
 * CreatorX — Indian compliance + money utilities
 *
 * - Money is stored as paise (1 INR = 100 paise).
 * - All tax math (TDS/GST) is server-side authoritative.
 * - Validators are field-level; server re-validates on every write.
 */

import type { CreatorTier } from "./schema";

// ---------- Money formatting (INR) ----------

/** Format paise → human-readable "₹1,20,000" (Indian lakh comma style). */
export function formatINR(paise: number, opts: { decimals?: boolean; compact?: boolean } = {}): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);

  if (opts.compact) {
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(abs >= 10_00_00_000 ? 0 : 2).replace(/\.?0+$/, "")} Cr`;
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(abs >= 10_00_000 ? 0 : 2).replace(/\.?0+$/, "")} L`;
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace(/\.?0+$/, "")}k`;
  }

  // Indian comma format: 12,34,56,789.00
  const whole = Math.floor(abs);
  const decimals = opts.decimals ? `.${Math.round((abs - whole) * 100).toString().padStart(2, "0")}` : "";
  const s = whole.toString();
  let result: string;
  if (s.length <= 3) {
    result = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    const restWithCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    result = `${restWithCommas},${last3}`;
  }
  return `${sign}₹${result}${decimals}`;
}

/** Parse a rupee amount string → paise. "1,20,000" or "1.2L" → 12000000 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

// ---------- Indian tier computation ----------

export function computeTier(totalReach: number): CreatorTier {
  if (totalReach >= 1_000_000) return "mega";
  if (totalReach >= 500_000) return "macro";
  if (totalReach >= 100_000) return "mid";
  if (totalReach >= 10_000) return "micro";
  return "nano";
}

export function tierLabel(t: CreatorTier): string {
  return {
    nano: "Nano (1k–10k)",
    micro: "Micro (10k–100k)",
    mid: "Mid-tier (100k–500k)",
    macro: "Macro (500k–1M)",
    mega: "Mega (1M+)",
  }[t];
}

// ---------- Validators (Indian formats) ----------

/** PAN format: 5 letters + 4 digits + 1 letter. Case-insensitive input; upper-case on store. */
export function isValidPAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase());
}

/** GSTIN: 2-digit state code + 10-char PAN + 1 entity + Z + 1 checksum (15 chars total). */
export function isValidGSTIN(gstin: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin.toUpperCase());
}

/** IFSC: 4 letters + 0 + 6 alphanumeric. */
export function isValidIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

/** UPI VPA: something@bank, loosely enforced (NPCI allows most chars). */
export function isValidUPI(upi: string): boolean {
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(upi);
}

/** Indian phone: optional +91, then 10 digits starting with 6-9. */
export function isValidIndianPhone(phone: string): boolean {
  return /^(\+?91)?[6-9][0-9]{9}$/.test(phone.replace(/[\s-]/g, ""));
}

/** Aadhaar last 4: 4 digits only. */
export function isValidAadhaarLast4(s: string): boolean {
  return /^[0-9]{4}$/.test(s);
}

// ---------- Tax computation (India) ----------

/**
 * TDS Section 194R (Finance Act 2022): 10% TDS on benefits / perquisites
 * to resident creators (including cash + product) if cumulative exceeds ₹20,000 in FY.
 * Threshold is per FY, and we deduct only on the portion AFTER the threshold is crossed.
 */
export const TDS_THRESHOLD_PAISE = 20_000 * 100; // ₹20,000/year
export const TDS_RATE = 0.10;                    // 10% — no PAN → 20%
export const GST_RATE = 0.18;                    // 18% IGST

export interface WithdrawalTaxBreakup {
  gross_cents: number;
  tds_cents: number;
  gst_cents: number;
  net_cents: number;
  tds_reason: string;
  gst_reason: string;
}

/**
 * Compute the tax breakup for a withdrawal.
 * - TDS is deducted when creator FY earnings already exceed the threshold
 *   OR will cross it with this withdrawal. We apply 10% on the taxable portion.
 * - GST is ADDED (not deducted) if creator provided a valid GSTIN —
 *   they invoice the platform for their service fee + 18% IGST.
 *   If no GSTIN, no GST component.
 * - Without PAN, TDS rate becomes 20% under Sec 206AA.
 */
export function computeWithdrawalTax(params: {
  gross_cents: number;
  fy_earned_before_cents: number;     // creator's FY earnings that have ALREADY been paid out
  has_pan: boolean;
  has_gstin: boolean;
}): WithdrawalTaxBreakup {
  const { gross_cents, fy_earned_before_cents, has_pan, has_gstin } = params;

  const tdsRate = has_pan ? TDS_RATE : 0.20;

  // TDS is on amount that falls ABOVE the ₹20k threshold this FY.
  const remainingBelowThreshold = Math.max(0, TDS_THRESHOLD_PAISE - fy_earned_before_cents);
  const taxablePortion = Math.max(0, gross_cents - remainingBelowThreshold);
  const tds_cents = Math.round(taxablePortion * tdsRate);

  const gst_cents = has_gstin ? Math.round(gross_cents * GST_RATE) : 0;

  const net_cents = gross_cents - tds_cents + gst_cents;

  return {
    gross_cents,
    tds_cents,
    gst_cents,
    net_cents,
    tds_reason: tds_cents === 0
      ? `Under ₹20,000 FY threshold (Sec 194R)`
      : has_pan
        ? `10% TDS on ₹${(taxablePortion / 100).toLocaleString("en-IN")} (Sec 194R)`
        : `20% TDS — no PAN (Sec 206AA)`,
    gst_reason: has_gstin
      ? `18% GST (IGST) added \u2014 creator invoices platform`
      : `No GST \u2014 creator not GST-registered`,
  };
}

// ---------- Payout method routing ----------

/** UPI limit per NPCI: ₹1,00,000 per transaction (standard) — we route > 1L to bank. */
export const UPI_LIMIT_PAISE = 1_00_000 * 100;

export function suggestedPayoutMethod(amount_cents: number, hasUpi: boolean, hasBank: boolean): { method: "upi" | "bank" | null; reason: string } {
  if (amount_cents <= UPI_LIMIT_PAISE && hasUpi) {
    return { method: "upi", reason: `Under ₹1,00,000 \u2014 instant UPI` };
  }
  if (hasBank) {
    return { method: "bank", reason: amount_cents > UPI_LIMIT_PAISE ? `Over ₹1,00,000 \u2014 bank IMPS/NEFT` : `Bank transfer` };
  }
  return { method: null, reason: `Add a UPI ID or bank account to withdraw` };
}

/** Generate a GSTIN-style invoice number: CRX/FY/NNNN */
export function nextInvoiceNumber(count: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  // Indian FY: Apr 1 – Mar 31
  const fyStart = m >= 3 ? y : y - 1;
  const fy = `${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
  return `CRX/${fy}/${String(count + 1).padStart(4, "0")}`;
}

// ---------- Campaign eligibility ----------

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];   // [] when eligible, otherwise human-readable blockers
}

export function checkCampaignEligibility(params: {
  niches: string[];
  total_reach: number;
  tier: CreatorTier;
  avg_engagement: number;
  city: string | null;
  languages: string[];
  kyc_status: string;
  verified_handle: boolean;
}, campaign: {
  required_niches: string[];
  min_followers: number;
  max_followers: number;
  allowed_tiers: CreatorTier[];
  preferred_cities: string[];
  preferred_languages: string[];
  min_engagement_rate: number;
  requires_kyc: boolean;
  base_earning_cents: number;
}): EligibilityResult {
  const reasons: string[] = [];

  if (campaign.required_niches.length > 0) {
    const overlap = params.niches.some(n => campaign.required_niches.includes(n));
    if (!overlap) reasons.push(`Niche mismatch \u2014 needs ${campaign.required_niches.join(" / ")}`);
  }

  if (campaign.min_followers > 0 && params.total_reach < campaign.min_followers) {
    reasons.push(`Need ${campaign.min_followers.toLocaleString("en-IN")}+ total followers`);
  }
  if (campaign.max_followers > 0 && params.total_reach > campaign.max_followers) {
    reasons.push(`Audience too large for this campaign (cap ${campaign.max_followers.toLocaleString("en-IN")})`);
  }

  if (campaign.allowed_tiers.length > 0 && !campaign.allowed_tiers.includes(params.tier)) {
    reasons.push(`Tier mismatch \u2014 this is for ${campaign.allowed_tiers.map(tierLabel).join(", ")}`);
  }

  if (campaign.min_engagement_rate > 0 && params.avg_engagement < campaign.min_engagement_rate) {
    reasons.push(`Engagement too low \u2014 needs ${campaign.min_engagement_rate}%+ (you: ${params.avg_engagement}%)`);
  }

  if (campaign.preferred_cities.length > 0 && params.city && !campaign.preferred_cities.includes(params.city)) {
    reasons.push(`Preferred cities: ${campaign.preferred_cities.join(", ")}`);
  }

  if (campaign.preferred_languages.length > 0) {
    const overlap = params.languages.some(l => campaign.preferred_languages.includes(l));
    if (!overlap) reasons.push(`Needs content in: ${campaign.preferred_languages.join(", ")}`);
  }

  if (!params.verified_handle) {
    reasons.push(`Verify your social handle first`);
  }

  if (campaign.requires_kyc && params.kyc_status !== "verified") {
    reasons.push(`KYC required (campaign fee exceeds ₹20,000)`);
  }

  return { eligible: reasons.length === 0, reasons };
}
