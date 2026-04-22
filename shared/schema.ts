/**
 * CreatorX — Shared schema
 *
 * This is the single source of truth for data shapes used by both the
 * in-memory mock backend and (eventually) Supabase. The SQL migration in
 * /supabase/migration.sql mirrors these tables exactly.
 */

// ---------- Enums ----------

export type UserRole = "creator" | "admin";

export type CampaignStatus = "draft" | "open" | "closed" | "completed";

export type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type DeliverableStatus =
  | "pending"       // campaign accepted, creator hasn't submitted
  | "submitted"     // creator submitted draft
  | "revision"      // brand/admin asked for changes
  | "approved"      // approved — pending go-live
  | "live"          // content posted
  | "rejected";     // fully rejected

export type TransactionType =
  | "earning"       // campaign payout credited
  | "withdrawal"    // cash-out to bank
  | "bonus"
  | "adjustment";

export type TransactionStatus = "pending" | "completed" | "failed";

export type WithdrawalStatus =
  | "requested"
  | "approved"
  | "paid"
  | "rejected";

export type SocialPlatform =
  | "instagram"
  | "youtube"
  | "twitter"
  | "linkedin";

// Indian influencer tiers (by follower count)
export type CreatorTier = "nano" | "micro" | "mid" | "macro" | "mega";

// KYC verification status (RBI-aligned)
export type KycStatus = "none" | "pending" | "verified" | "rejected";

// Payout payment method — UPI for small, IMPS/NEFT bank for large
export type PayoutMethod = "upi" | "bank";

// Indian niches — common categories on Indian platforms
export const INDIAN_NICHES = [
  "Fashion", "Beauty", "Fitness", "Food", "Tech", "Finance",
  "Travel", "Parenting", "Education", "Entertainment",
  "Lifestyle", "Gaming", "Automotive",
] as const;
export type IndianNiche = typeof INDIAN_NICHES[number];

// Indian cities — tier 1 & 2
export const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
  "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Chandigarh", "Kochi",
  "Indore", "Surat", "Nagpur", "Bhopal", "Patna", "Guwahati",
  "Goa", "Coimbatore", "Other",
] as const;

// Content languages
export const INDIAN_LANGUAGES = [
  "Hindi", "English", "Hinglish", "Tamil", "Telugu", "Marathi",
  "Bengali", "Gujarati", "Kannada", "Malayalam", "Punjabi",
] as const;

export type EventKind = "event" | "perk" | "news";

export type NotificationKind =
  | "application_accepted"
  | "application_rejected"
  | "deliverable_feedback"
  | "deliverable_approved"
  | "payment_received"
  | "withdrawal_paid"
  | "new_message"
  | "campaign_match"
  | "kyc_verified"
  | "kyc_rejected"
  | "handle_verified"
  | "system";

// ---------- Tables ----------

export interface Profile {
  id: string;
  email: string;
  phone: string | null;    // +91 XXXXXXXXXX
  full_name: string;
  handle: string;          // @alex_rivera
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  verified_pro: boolean;
  niches: string[];        // ["Beauty", "Tech"] — from INDIAN_NICHES
  city: string | null;     // from INDIAN_CITIES
  languages: string[];     // from INDIAN_LANGUAGES
  total_reach: number;     // cached sum across socials
  avg_engagement: number;  // percentage 0-100
  tier: CreatorTier;       // computed from total_reach
  total_earned_cents: number; // in paise (1 rupee = 100 paise)
  fy_earned_cents: number;    // current Indian FY earnings (Apr 1 – Mar 31) — for TDS threshold
  created_at: string;
  suspended: boolean;

  // KYC & tax (India)
  kyc_status: KycStatus;
  pan_number: string | null;      // ABCDE1234F — 5 letters + 4 digits + 1 letter
  pan_name: string | null;        // name as on PAN
  aadhaar_last4: string | null;   // only last 4 digits stored
  gstin: string | null;           // 15-char GSTIN, optional
  kyc_submitted_at: string | null;
  kyc_verified_at: string | null;
  kyc_rejection_reason: string | null;

  // Payout instruments
  upi_id: string | null;          // user@bankupi
  bank_account_number: string | null;
  bank_ifsc: string | null;       // 11-char IFSC
  bank_account_holder: string | null;

  // Notification preferences
  notif_push: boolean;            // real-time push notifications
  notif_email_digest: boolean;    // weekly email of top campaigns
  notif_marketing: boolean;       // promotional emails
}

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  handle: string;
  followers: number;
  engagement_rate: number;
  connected: boolean;
  connected_at: string | null;
  verified: boolean;                // admin verified handle matches real account
  verification_note: string | null;
}

export interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  verified: boolean;
  website: string | null;
  industry: string;
  description: string | null;
  contact_email: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  title: string;
  cover_image_url: string | null;
  description: string;
  category: string;               // from INDIAN_NICHES
  tags: string[];
  deliverables: CampaignDeliverable[];
  platforms: SocialPlatform[];
  base_earning_cents: number;     // in paise
  commission_pct: number;
  product_bonus: boolean;
  product_bonus_cents: number;    // value of free product, for disclosure

  // Eligibility rules (India)
  required_niches: string[];      // creator's niches must intersect
  min_followers: number;          // platform-agnostic total
  max_followers: number;          // 0 = no cap
  allowed_tiers: CreatorTier[];   // [] = all
  preferred_cities: string[];     // [] = pan-India
  preferred_languages: string[];  // [] = any
  min_engagement_rate: number;    // 0 = no floor
  requires_kyc: boolean;          // true for payouts > ₹20k/yr cumulative

  slots_total: number;
  slots_filled: number;
  apply_deadline: string;
  draft_deadline: string;
  live_date: string;
  status: CampaignStatus;
  featured: boolean;
  high_ticket: boolean;
  dos: string[];
  donts: string[];
  created_at: string;
}

export interface CampaignDeliverable {
  kind: string;              // "Instagram Reel", "TikTok Video", "Link in Bio"
  qty: number;
  spec: string;              // "30-60s vertical video, sound on"
}

export interface Application {
  id: string;
  campaign_id: string;
  creator_id: string;
  pitch: string;
  status: ApplicationStatus;
  applied_at: string;
  decided_at: string | null;
  decided_by: string | null; // admin id
}

export interface Deliverable {
  id: string;
  application_id: string;
  campaign_id: string;
  creator_id: string;
  kind: string;
  asset_url: string | null;
  caption: string | null;
  status: DeliverableStatus;
  feedback: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  live_url: string | null;
  live_at: string | null;
}

export interface MessageThread {
  id: string;
  creator_id: string;
  brand_id: string;
  campaign_id: string | null;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;      // unread for creator
  brand_online: boolean;
  status_label: string | null; // "CAMPAIGN ACTIVE"
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;         // creator_id or "brand:<id>" or "system"
  sender_role: "creator" | "brand" | "system";
  body: string;
  attachment_url: string | null;
  attachment_kind: "image" | "video" | "file" | null;
  attachment_name: string | null;
  attachment_size: string | null;
  read: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  kind: TransactionType;
  status: TransactionStatus;
  amount_cents: number;         // positive credit, negative debit
  description: string;
  reference_id: string | null;  // campaign_id or withdrawal_id
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  gross_cents: number;           // requested gross in paise
  tds_cents: number;             // TDS deducted (10% under Sec 194R if applicable)
  gst_cents: number;             // GST added (18%) if creator has GSTIN
  net_cents: number;             // actually paid out (gross - tds + gst)
  amount_cents: number;          // legacy alias = net_cents (kept for older queries)
  method: PayoutMethod;          // upi | bank
  destination: string;           // upi_id OR masked bank acct ("HDFC ****1234")
  utr: string | null;            // UTR reference for bank transfer
  invoice_number: string | null; // generated invoice for GST-registered creators
  status: WithdrawalStatus;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  admin_note: string | null;
}

export interface CommunityItem {
  id: string;
  kind: EventKind;
  title: string;
  description: string;
  cover_image_url: string | null;
  brand_id: string | null;       // null = CreatorX-hosted
  city: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
  capacity: number | null;
  registered: number;
  price_cents: number;           // 0 = free
  perk_code: string | null;
  url: string | null;
  published: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;           // e.g. /campaigns/abc
  read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  action: string;                // "approve_withdrawal" | "verify_creator" | ...
  entity_kind: string;           // "withdrawal" | "creator" | ...
  entity_id: string;
  details: string | null;        // JSON string
  created_at: string;
}
