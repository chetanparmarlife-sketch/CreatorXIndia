import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  profiles, socials, brands, campaigns, applications, deliverables,
  messages, transactions, withdrawals, community, notifications, audit, analytics,
  eligibility, resetDb, upsertPushToken, getBrandProfile, updateBrandProfile,
  getBrandDashboardStats, getBrandActivity, createCampaign, getBrandCampaigns,
  getCampaign, getCampaignStats, updateCampaignStatus, getCampaignApplications,
  updateApplicationStatus, getCampaignDeliverables, updateDeliverableStatus,
  createWalletTransaction, updateWalletTransaction, creditWalletBalance,
  createInvoice, getWalletSummary, getBrandInvoices, searchCreators,
  getCreatorProfile, getCreatorStats, getCreatorPortfolio, inviteCreatorToCampaign,
  getBrandThreads, getThreadMessages, createMessage, createOrGetThread,
  getBrandTeam, inviteTeamMember, removeTeamMember, updateNotificationPreferences,
} from "./storage";
import {
  INDIAN_NICHES,
  INDIAN_CITIES,
  INDIAN_LANGUAGES,
  type UserRole,
  type Campaign,
  type Application,
  type Deliverable,
  db,
  invoices as invoicesTable,
  wallet_transactions as walletTransactionsTable,
} from "@creatorx/schema";
import { z } from "zod";
import {
  AuthError,
  generateOtp,
  revokeAllRefreshTokens,
  revokeRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyOtp,
  verifyRefreshToken,
} from "./auth";
import { requireAuth, requireRole } from "./middleware/auth";
import { getPublicUrl, getUploadUrl } from "./lib/r2";
import { createOrder, verifyWebhookSignature } from "./lib/razorpay";
import { calculateGst, generateInvoiceNumber } from "./lib/invoice";

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "admin",
  "admin_ops",
  "admin_support",
  "admin_finance",
  "admin_readonly",
]);

const brandProfileSchema = z.object({
  companyName: z.string().trim().min(1, "companyName is required"),
  industry: z.string().trim().min(1, "industry is required"),
  websiteUrl: z.string().trim().url("websiteUrl must be a valid URL"),
  gstin: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().regex(/^[0-9A-Z]{15}$/i, "gstin must be a valid GSTIN").optional(),
  ),
  logoUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().url("logoUrl must be a valid URL").optional(),
  ),
});

const campaignCreateSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().trim().min(1, "description is required"),
  niche: z.enum(INDIAN_NICHES),
  platforms: z.array(z.enum(["instagram", "youtube", "twitter", "linkedin"])).min(1, "platforms are required"),
  deliverable_type: z.enum(["post", "reel", "story", "video"]),
  budget_paise: z.coerce.number().int("budget_paise must be an integer").min(50_000, "budget_paise must be at least 50000"),
  max_creators: z.coerce.number().int("max_creators must be an integer").min(1, "max_creators must be at least 1"),
  application_deadline: z.string().refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() > Date.now();
  }, "application_deadline must be a future date"),
  brief_url: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().url("brief_url must be a valid URL").optional(),
  ),
});

const brandCampaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
const campaignStatusUpdateSchema = z.object({
  status: z.enum(["paused", "active"]),
});
const brandApplicationFilterSchema = z.enum(["pending", "approved", "rejected"]);
const brandApplicationStatusUpdateSchema = z.object({
  status: z.enum(["approved", "rejected"]),
});
const brandDeliverableFilterSchema = z.enum(["pending", "approved", "rejected"]);
const brandDeliverableStatusUpdateSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    rejection_reason: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().min(1, "rejection_reason is required when rejecting").optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && !value.rejection_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rejection_reason is required when rejecting",
        path: ["rejection_reason"],
      });
    }
  });
const brandInviteSchema = z.object({
  creatorId: z.string().trim().min(1, "creatorId is required"),
});
const walletTopupSchema = z.object({
  amountPaise: z.coerce.number().int("amountPaise must be an integer").min(100_000, "Minimum top-up is ₹1000").max(10_000_000, "UPI limit exceeded"),
});
const walletVerifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1, "razorpay_order_id is required"),
  razorpay_payment_id: z.string().trim().min(1, "razorpay_payment_id is required"),
  razorpay_signature: z.string().trim().min(1, "razorpay_signature is required"),
});
const brandThreadMessageSchema = z.object({
  body: z.string().trim().min(1, "body is required").max(2000, "body must be at most 2000 characters"),
});
const brandThreadCreateSchema = z.object({
  creatorId: z.string().trim().min(1, "creatorId is required"),
  campaignId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  body: z.string().trim().min(1, "body is required").max(2000, "body must be at most 2000 characters"),
});
const brandTeamInviteSchema = z.object({
  email: z.string().trim().email("email must be valid"),
  role: z.enum(["admin", "member", "viewer"]),
});
const brandNotificationPreferencesSchema = z.object({
  preferences: z.record(z.boolean()),
});

function mapBrandFilterStatus(status?: z.infer<typeof brandCampaignStatusSchema>): Campaign["status"] | undefined {
  if (!status) return undefined;
  if (status === "active") return "open";
  if (status === "paused") return "closed";
  return status;
}

function mapApplicationStatusForBrandResponse(status: Application["status"]): "pending" | "approved" | "rejected" {
  if (status === "pending") return "pending";
  if (status === "invited") return "pending";
  if (status === "accepted") return "approved";
  return "rejected";
}

function mapDeliverableStatusForBrandResponse(status: Deliverable["status"]): "pending" | "approved" | "rejected" {
  if (status === "pending" || status === "submitted") return "pending";
  if (status === "approved") return "approved";
  return "rejected";
}

function verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!secret) return false;

  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

function getUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  const uid = (req.headers["x-user-id"] as string) || "";
  return uid || null;
}

async function requireUser(req: Request, res: Response): Promise<string | null> {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const p = await profiles.byId(uid);
  if (!p) {
    res.status(401).json({ error: "Unknown user" });
    return null;
  }
  if (p.suspended) {
    res.status(403).json({ error: "Account suspended" });
    return null;
  }
  return uid;
}

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const uid = await requireUser(req, res);
  if (!uid) return null;

  if (req.user && ADMIN_ROLES.has(req.user.role)) {
    return uid;
  }

  const p = await profiles.byId(uid);
  if (!p || !ADMIN_ROLES.has(p.role)) {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return uid;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.use("/api/admin", requireAuth, requireRole("admin_ops", "admin_support", "admin_finance", "admin_readonly"));
  app.use("/api/creator", requireAuth, requireRole("creator"));
  app.use("/api/brand", (req, res, next) => {
    if (req.path === "/wallet/webhook") {
      next();
      return;
    }
    requireAuth(req, res, () => requireRole("brand")(req, res, next));
  });

  // ------------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------------
  app.post("/api/auth/login", async (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });
    const p = await profiles.byEmail(email);
    if (!p) return res.status(404).json({ error: "No account for that email. Try signing up." });
    if (p.suspended) return res.status(403).json({ error: "Account suspended" });
    res.json({ profile: p });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, full_name, handle } = req.body || {};
    if (!email || !full_name || !handle) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (await profiles.byEmail(email)) return res.status(409).json({ error: "Email already registered" });
    const p = await profiles.create({
      email,
      full_name,
      handle,
      role: "creator",
      niches: [],
    } as any);
    // Default social rows (disconnected) so onboarding flow has something to toggle
    for (const platform of ["instagram", "youtube", "twitter"]) {
      await socials.connect(p.id, platform as any, "", 0, 0);
      const list = await socials.forUser(p.id);
      const latest = list[list.length - 1];
      if (latest) await socials.toggle(latest.id, false);
    }
    res.json({ profile: p });
  });

  app.get("/api/auth/me", async (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.json({ profile: null });
    const p = await profiles.byId(uid);
    res.json({ profile: p });
  });

  app.get("/api/auth/demo-users", async (_req, res) => {
    const allProfiles = await profiles.list();
    res.json({
      creators: allProfiles.filter((p) => p.role === "creator").map((p) => ({
        id: p.id, email: p.email, full_name: p.full_name, handle: p.handle, avatar_url: p.avatar_url, verified_pro: p.verified_pro,
      })),
      admins: allProfiles.filter((p) => p.role === "admin").map((p) => ({
        id: p.id, email: p.email, full_name: p.full_name, handle: p.handle,
      })),
    });
  });

  app.post("/api/auth/request-otp", async (req, res) => {
    const { email } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email required" });
    }

    try {
      const otp = await generateOtp(email);
      console.log(`[auth] OTP for ${email}: ${otp}`);
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/auth/verify-otp", async (req, res) => {
    const { email, otp } = req.body || {};
    if (!email || !otp || typeof email !== "string" || typeof otp !== "string") {
      return res.status(400).json({ error: "Email and OTP required" });
    }

    try {
      const user = await verifyOtp(email, otp);
      const accessToken = signAccessToken(user.id, user.role);
      const refreshToken = await signRefreshToken(user.id);
      return res.json({ accessToken, refreshToken, user });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken || typeof refreshToken !== "string") {
      return res.status(400).json({ error: "refreshToken required" });
    }

    try {
      const userId = await verifyRefreshToken(refreshToken);
      const user = await profiles.byId(userId);
      if (!user) {
        return res.status(401).json({ error: "Invalid refresh token" });
      }
      const accessToken = signAccessToken(user.id, user.role);
      return res.json({ accessToken });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req, res) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { refreshToken } = req.body || {};

    try {
      if (typeof refreshToken === "string" && refreshToken.trim().length > 0) {
        await revokeRefreshToken(refreshToken, user.id);
      } else {
        await revokeAllRefreshTokens(user.id);
      }
      return res.json({ ok: true });
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.status).json({ error: error.message });
      }
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  app.get("/api/profile", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    res.json({ profile: await profiles.byId(uid), socials: await socials.forUser(uid) });
  });

  app.patch("/api/profile", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    // Only allow editable user-facing fields. Prevents clients from changing
    // earnings, KYC status, tier, etc. via PATCH.
    const body = req.body || {};
    const ALLOWED = [
      "full_name", "handle", "bio", "phone", "avatar_url",
      "city", "languages", "niches",
      "notif_push", "notif_email_digest", "notif_marketing",
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const k of ALLOWED) if (k in body) patch[k] = body[k];
    if (typeof patch.handle === "string") {
      // Strip leading @ so we never store double-@.
      patch.handle = (patch.handle as string).replace(/^@+/, "").trim();
    }
    const updated = await profiles.update(uid, patch as any);
    res.json({ profile: updated });
  });

  // Dedicated notification-preferences endpoint used by Settings → Notifications.
  app.patch("/api/profile/notifications", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { notif_push, notif_email_digest, notif_marketing } = req.body || {};
    const patch: Record<string, boolean> = {};
    if (typeof notif_push === "boolean") patch.notif_push = notif_push;
    if (typeof notif_email_digest === "boolean") patch.notif_email_digest = notif_email_digest;
    if (typeof notif_marketing === "boolean") patch.notif_marketing = notif_marketing;
    const updated = await profiles.update(uid, patch as any);
    res.json({ profile: updated });
  });

  app.delete("/api/profile", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const p = await profiles.byId(uid);
    if (!p) return res.status(404).json({ error: "Profile not found" });
    if (p.role === "admin") return res.status(403).json({ error: "Admin accounts cannot be self-deleted" });
    await profiles.remove(uid);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Socials
  // ------------------------------------------------------------------
  app.get("/api/socials", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    res.json({ socials: await socials.forUser(uid) });
  });

  app.post("/api/socials/connect", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { platform, handle, followers, engagement_rate } = req.body || {};
    // Creator declares followers; admin verifies later. Default to sensible ranges if omitted.
    const fallback: Record<string, { f: number; e: number }> = {
      instagram: { f: 25_000, e: 5.0 },
      youtube: { f: 10_000, e: 4.0 },
      twitter: { f: 5_000, e: 2.0 },
      linkedin: { f: 3_000, e: 1.5 },
    };
    const fb = fallback[platform] || { f: 1_000, e: 3.0 };
    const f = typeof followers === "number" && followers >= 0 ? followers : fb.f;
    const e = typeof engagement_rate === "number" && engagement_rate >= 0 ? engagement_rate : fb.e;
    const me = await profiles.byId(uid);
    const row = await socials.connect(uid, platform, handle || `@${me?.handle}`, f, e);
    res.json({ social: row });
  });

  app.post("/api/socials/:id/toggle", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { connected } = req.body || {};
    const s = await socials.toggle(req.params.id, !!connected);
    if (!s || s.user_id !== uid) return res.status(404).json({ error: "Not found" });
    res.json({ social: s });
  });

  // ------------------------------------------------------------------
  // Campaigns — public discover + apply
  // ------------------------------------------------------------------
  app.get("/api/campaigns", async (req, res) => {
    const { category, status, featured } = req.query;
    const list = await campaigns.list({
      category: category as string | undefined,
      status: status as any,
      featured: featured === "true" ? true : featured === "false" ? false : undefined,
    });
    // Join brand for easier frontend use
    const out = await Promise.all(
      list.map(async (c) => ({ ...c, brand: await brands.byId(c.brand_id) })),
    );
    res.json({ campaigns: out });
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    const c = await campaigns.byId(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    const uid = getUserId(req);
    const myApp = uid ? (await applications.list({ creator_id: uid, campaign_id: c.id }))[0] : null;
    const myDeliverables = uid ? await deliverables.list({ creator_id: uid, campaign_id: c.id }) : [];
    res.json({
      campaign: { ...c, brand: await brands.byId(c.brand_id) },
      myApplication: myApp || null,
      myDeliverables,
    });
  });

  app.post("/api/campaigns/:id/apply", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const c = await campaigns.byId(req.params.id);
    if (!c) return res.status(404).json({ error: "Campaign not found" });
    if (c.status !== "open") return res.status(400).json({ error: "Campaign closed" });
    const existing = (await applications.list({ creator_id: uid, campaign_id: c.id }))[0];
    if (existing) return res.status(409).json({ error: "Already applied", application: existing });

    // Enforce eligibility server-side
    const elig = await eligibility.check(uid, c.id);
    if (!elig.eligible) {
      return res.status(403).json({ error: "Not eligible", reasons: elig.reasons });
    }

    const { pitch } = req.body || {};
    const a = await applications.create(uid, c.id, pitch || "I'd love to be part of this campaign.");
    res.json({ application: a });
  });

  // Eligibility check (used by discover / detail page)
  app.get("/api/campaigns/:id/eligibility", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    res.json(await eligibility.check(uid, req.params.id));
  });

  // ------------------------------------------------------------------
  // My campaigns (creator's own applications + deliverables)
  // ------------------------------------------------------------------
  app.get("/api/my/campaigns", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const apps = await applications.list({ creator_id: uid });
    const out = await Promise.all(
      apps.map(async (a) => {
        const c = await campaigns.byId(a.campaign_id);
        const ds = await deliverables.list({ creator_id: uid, campaign_id: a.campaign_id });
        return {
          application: a,
          campaign: c ? { ...c, brand: await brands.byId(c.brand_id) } : null,
          deliverables: ds,
        };
      }),
    );
    res.json({ items: out });
  });

  app.get("/api/my/deliverables/:id", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const d = await deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    res.json({ deliverable: d });
  });

  app.post("/api/my/deliverables/:id/submit", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const d = await deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { asset_url, caption } = req.body || {};
    if (!asset_url || typeof asset_url !== "string" || !/^https?:\/\/.+/.test(asset_url)) {
      return res.status(400).json({ error: "Valid asset URL required (https://…)" });
    }
    if (d.status === "live") return res.status(400).json({ error: "Already live" });
    res.json({ deliverable: await deliverables.submit(d.id, asset_url, (caption || "").slice(0, 2200)) });
  });

  app.post("/api/my/deliverables/:id/live", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const d = await deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { live_url } = req.body || {};
    if (!live_url || typeof live_url !== "string" || !/^https?:\/\/.+/.test(live_url)) {
      return res.status(400).json({ error: "Valid public URL required (https://…)" });
    }
    if (d.status !== "approved") return res.status(400).json({ error: "Deliverable must be approved before marking live" });
    res.json({ deliverable: await deliverables.markLive(d.id, live_url) });
  });

  // ------------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------------
  app.get("/api/threads", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const threads = await messages.threadsForCreator(uid);
    const ts = await Promise.all(
      threads.map(async (t) => ({
        ...t,
        brand: await brands.byId(t.brand_id),
        campaign: t.campaign_id ? await campaigns.byId(t.campaign_id) : null,
      })),
    );
    res.json({ threads: ts });
  });

  app.get("/api/threads/:id", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const t = await messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const msgs = await messages.listMessages(t.id);
    res.json({
      thread: { ...t, brand: await brands.byId(t.brand_id), campaign: t.campaign_id ? await campaigns.byId(t.campaign_id) : null },
      messages: msgs,
    });
  });

  app.post("/api/threads/:id/read", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const t = await messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    await messages.markRead(t.id);
    res.json({ ok: true });
  });

  app.post("/api/threads/:id/send", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const t = await messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { body, attachment } = req.body || {};
    const msg = await messages.send(t.id, uid, "creator", body || "", attachment);
    // Auto-response from brand for demo realism (50% chance)
    if (msg && Math.random() > 0.5) {
      setTimeout(async () => {
        await messages.send(
          t.id,
          `brand:${t.brand_id}`,
          "brand",
          ["Got it \u2014 will review shortly.", "Thanks! Looks good on our end.", "Quick note: can you also tweak the caption?"][Math.floor(Math.random() * 3)]
        );
      }, 1200);
    }
    res.json({ message: msg });
  });

  app.post("/api/threads/new", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { brand_id, opener } = req.body || {};
    if (!brand_id) return res.status(400).json({ error: "brand_id required" });
    const t = await messages.createThread(uid, brand_id, opener || "Hi! I'd love to work together.");
    res.json({ thread: t });
  });

  // ------------------------------------------------------------------
  // Earnings & withdrawals (INR)
  // ------------------------------------------------------------------
  app.get("/api/earnings", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const me = await profiles.byId(uid);
    res.json({
      balance_cents: await transactions.balanceCents(uid),
      transactions: await transactions.forUser(uid),
      withdrawals: await withdrawals.list({ user_id: uid }),
      kyc_status: me?.kyc_status,
      has_upi: !!me?.upi_id,
      has_bank: !!(me?.bank_account_number && me?.bank_ifsc),
      fy_earned_cents: me?.fy_earned_cents || 0,
    });
  });

  // Preview tax breakup before user confirms withdrawal
  app.post("/api/withdrawals/preview", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { amount_cents } = req.body || {};
    if (!amount_cents || amount_cents <= 0) return res.status(400).json({ error: "Invalid amount" });
    const preview = await withdrawals.preview(uid, amount_cents);
    if (!preview) return res.status(404).json({ error: "Profile not found" });
    // Flatten for the frontend (it expects gross_cents/tds_cents/etc at top level)
    const fy_before = await withdrawals.fyEarnedBeforeForUser(uid);
    res.json({
      ...preview.breakup,
      suggested_method: preview.suggested_method,
      method_reason: preview.method_reason,
      kyc_status: preview.kyc_status,
      has_pan: preview.has_pan,
      has_gstin: preview.has_gstin,
      upi_limit_cents: preview.upi_limit_paise,
      fy_earned_cents: fy_before,
      threshold_cents: 2_000_000, // ₹20,000 in paise
      tds_rate: preview.breakup.tds_cents > 0 ? (preview.has_pan ? 0.1 : 0.2) : 0,
    });
  });

  app.post("/api/withdrawals", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { amount_cents, method } = req.body || {};
    if (!amount_cents || amount_cents <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!method || !(["upi", "bank"].includes(method))) return res.status(400).json({ error: "Method must be upi or bank" });
    const result = await withdrawals.request(uid, amount_cents, method);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ withdrawal: result.withdrawal });
  });

  // ------------------------------------------------------------------
  // KYC & payout instruments (India)
  // ------------------------------------------------------------------
  app.get("/api/kyc", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const p = (await profiles.byId(uid))!;
    res.json({
      kyc_status: p.kyc_status,
      pan_number: p.pan_number,
      pan_name: p.pan_name,
      aadhaar_last4: p.aadhaar_last4,
      gstin: p.gstin,
      kyc_submitted_at: p.kyc_submitted_at,
      kyc_verified_at: p.kyc_verified_at,
      kyc_rejection_reason: p.kyc_rejection_reason,
    });
  });

  app.post("/api/kyc", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const { pan_number, pan_name, aadhaar_last4, gstin } = req.body || {};
    if (!pan_number || !pan_name) return res.status(400).json({ error: "PAN number and name are required" });
    const result = await profiles.submitKyc(uid, { pan_number, pan_name, aadhaar_last4, gstin });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ profile: result.profile });
  });

  app.get("/api/payout-instruments", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const p = (await profiles.byId(uid))!;
    res.json({
      upi_id: p.upi_id,
      bank_account_number: p.bank_account_number ? `${"\u2022".repeat(Math.max(0, p.bank_account_number.length - 4))}${p.bank_account_number.slice(-4)}` : null,
      bank_account_number_last4: p.bank_account_number?.slice(-4) || null,
      bank_ifsc: p.bank_ifsc,
      bank_account_holder: p.bank_account_holder,
    });
  });

  app.post("/api/payout-instruments", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const result = await profiles.setPayoutInstrument(uid, req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  // Static lookups
  app.get("/api/lookups", async (_req, res) => {
    res.json({
      niches: INDIAN_NICHES,
      cities: INDIAN_CITIES,
      languages: INDIAN_LANGUAGES,
      tiers: [
        { id: "nano", label: "Nano (1k\u201310k)", range: [1_000, 10_000] },
        { id: "micro", label: "Micro (10k\u2013100k)", range: [10_000, 100_000] },
        { id: "mid", label: "Mid (100k\u2013500k)", range: [100_000, 500_000] },
        { id: "macro", label: "Macro (500k\u20131M)", range: [500_000, 1_000_000] },
        { id: "mega", label: "Mega (1M+)", range: [1_000_000, null] },
      ],
    });
  });

  // ------------------------------------------------------------------
  // Notifications
  // ------------------------------------------------------------------
  app.get("/api/notifications", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    res.json({ notifications: await notifications.forUser(uid) });
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    await notifications.markRead(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    await notifications.markAllRead(uid);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Community (events + perks + news)
  // ------------------------------------------------------------------
  app.get("/api/community", async (req, res) => {
    const { kind, city } = req.query;
    const list = await community.list({
      kind: kind as any,
      city: city as string | undefined,
      published: true,
    });
    const items = await Promise.all(
      list.map(async (c) => ({ ...c, brand: c.brand_id ? await brands.byId(c.brand_id) : null })),
    );
    res.json({ items });
  });

  app.post("/api/community/:id/rsvp", async (req, res) => {
    const uid = await requireUser(req, res); if (!uid) return;
    const c = await community.register(req.params.id);
    res.json({ item: c });
  });

  // ------------------------------------------------------------------
  // Brands directory (for "New message" picker)
  // ------------------------------------------------------------------
  app.get("/api/brands", async (_req, res) => {
    res.json({ brands: await brands.list() });
  });

  // ==================================================================
  // ADMIN ROUTES
  // ==================================================================
  app.get("/api/admin/summary", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    res.json(await analytics.summary());
  });

  // Creators ---------------------------------------------------------
  app.get("/api/admin/creators", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const q = (req.query.q as string) || "";
    const rows = q ? await profiles.search(q) : await profiles.list();
    res.json({ creators: rows.filter((p) => p.role === "creator") });
  });

  app.get("/api/admin/creators/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const p = await profiles.byId(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    const userTransactions = await transactions.forUser(p.id);
    res.json({
      creator: p,
      socials: await socials.forUser(p.id),
      applications: await applications.list({ creator_id: p.id }),
      earnings_cents: userTransactions
        .filter((t) => t.kind === "earning" && t.status === "completed")
        .reduce((a, t) => a + t.amount_cents, 0),
    });
  });

  app.patch("/api/admin/creators/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const updated = await profiles.update(req.params.id, req.body);
    await audit.log(uid, "update_creator", "creator", req.params.id, req.body);
    res.json({ creator: updated });
  });

  app.post("/api/admin/creators/:id/verify", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { verified } = req.body || {};
    const updated = await profiles.update(req.params.id, { verified_pro: !!verified });
    await audit.log(uid, verified ? "verify_creator" : "unverify_creator", "creator", req.params.id);
    res.json({ creator: updated });
  });

  app.post("/api/admin/creators/:id/suspend", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { suspended } = req.body || {};
    const updated = await profiles.update(req.params.id, { suspended: !!suspended });
    await audit.log(uid, suspended ? "suspend_creator" : "unsuspend_creator", "creator", req.params.id);
    res.json({ creator: updated });
  });

  // Brands -----------------------------------------------------------
  app.get("/api/admin/brands", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    res.json({ brands: await brands.list() });
  });

  app.post("/api/admin/brands", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const b = await brands.create(req.body);
    await audit.log(uid, "create_brand", "brand", b.id);
    res.json({ brand: b });
  });

  app.patch("/api/admin/brands/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const b = await brands.update(req.params.id, req.body);
    await audit.log(uid, "update_brand", "brand", req.params.id);
    res.json({ brand: b });
  });

  app.delete("/api/admin/brands/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    await brands.remove(req.params.id);
    await audit.log(uid, "delete_brand", "brand", req.params.id);
    res.json({ ok: true });
  });

  // Campaigns --------------------------------------------------------
  app.get("/api/admin/campaigns", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const allCampaigns = await campaigns.list();
    const enriched = await Promise.all(
      allCampaigns.map(async (c) => ({ ...c, brand: await brands.byId(c.brand_id) })),
    );
    res.json({ campaigns: enriched });
  });

  app.post("/api/admin/campaigns", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const c = await campaigns.create(req.body);
    await audit.log(uid, "create_campaign", "campaign", c.id);
    res.json({ campaign: c });
  });

  app.patch("/api/admin/campaigns/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const c = await campaigns.update(req.params.id, req.body);
    await audit.log(uid, "update_campaign", "campaign", req.params.id);
    res.json({ campaign: c });
  });

  app.delete("/api/admin/campaigns/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    await campaigns.remove(req.params.id);
    await audit.log(uid, "delete_campaign", "campaign", req.params.id);
    res.json({ ok: true });
  });

  // Applications -----------------------------------------------------
  app.get("/api/admin/applications", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const list = await applications.list({ status: (req.query.status as any) || undefined });
    const enriched = await Promise.all(
      list.map(async (a) => ({
        ...a,
        creator: await profiles.byId(a.creator_id),
        campaign: await campaigns.byId(a.campaign_id),
      })),
    );
    res.json({ applications: enriched });
  });

  app.post("/api/admin/applications/:id/decide", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { decision } = req.body || {};
    if (!["accepted", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const a = await applications.decide(req.params.id, decision, uid);
    await audit.log(uid, decision === "accepted" ? "accept_application" : "reject_application", "application", req.params.id);
    res.json({ application: a });
  });

  // Deliverables -----------------------------------------------------
  app.get("/api/admin/deliverables", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const list = await deliverables.list({ status: (req.query.status as any) || "submitted" });
    const enriched = await Promise.all(
      list.map(async (d) => ({
        ...d,
        creator: await profiles.byId(d.creator_id),
        campaign: await campaigns.byId(d.campaign_id),
      })),
    );
    res.json({ deliverables: enriched });
  });

  app.post("/api/admin/deliverables/:id/decide", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { decision, feedback } = req.body || {};
    if (!["approved", "revision", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const d = await deliverables.decide(req.params.id, decision, feedback || "", uid);
    await audit.log(uid, `${decision}_deliverable`, "deliverable", req.params.id, { feedback });
    res.json({ deliverable: d });
  });

  // Payouts ----------------------------------------------------------
  app.get("/api/admin/payouts", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const list = await withdrawals.list({ status: (req.query.status as any) || undefined });
    const enriched = await Promise.all(
      list.map(async (w) => ({ ...w, creator: await profiles.byId(w.user_id) })),
    );
    res.json({ payouts: enriched });
  });

  app.post("/api/admin/payouts/:id/decide", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { decision, note, utr } = req.body || {};
    if (!["approved", "paid", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const w = await withdrawals.decide(req.params.id, decision, uid, note, utr);
    await audit.log(uid, `${decision}_payout`, "withdrawal", req.params.id, { note, utr });
    res.json({ withdrawal: w });
  });

  // KYC review queue (admin)
  app.get("/api/admin/kyc", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const status = (req.query.status as string) || "pending";
    const allProfiles = await profiles.list();
    const list = allProfiles.filter((p) => p.role === "creator" && p.kyc_status === status);
    res.json({ creators: list });
  });

  app.post("/api/admin/kyc/:userId/decide", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { decision, reason } = req.body || {};
    if (!["verified", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const p = await profiles.decideKyc(req.params.userId, decision, reason || null);
    await audit.log(uid, `${decision}_kyc`, "creator", req.params.userId, { reason });
    res.json({ creator: p });
  });

  // Social handle verification (admin)
  app.get("/api/admin/handle-verifications", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    // Pending = connected + not verified
    const allProfiles = await profiles.list();
    const creatorProfiles = allProfiles.filter((p) => p.role === "creator");
    const handleGroups = await Promise.all(
      creatorProfiles.map(async (p) =>
        (await socials.forUser(p.id))
          .filter((s) => s.connected && !s.verified)
          .map((s) => ({ ...s, creator: p })),
      ),
    );
    const list = handleGroups.flat();
    res.json({ handles: list });
  });

  app.post("/api/admin/handles/:id/verify", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const { note } = req.body || {};
    const s = await profiles.verifyHandle(req.params.id, note || null);
    await audit.log(uid, "verify_handle", "social", req.params.id, { note });
    res.json({ social: s });
  });

  // Community --------------------------------------------------------
  app.get("/api/admin/community", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    res.json({ items: await community.list() });
  });

  app.post("/api/admin/community", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const c = await community.create(req.body);
    await audit.log(uid, "create_community", "community", c.id);
    res.json({ item: c });
  });

  app.patch("/api/admin/community/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const c = await community.update(req.params.id, req.body);
    await audit.log(uid, "update_community", "community", req.params.id);
    res.json({ item: c });
  });

  app.delete("/api/admin/community/:id", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    await community.remove(req.params.id);
    await audit.log(uid, "delete_community", "community", req.params.id);
    res.json({ ok: true });
  });

  // Audit log --------------------------------------------------------
  app.get("/api/admin/audit", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    const allAudit = await audit.list();
    const rows = await Promise.all(
      allAudit.map(async (a) => ({
        ...a,
        admin: await profiles.byId(a.admin_id),
      })),
    );
    res.json({ audit: rows });
  });

  // Danger: reset demo data
  app.post("/api/admin/reset", async (req, res) => {
    const uid = await requireAdmin(req, res); if (!uid) return;
    await resetDb();
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Uploads (R2 presign)
  // ------------------------------------------------------------------
  app.post("/api/uploads/presign", requireAuth, async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { key, contentType } = req.body || {};
    if (typeof key !== "string" || typeof contentType !== "string" || !key || !contentType) {
      return res.status(400).json({ error: "key and contentType are required" });
    }

    if (!(key.startsWith("avatars/") || key.startsWith("deliverables/") || key.startsWith("kyc/"))) {
      return res.status(400).json({ error: "Invalid key prefix" });
    }

    try {
      const uploadUrl = await getUploadUrl(key, contentType);
      const publicUrl = getPublicUrl(key);
      return res.json({ uploadUrl, publicUrl });
    } catch {
      return res.status(500).json({ error: "Failed to create upload URL" });
    }
  });

  // ------------------------------------------------------------------
  // Push tokens
  // ------------------------------------------------------------------
  app.post("/api/push-tokens", requireAuth, async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { token, platform } = req.body || {};
    if (typeof token !== "string" || !token) {
      return res.status(400).json({ error: "token is required" });
    }
    if (platform !== "ios" && platform !== "android" && platform !== "web") {
      return res.status(400).json({ error: "platform must be ios, android, or web" });
    }

    await upsertPushToken(user.id, token, platform);
    return res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Brand profile + dashboard
  // ------------------------------------------------------------------
  app.get("/api/brand/profile", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const brand = await getBrandProfile(user.id);
    return res.json({ brand });
  });

  app.patch("/api/brand/profile", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = brandProfileSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const brand = await updateBrandProfile(user.id, parsed.data);
    await audit.log(user.id, "update_brand_profile", "brand", user.id, parsed.data);
    return res.json({ brand });
  });

  app.get("/api/brand/dashboard-stats", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const stats = await getBrandDashboardStats(user.id);
    return res.json(stats);
  });

  app.get("/api/brand/activity", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const activity = await getBrandActivity(user.id);
    return res.json({ activity });
  });

  app.post("/api/brand/campaigns", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = campaignCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const campaign = await createCampaign(user.id, parsed.data);
    await audit.log(user.id, "create_brand_campaign", "campaign", campaign.id, {
      title: campaign.title,
      budget_paise: parsed.data.budget_paise,
      max_creators: parsed.data.max_creators,
      application_deadline: parsed.data.application_deadline,
    });

    return res.json({ campaign });
  });

  app.get("/api/brand/campaigns", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const statusParam = req.query.status;
    if (statusParam !== undefined && typeof statusParam !== "string") {
      return res.status(400).json({ error: "status must be a string" });
    }

    const parsedStatus = statusParam === undefined ? undefined : brandCampaignStatusSchema.safeParse(statusParam);
    if (parsedStatus && !parsedStatus.success) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const campaigns = await getBrandCampaigns(user.id, mapBrandFilterStatus(parsedStatus?.data));
    return res.json({ campaigns });
  });

  app.get("/api/brand/campaigns/:id", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const campaign = await getCampaign(user.id, campaignId);
    if (!campaign) {
      const existing = await campaigns.byId(campaignId);
      if (existing) return res.status(403).json({ error: "Forbidden" });
      return res.status(404).json({ error: "Campaign not found" });
    }

    const allApplications = await applications.list({ campaign_id: campaign.id });
    const sortedApplications = [...allApplications].sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1)).slice(0, 5);

    const applicants = await Promise.all(
      sortedApplications.map(async (application) => {
        const creator = await profiles.byId(application.creator_id);
        return {
          applicationId: application.id,
          status: application.status,
          creator: {
            id: creator?.id ?? application.creator_id,
            avatar_url: creator?.avatar_url ?? null,
            display_name: creator?.full_name || creator?.handle || "Creator",
            follower_count: creator?.total_reach ?? 0,
          },
        };
      }),
    );

    return res.json({ campaign, applicants });
  });

  app.get("/api/brand/campaigns/:id/stats", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const stats = await getCampaignStats(user.id, campaignId);
    if (!stats) {
      const existing = await campaigns.byId(campaignId);
      if (existing) return res.status(403).json({ error: "Forbidden" });
      return res.status(404).json({ error: "Campaign not found" });
    }

    return res.json(stats);
  });

  app.patch("/api/brand/campaigns/:id/status", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const parsed = campaignStatusUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const current = await getCampaign(user.id, campaignId);
    if (!current) {
      const existing = await campaigns.byId(campaignId);
      if (existing) return res.status(403).json({ error: "Forbidden" });
      return res.status(404).json({ error: "Campaign not found" });
    }

    let nextStatus: Campaign["status"] | null = null;
    if (current.status === "open" && parsed.data.status === "paused") {
      nextStatus = "closed";
    } else if (current.status === "closed" && parsed.data.status === "active") {
      nextStatus = "open";
    }

    if (!nextStatus) {
      return res.status(400).json({ error: "Invalid status transition" });
    }

    const campaign = await updateCampaignStatus(user.id, campaignId, nextStatus);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    return res.json({ campaign });
  });

  app.get("/api/brand/campaigns/:id/applications", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const campaign = await campaigns.byId(campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.brand_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    const statusParam = req.query.status;
    if (statusParam !== undefined && typeof statusParam !== "string") {
      return res.status(400).json({ error: "status must be a string" });
    }

    const parsedStatus = statusParam === undefined ? undefined : brandApplicationFilterSchema.safeParse(statusParam);
    if (parsedStatus && !parsedStatus.success) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const applications = await getCampaignApplications(user.id, campaignId, parsedStatus?.data);
    return res.json({ campaign: { id: campaign.id, title: campaign.title }, applications });
  });

  app.patch("/api/brand/applications/:applicationId/status", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const applicationId = typeof req.params.applicationId === "string" ? req.params.applicationId : "";
    if (!applicationId) return res.status(400).json({ error: "Invalid application id" });

    const parsed = brandApplicationStatusUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const current = await applications.byId(applicationId);
    if (!current) return res.status(404).json({ error: "Application not found" });

    const campaign = await campaigns.byId(current.campaign_id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.brand_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    if (current.status !== "pending") {
      return res.status(400).json({ error: "Invalid status transition" });
    }

    const updated = await updateApplicationStatus(user.id, applicationId, parsed.data.status);
    if (!updated) return res.status(404).json({ error: "Application not found" });

    return res.json({
      application: {
        ...updated,
        status: mapApplicationStatusForBrandResponse(updated.status),
      },
    });
  });

  app.get("/api/brand/campaigns/:id/deliverables", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const campaign = await campaigns.byId(campaignId);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.brand_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    const statusParam = req.query.status;
    if (statusParam !== undefined && typeof statusParam !== "string") {
      return res.status(400).json({ error: "status must be a string" });
    }

    const parsedStatus = statusParam === undefined ? undefined : brandDeliverableFilterSchema.safeParse(statusParam);
    if (parsedStatus && !parsedStatus.success) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const deliverables = await getCampaignDeliverables(user.id, campaignId, parsedStatus?.data);
    return res.json({ campaign: { id: campaign.id, title: campaign.title }, deliverables });
  });

  app.patch("/api/brand/deliverables/:deliverableId/status", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const deliverableId = typeof req.params.deliverableId === "string" ? req.params.deliverableId : "";
    if (!deliverableId) return res.status(400).json({ error: "Invalid deliverable id" });

    const parsed = brandDeliverableStatusUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const current = await deliverables.byId(deliverableId);
    if (!current) return res.status(404).json({ error: "Deliverable not found" });

    const campaign = await campaigns.byId(current.campaign_id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    if (campaign.brand_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    const currentStatus = mapDeliverableStatusForBrandResponse(current.status);
    if (currentStatus !== "pending") {
      return res.status(400).json({ error: "Invalid status transition" });
    }

    const updated = await updateDeliverableStatus(
      user.id,
      deliverableId,
      parsed.data.status,
      parsed.data.rejection_reason,
    );
    if (!updated) return res.status(404).json({ error: "Deliverable not found" });

    return res.json({
      deliverable: {
        ...updated,
        status: mapDeliverableStatusForBrandResponse(updated.status),
        rejection_reason: updated.feedback ?? null,
      },
    });
  });

  app.get("/api/brand/marketplace", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const niches = typeof req.query.niches === "string" && req.query.niches.trim().length > 0
      ? req.query.niches.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
    const platforms = typeof req.query.platforms === "string" && req.query.platforms.trim().length > 0
      ? req.query.platforms
          .split(",")
          .map((item) => item.trim())
          .filter((item): item is "instagram" | "youtube" | "twitter" | "linkedin" =>
            item === "instagram" || item === "youtube" || item === "twitter" || item === "linkedin")
      : [];
    const minFollowers = typeof req.query.minFollowers === "string" && req.query.minFollowers.length > 0
      ? Number(req.query.minFollowers)
      : undefined;
    const maxFollowers = typeof req.query.maxFollowers === "string" && req.query.maxFollowers.length > 0
      ? Number(req.query.maxFollowers)
      : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const parsedLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 20;
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 20) : 20;

    const result = await searchCreators({
      search,
      niches,
      platforms,
      minFollowers: Number.isFinite(minFollowers ?? NaN) ? minFollowers : undefined,
      maxFollowers: Number.isFinite(maxFollowers ?? NaN) ? maxFollowers : undefined,
      cursor,
      limit,
    });

    return res.json(result);
  });

  app.get("/api/brand/creators/:creatorId", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const creatorId = typeof req.params.creatorId === "string" ? req.params.creatorId : "";
    if (!creatorId) return res.status(400).json({ error: "Invalid creator id" });

    const profile = await getCreatorProfile(creatorId);
    if (!profile) return res.status(404).json({ error: "Creator not found" });

    const [stats, portfolio] = await Promise.all([
      getCreatorStats(creatorId),
      getCreatorPortfolio(creatorId),
    ]);

    return res.json({ profile, stats, portfolio });
  });

  app.post("/api/brand/campaigns/:campaignId/invite", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const campaignId = typeof req.params.campaignId === "string" ? req.params.campaignId : "";
    if (!campaignId) return res.status(400).json({ error: "Invalid campaign id" });

    const parsed = brandInviteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    try {
      const application = await inviteCreatorToCampaign(user.id, campaignId, parsed.data.creatorId);
      return res.json({ application });
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVITE_FAILED";
      if (code === "FORBIDDEN") return res.status(403).json({ error: "Forbidden" });
      if (code === "DUPLICATE_INVITE") return res.status(409).json({ error: "Creator already applied or invited" });
      if (code === "CAMPAIGN_NOT_FOUND" || code === "CREATOR_NOT_FOUND" || code === "CREATOR_INCOMPLETE") {
        return res.status(404).json({ error: "Creator or campaign not found" });
      }
      return res.status(400).json({ error: "Could not send invite" });
    }
  });

  async function finalizeWalletTopup(
    brandId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
  ): Promise<{ newBalancePaise: number; invoiceNumber: string }> {
    const matchingTransactions = await db
      .select()
      .from(walletTransactionsTable)
      .where(eq(walletTransactionsTable.razorpay_order_id, razorpayOrderId));
    const walletTransaction = matchingTransactions.find((row) => row.brand_id === brandId) ?? null;

    if (!walletTransaction) {
      throw new Error("Wallet transaction not found");
    }

    if (walletTransaction.status === "completed") {
      const summary = await getWalletSummary(brandId);
      const existingInvoices = await getBrandInvoices(brandId);
      return {
        newBalancePaise: summary.balancePaise,
        invoiceNumber: existingInvoices[0]?.invoice_number ?? "",
      };
    }

    await updateWalletTransaction(walletTransaction.id, {
      status: "completed",
      razorpay_payment_id: razorpayPaymentId,
    });

    const creditedBrand = await creditWalletBalance(brandId, walletTransaction.amount_paise);
    if (!creditedBrand) {
      throw new Error("Brand not found");
    }

    const profile = await profiles.byId(brandId);
    const hasGstin = Boolean(profile?.gstin);
    const gstPaise = calculateGst(walletTransaction.amount_paise, hasGstin);
    const totalPaise = walletTransaction.amount_paise + gstPaise;

    const fyPrefix = generateInvoiceNumber(0).split("/").slice(0, 2).join("/");
    const allInvoices = await db.select({ invoice_number: invoicesTable.invoice_number }).from(invoicesTable);
    const fyCount = allInvoices.filter((invoice) => invoice.invoice_number.startsWith(`${fyPrefix}/`)).length;
    const invoiceNumber = generateInvoiceNumber(fyCount);

    await createInvoice({
      brand_id: brandId,
      invoice_number: invoiceNumber,
      amount_paise: walletTransaction.amount_paise,
      gst_paise: gstPaise,
      total_paise: totalPaise,
      issued_at: new Date().toISOString(),
      pdf_url: null,
    });

    await audit.log(brandId, "wallet_topup_completed", "wallet_transaction", walletTransaction.id, {
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      amount_paise: walletTransaction.amount_paise,
      gst_paise: gstPaise,
      invoice_number: invoiceNumber,
    });

    return {
      newBalancePaise: creditedBrand.wallet_balance_paise,
      invoiceNumber,
    };
  }

  app.post("/api/brand/wallet/topup", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = walletTopupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    try {
      const order = await createOrder(parsed.data.amountPaise, `wallet-${user.id}-${Date.now()}`);
      await createWalletTransaction({
        brand_id: user.id,
        type: "credit",
        amount_paise: parsed.data.amountPaise,
        description: "Brand wallet top-up",
        razorpay_order_id: order.id,
        status: "pending",
      });

      return res.json({
        orderId: order.id,
        amount: order.amount,
        currency: "INR",
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create top-up order";
      const status = message === "UPI limit exceeded" ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  app.post("/api/brand/wallet/verify", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = walletVerifySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const validSignature = verifyRazorpayPaymentSignature(
      parsed.data.razorpay_order_id,
      parsed.data.razorpay_payment_id,
      parsed.data.razorpay_signature,
    );
    if (!validSignature) {
      return res.status(400).json({ error: "Invalid Razorpay signature" });
    }

    try {
      const result = await finalizeWalletTopup(
        user.id,
        parsed.data.razorpay_order_id,
        parsed.data.razorpay_payment_id,
      );
      return res.json({
        success: true,
        newBalancePaise: result.newBalancePaise,
        invoiceNumber: result.invoiceNumber,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet verification failed";
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/brand/wallet/webhook", async (req, res) => {
    const signatureHeader = req.headers["x-razorpay-signature"];
    const signature = typeof signatureHeader === "string" ? signatureHeader : "";
    const bodyString = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});

    if (!verifyWebhookSignature(bodyString, signature)) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const payload = (req.body ?? {}) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
          };
        };
      };
    };

    if (payload.event === "payment.captured") {
      const orderId = payload.payload?.payment?.entity?.order_id;
      const paymentId = payload.payload?.payment?.entity?.id;

      if (typeof orderId === "string" && typeof paymentId === "string") {
        void (async () => {
          try {
            const rows = await db
              .select()
              .from(walletTransactionsTable)
              .where(eq(walletTransactionsTable.razorpay_order_id, orderId));
            const transaction = rows[0];
            if (!transaction) return;
            await finalizeWalletTopup(transaction.brand_id, orderId, paymentId);
          } catch (error) {
            console.error("[wallet-webhook] Failed to process payment", error);
          }
        })();
      }
    }

    return res.status(200).json({ ok: true });
  });

  app.get("/api/brand/wallet", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const wallet = await getWalletSummary(user.id);
    return res.json(wallet);
  });

  app.get("/api/brand/invoices", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const invoices = await getBrandInvoices(user.id);
    return res.json({ invoices });
  });

  app.get("/api/brand/threads", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const threads = await getBrandThreads(user.id);
    return res.json({ threads });
  });

  app.get("/api/brand/threads/:threadId/messages", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const threadId = typeof req.params.threadId === "string" ? req.params.threadId : "";
    if (!threadId) return res.status(400).json({ error: "Invalid thread id" });

    try {
      const data = await getThreadMessages(user.id, threadId);
      if (!data) return res.status(404).json({ error: "Thread not found" });
      return res.json(data);
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.status(400).json({ error: "Could not fetch thread messages" });
    }
  });

  app.post("/api/brand/threads/:threadId/messages", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const threadId = typeof req.params.threadId === "string" ? req.params.threadId : "";
    if (!threadId) return res.status(400).json({ error: "Invalid thread id" });

    const parsed = brandThreadMessageSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    try {
      const message = await createMessage(user.id, threadId, parsed.data.body);
      if (!message) return res.status(404).json({ error: "Thread not found" });
      return res.json({ message });
    } catch (error) {
      if (error instanceof Error && error.message === "FORBIDDEN") {
        return res.status(403).json({ error: "Forbidden" });
      }
      return res.status(400).json({ error: "Could not send message" });
    }
  });

  app.post("/api/brand/threads", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = brandThreadCreateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    try {
      const created = await createOrGetThread(
        user.id,
        parsed.data.creatorId,
        parsed.data.campaignId ?? null,
        parsed.data.body,
      );
      return res.json(created);
    } catch (error) {
      const code = error instanceof Error ? error.message : "THREAD_CREATE_FAILED";
      if (code === "FORBIDDEN") return res.status(403).json({ error: "Forbidden" });
      if (code === "CREATOR_NOT_FOUND" || code === "CAMPAIGN_NOT_FOUND") {
        return res.status(404).json({ error: "Creator or campaign not found" });
      }
      return res.status(400).json({ error: "Could not create thread" });
    }
  });

  app.get("/api/brand/team", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const members = await getBrandTeam(user.id);
    return res.json({ members });
  });

  app.post("/api/brand/team/invite", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = brandTeamInviteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const member = await inviteTeamMember(user.id, user.id, parsed.data.email, parsed.data.role);
    return res.json({ member });
  });

  app.delete("/api/brand/team/:userId", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const targetUserId = typeof req.params.userId === "string" ? req.params.userId : "";
    if (!targetUserId) return res.status(400).json({ error: "Invalid user id" });
    if (targetUserId === user.id) {
      return res.status(400).json({ error: "Cannot remove self from team" });
    }

    await removeTeamMember(user.id, user.id, targetUserId);
    return res.json({ ok: true });
  });

  app.patch("/api/brand/notification-preferences", requireAuth, requireRole("brand"), async (req, res) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const parsed = brandNotificationPreferencesSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid payload" });
    }

    const preferences = await updateNotificationPreferences(user.id, parsed.data.preferences);
    return res.json({ preferences });
  });

  return httpServer;
}
