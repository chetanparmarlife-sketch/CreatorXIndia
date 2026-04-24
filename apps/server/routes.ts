import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import {
  profiles, socials, brands, campaigns, applications, deliverables,
  messages, transactions, withdrawals, community, notifications, audit, analytics,
  eligibility, resetDb,
} from "./storage";
import { INDIAN_NICHES, INDIAN_CITIES, INDIAN_LANGUAGES, type UserRole } from "@creatorx/schema";
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

const ADMIN_ROLES: ReadonlySet<UserRole> = new Set([
  "admin",
  "admin_ops",
  "admin_support",
  "admin_finance",
  "admin_readonly",
]);

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
  app.use("/api/brand", requireAuth, requireRole("brand"));

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

  return httpServer;
}
