CREATE TYPE "public"."application_status" AS ENUM('pending', 'invited', 'accepted', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."brand_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."brand_team_role" AS ENUM('admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'open', 'closed', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."creator_tier" AS ENUM('nano', 'micro', 'mid', 'macro', 'mega');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('pending', 'submitted', 'revision', 'approved', 'live', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."event_kind" AS ENUM('event', 'perk', 'news');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('none', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('application_accepted', 'application_rejected', 'deliverable_feedback', 'deliverable_approved', 'payment_received', 'withdrawal_paid', 'new_message', 'campaign_match', 'kyc_verified', 'kyc_rejected', 'handle_verified', 'system');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'youtube', 'twitter', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('earning', 'withdrawal', 'bonus', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('creator', 'brand', 'admin', 'admin_ops', 'admin_support', 'admin_finance', 'admin_readonly');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('requested', 'approved', 'paid', 'rejected');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"pitch" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"applied_at" text NOT NULL,
	"decided_at" text,
	"decided_by" text
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"acting_as_brand_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"diff_json" jsonb,
	"admin_id" text NOT NULL,
	"entity_kind" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "brand_team_role" DEFAULT 'member' NOT NULL,
	"invited_by" text NOT NULL,
	"invited_at" text NOT NULL,
	"accepted_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"verified" boolean DEFAULT false NOT NULL,
	"status" "brand_status" DEFAULT 'pending' NOT NULL,
	"website" text,
	"industry" text NOT NULL,
	"description" text,
	"contact_email" text,
	"wallet_balance_paise" integer DEFAULT 0 NOT NULL,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"title" text NOT NULL,
	"cover_image_url" text,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deliverables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_earning_cents" integer DEFAULT 0 NOT NULL,
	"commission_pct" double precision DEFAULT 0 NOT NULL,
	"product_bonus" boolean DEFAULT false NOT NULL,
	"product_bonus_cents" integer DEFAULT 0 NOT NULL,
	"required_niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_followers" integer DEFAULT 0 NOT NULL,
	"max_followers" integer DEFAULT 0 NOT NULL,
	"allowed_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_cities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_engagement_rate" double precision DEFAULT 0 NOT NULL,
	"requires_kyc" boolean DEFAULT false NOT NULL,
	"slots_total" integer DEFAULT 0 NOT NULL,
	"slots_filled" integer DEFAULT 0 NOT NULL,
	"apply_deadline" text NOT NULL,
	"draft_deadline" text NOT NULL,
	"live_date" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"high_ticket" boolean DEFAULT false NOT NULL,
	"dos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"donts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "event_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"cover_image_url" text,
	"brand_id" text,
	"city" text,
	"starts_at" text,
	"ends_at" text,
	"location_name" text,
	"location_address" text,
	"capacity" integer,
	"registered" integer DEFAULT 0 NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"perk_code" text,
	"url" text,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"kind" text NOT NULL,
	"asset_url" text,
	"caption" text,
	"status" "deliverable_status" DEFAULT 'pending' NOT NULL,
	"feedback" text,
	"submitted_at" text,
	"decided_at" text,
	"live_url" text,
	"live_at" text
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"pdf_url" text,
	"issued_at" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"campaign_id" text,
	"last_message_preview" text DEFAULT '' NOT NULL,
	"last_message_at" text NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"brand_online" boolean DEFAULT false NOT NULL,
	"status_label" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"attachment_url" text,
	"attachment_kind" text,
	"attachment_name" text,
	"attachment_size" text,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"full_name" text NOT NULL,
	"handle" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"role" "user_role" DEFAULT 'creator' NOT NULL,
	"verified_pro" boolean DEFAULT false NOT NULL,
	"niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city" text,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_reach" integer DEFAULT 0 NOT NULL,
	"avg_engagement" double precision DEFAULT 0 NOT NULL,
	"tier" "creator_tier" DEFAULT 'nano' NOT NULL,
	"total_earned_cents" integer DEFAULT 0 NOT NULL,
	"fy_earned_cents" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"kyc_status" "kyc_status" DEFAULT 'none' NOT NULL,
	"pan_number" text,
	"pan_name" text,
	"aadhaar_last4" text,
	"gstin" text,
	"kyc_submitted_at" text,
	"kyc_verified_at" text,
	"kyc_rejection_reason" text,
	"upi_id" text,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_account_holder" text,
	"notif_push" boolean DEFAULT true NOT NULL,
	"notif_email_digest" boolean DEFAULT true NOT NULL,
	"notif_marketing" boolean DEFAULT false NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" "push_platform" NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"revoked_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" "social_platform" NOT NULL,
	"handle" text NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"engagement_rate" double precision DEFAULT 0 NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"connected_at" text,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_note" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"amount_cents" integer NOT NULL,
	"description" text NOT NULL,
	"reference_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount_paise" integer NOT NULL,
	"description" text NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"status" "wallet_transaction_status" DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"gross_cents" integer NOT NULL,
	"tds_cents" integer DEFAULT 0 NOT NULL,
	"gst_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" text NOT NULL,
	"destination" text NOT NULL,
	"utr" text,
	"invoice_number" text,
	"status" "withdrawal_status" DEFAULT 'requested' NOT NULL,
	"requested_at" text NOT NULL,
	"decided_at" text,
	"paid_at" text,
	"admin_note" text
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_team_members" ADD CONSTRAINT "brand_team_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_team_members" ADD CONSTRAINT "brand_team_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_team_members" ADD CONSTRAINT "brand_team_members_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community" ADD CONSTRAINT "community_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;