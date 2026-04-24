/**
 * CreatorX — Shared schema
 *
 * This is the single source of truth for data shapes used by both the
 * in-memory mock backend and (eventually) Supabase. The SQL migration in
 * /supabase/migration.sql mirrors these tables exactly.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

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
  actor_user_id?: string;
  action: string;                // "approve_withdrawal" | "verify_creator" | ...
  target_type?: string;
  target_id?: string;
  diff_json?: Record<string, unknown> | null;
  entity_kind: string;           // "withdrawal" | "creator" | ...
  entity_id: string;
  details: string | null;        // JSON string
  created_at: string;
}

export const userRoleEnum = pgEnum("user_role", ["creator", "admin"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "open", "closed", "completed"]);
export const applicationStatusEnum = pgEnum("application_status", ["pending", "accepted", "rejected", "withdrawn"]);
export const deliverableStatusEnum = pgEnum("deliverable_status", ["pending", "submitted", "revision", "approved", "live", "rejected"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["earning", "withdrawal", "bonus", "adjustment"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed"]);
export const withdrawalStatusEnum = pgEnum("withdrawal_status", ["requested", "approved", "paid", "rejected"]);
export const socialPlatformEnum = pgEnum("social_platform", ["instagram", "youtube", "twitter", "linkedin"]);
export const creatorTierEnum = pgEnum("creator_tier", ["nano", "micro", "mid", "macro", "mega"]);
export const kycStatusEnum = pgEnum("kyc_status", ["none", "pending", "verified", "rejected"]);
export const eventKindEnum = pgEnum("event_kind", ["event", "perk", "news"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "application_accepted",
  "application_rejected",
  "deliverable_feedback",
  "deliverable_approved",
  "payment_received",
  "withdrawal_paid",
  "new_message",
  "campaign_match",
  "kyc_verified",
  "kyc_rejected",
  "handle_verified",
  "system",
]);

export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  full_name: text("full_name").notNull(),
  handle: text("handle").notNull().unique(),
  avatar_url: text("avatar_url"),
  bio: text("bio"),
  role: userRoleEnum("role").notNull().default("creator"),
  verified_pro: boolean("verified_pro").notNull().default(false),
  niches: jsonb("niches").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  city: text("city"),
  languages: jsonb("languages").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  total_reach: integer("total_reach").notNull().default(0),
  avg_engagement: doublePrecision("avg_engagement").notNull().default(0),
  tier: creatorTierEnum("tier").notNull().default("nano"),
  total_earned_cents: integer("total_earned_cents").notNull().default(0),
  fy_earned_cents: integer("fy_earned_cents").notNull().default(0),
  created_at: text("created_at").notNull(),
  suspended: boolean("suspended").notNull().default(false),
  kyc_status: kycStatusEnum("kyc_status").notNull().default("none"),
  pan_number: text("pan_number"),
  pan_name: text("pan_name"),
  aadhaar_last4: text("aadhaar_last4"),
  gstin: text("gstin"),
  kyc_submitted_at: text("kyc_submitted_at"),
  kyc_verified_at: text("kyc_verified_at"),
  kyc_rejection_reason: text("kyc_rejection_reason"),
  upi_id: text("upi_id"),
  bank_account_number: text("bank_account_number"),
  bank_ifsc: text("bank_ifsc"),
  bank_account_holder: text("bank_account_holder"),
  notif_push: boolean("notif_push").notNull().default(true),
  notif_email_digest: boolean("notif_email_digest").notNull().default(true),
  notif_marketing: boolean("notif_marketing").notNull().default(false),
});

export const social_accounts = pgTable("social_accounts", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  platform: socialPlatformEnum("platform").notNull(),
  handle: text("handle").notNull(),
  followers: integer("followers").notNull().default(0),
  engagement_rate: doublePrecision("engagement_rate").notNull().default(0),
  connected: boolean("connected").notNull().default(false),
  connected_at: text("connected_at"),
  verified: boolean("verified").notNull().default(false),
  verification_note: text("verification_note"),
});

export const brands = pgTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  logo_url: text("logo_url"),
  verified: boolean("verified").notNull().default(false),
  website: text("website"),
  industry: text("industry").notNull(),
  description: text("description"),
  contact_email: text("contact_email"),
  created_at: text("created_at").notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  brand_id: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  cover_image_url: text("cover_image_url"),
  description: text("description").notNull(),
  category: text("category").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  deliverables: jsonb("deliverables").$type<CampaignDeliverable[]>().notNull().default(sql`'[]'::jsonb`),
  platforms: jsonb("platforms").$type<SocialPlatform[]>().notNull().default(sql`'[]'::jsonb`),
  base_earning_cents: integer("base_earning_cents").notNull().default(0),
  commission_pct: doublePrecision("commission_pct").notNull().default(0),
  product_bonus: boolean("product_bonus").notNull().default(false),
  product_bonus_cents: integer("product_bonus_cents").notNull().default(0),
  required_niches: jsonb("required_niches").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  min_followers: integer("min_followers").notNull().default(0),
  max_followers: integer("max_followers").notNull().default(0),
  allowed_tiers: jsonb("allowed_tiers").$type<CreatorTier[]>().notNull().default(sql`'[]'::jsonb`),
  preferred_cities: jsonb("preferred_cities").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  preferred_languages: jsonb("preferred_languages").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  min_engagement_rate: doublePrecision("min_engagement_rate").notNull().default(0),
  requires_kyc: boolean("requires_kyc").notNull().default(false),
  slots_total: integer("slots_total").notNull().default(0),
  slots_filled: integer("slots_filled").notNull().default(0),
  apply_deadline: text("apply_deadline").notNull(),
  draft_deadline: text("draft_deadline").notNull(),
  live_date: text("live_date").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  high_ticket: boolean("high_ticket").notNull().default(false),
  dos: jsonb("dos").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  donts: jsonb("donts").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  created_at: text("created_at").notNull(),
});

export const applications = pgTable("applications", {
  id: text("id").primaryKey(),
  campaign_id: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  creator_id: text("creator_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  pitch: text("pitch").notNull(),
  status: applicationStatusEnum("status").notNull().default("pending"),
  applied_at: text("applied_at").notNull(),
  decided_at: text("decided_at"),
  decided_by: text("decided_by"),
});

export const deliverables = pgTable("deliverables", {
  id: text("id").primaryKey(),
  application_id: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  campaign_id: text("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  creator_id: text("creator_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  asset_url: text("asset_url"),
  caption: text("caption"),
  status: deliverableStatusEnum("status").notNull().default("pending"),
  feedback: text("feedback"),
  submitted_at: text("submitted_at"),
  decided_at: text("decided_at"),
  live_url: text("live_url"),
  live_at: text("live_at"),
});

export const message_threads = pgTable("message_threads", {
  id: text("id").primaryKey(),
  creator_id: text("creator_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  brand_id: text("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  campaign_id: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  last_message_preview: text("last_message_preview").notNull().default(""),
  last_message_at: text("last_message_at").notNull(),
  unread_count: integer("unread_count").notNull().default(0),
  brand_online: boolean("brand_online").notNull().default(false),
  status_label: text("status_label"),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  thread_id: text("thread_id").notNull().references(() => message_threads.id, { onDelete: "cascade" }),
  sender_id: text("sender_id").notNull(),
  sender_role: text("sender_role").$type<Message["sender_role"]>().notNull(),
  body: text("body").notNull(),
  attachment_url: text("attachment_url"),
  attachment_kind: text("attachment_kind").$type<Message["attachment_kind"]>(),
  attachment_name: text("attachment_name"),
  attachment_size: text("attachment_size"),
  read: boolean("read").notNull().default(false),
  created_at: text("created_at").notNull(),
});

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: transactionTypeEnum("kind").notNull(),
  status: transactionStatusEnum("status").notNull().default("pending"),
  amount_cents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  reference_id: text("reference_id"),
  created_at: text("created_at").notNull(),
});

export const withdrawals = pgTable("withdrawals", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  gross_cents: integer("gross_cents").notNull(),
  tds_cents: integer("tds_cents").notNull().default(0),
  gst_cents: integer("gst_cents").notNull().default(0),
  net_cents: integer("net_cents").notNull(),
  amount_cents: integer("amount_cents").notNull(),
  method: text("method").$type<PayoutMethod>().notNull(),
  destination: text("destination").notNull(),
  utr: text("utr"),
  invoice_number: text("invoice_number"),
  status: withdrawalStatusEnum("status").notNull().default("requested"),
  requested_at: text("requested_at").notNull(),
  decided_at: text("decided_at"),
  paid_at: text("paid_at"),
  admin_note: text("admin_note"),
});

export const community = pgTable("community", {
  id: text("id").primaryKey(),
  kind: eventKindEnum("kind").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cover_image_url: text("cover_image_url"),
  brand_id: text("brand_id").references(() => brands.id, { onDelete: "set null" }),
  city: text("city"),
  starts_at: text("starts_at"),
  ends_at: text("ends_at"),
  location_name: text("location_name"),
  location_address: text("location_address"),
  capacity: integer("capacity"),
  registered: integer("registered").notNull().default(0),
  price_cents: integer("price_cents").notNull().default(0),
  perk_code: text("perk_code"),
  url: text("url"),
  published: boolean("published").notNull().default(true),
  created_at: text("created_at").notNull(),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: notificationKindEnum("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  created_at: text("created_at").notNull(),
});

export const audit_log = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actor_user_id: text("actor_user_id").notNull(),
  action: text("action").notNull(),
  target_type: text("target_type").notNull(),
  target_id: text("target_id").notNull(),
  diff_json: jsonb("diff_json").$type<Record<string, unknown> | null>(),
  admin_id: text("admin_id").notNull(),
  entity_kind: text("entity_kind").notNull(),
  entity_id: text("entity_id").notNull(),
  details: text("details"),
  created_at: text("created_at").notNull(),
});
