CREATE TYPE "public"."creator_kyc_status" AS ENUM('not_submitted', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payout_request_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "creator_kyc" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"pan_url" text NOT NULL,
	"aadhaar_url" text NOT NULL,
	"status" "creator_kyc_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"status" "payout_request_status" DEFAULT 'pending' NOT NULL,
	"upi_id" text,
	"bank_account" text,
	"razorpay_payout_id" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "data" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "pending_email" text;--> statement-breakpoint
ALTER TABLE "creator_kyc" ADD CONSTRAINT "creator_kyc_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creator_id_profiles_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;