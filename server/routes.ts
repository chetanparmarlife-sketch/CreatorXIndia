import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import {
  profiles, socials, brands, campaigns, applications, deliverables,
  messages, transactions, withdrawals, community, notifications, audit, analytics,
  eligibility, resetDb,
} from "./storage";
import { INDIAN_NICHES, INDIAN_CITIES, INDIAN_LANGUAGES } from "../shared/schema";

/**
 * Simple mock auth — the frontend sends an X-User-Id header. In a real Supabase
 * deployment this would be replaced by verifying a JWT. See /supabase/migration.sql
 * for the RLS policies that enforce the same rules server-side.
 */
function getUserId(req: Request): string | null {
  const uid = (req.headers["x-user-id"] as string) || "";
  return uid || null;
}

function requireUser(req: Request, res: Response): string | null {
  const uid = getUserId(req);
  if (!uid) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const p = profiles.byId(uid);
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

function requireAdmin(req: Request, res: Response): string | null {
  const uid = requireUser(req, res);
  if (!uid) return null;
  const p = profiles.byId(uid);
  if (!p || p.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return null;
  }
  return uid;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ------------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------------
  app.post("/api/auth/login", (req, res) => {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email required" });
    const p = profiles.byEmail(email);
    if (!p) return res.status(404).json({ error: "No account for that email. Try signing up." });
    if (p.suspended) return res.status(403).json({ error: "Account suspended" });
    res.json({ profile: p });
  });

  app.post("/api/auth/signup", (req, res) => {
    const { email, full_name, handle } = req.body || {};
    if (!email || !full_name || !handle) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (profiles.byEmail(email)) return res.status(409).json({ error: "Email already registered" });
    const p = profiles.create({
      email,
      full_name,
      handle,
      role: "creator",
      niches: [],
    } as any);
    // Default social rows (disconnected) so onboarding flow has something to toggle
    ["instagram", "youtube", "twitter"].forEach((platform) => {
      socials.connect(p.id, platform as any, "", 0, 0);
      const list = socials.forUser(p.id);
      const latest = list[list.length - 1];
      if (latest) socials.toggle(latest.id, false);
    });
    res.json({ profile: p });
  });

  app.get("/api/auth/me", (req, res) => {
    const uid = getUserId(req);
    if (!uid) return res.json({ profile: null });
    const p = profiles.byId(uid);
    res.json({ profile: p });
  });

  app.get("/api/auth/demo-users", (_req, res) => {
    res.json({
      creators: profiles.list().filter((p) => p.role === "creator").map((p) => ({
        id: p.id, email: p.email, full_name: p.full_name, handle: p.handle, avatar_url: p.avatar_url, verified_pro: p.verified_pro,
      })),
      admins: profiles.list().filter((p) => p.role === "admin").map((p) => ({
        id: p.id, email: p.email, full_name: p.full_name, handle: p.handle,
      })),
    });
  });

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  app.get("/api/profile", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    res.json({ profile: profiles.byId(uid), socials: socials.forUser(uid) });
  });

  app.patch("/api/profile", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
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
    const updated = profiles.update(uid, patch as any);
    res.json({ profile: updated });
  });

  // Dedicated notification-preferences endpoint used by Settings → Notifications.
  app.patch("/api/profile/notifications", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { notif_push, notif_email_digest, notif_marketing } = req.body || {};
    const patch: Record<string, boolean> = {};
    if (typeof notif_push === "boolean") patch.notif_push = notif_push;
    if (typeof notif_email_digest === "boolean") patch.notif_email_digest = notif_email_digest;
    if (typeof notif_marketing === "boolean") patch.notif_marketing = notif_marketing;
    const updated = profiles.update(uid, patch as any);
    res.json({ profile: updated });
  });

  app.delete("/api/profile", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const p = profiles.byId(uid);
    if (!p) return res.status(404).json({ error: "Profile not found" });
    if (p.role === "admin") return res.status(403).json({ error: "Admin accounts cannot be self-deleted" });
    profiles.remove(uid);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Socials
  // ------------------------------------------------------------------
  app.get("/api/socials", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    res.json({ socials: socials.forUser(uid) });
  });

  app.post("/api/socials/connect", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
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
    const row = socials.connect(uid, platform, handle || `@${profiles.byId(uid)?.handle}`, f, e);
    res.json({ social: row });
  });

  app.post("/api/socials/:id/toggle", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { connected } = req.body || {};
    const s = socials.toggle(req.params.id, !!connected);
    if (!s || s.user_id !== uid) return res.status(404).json({ error: "Not found" });
    res.json({ social: s });
  });

  // ------------------------------------------------------------------
  // Campaigns — public discover + apply
  // ------------------------------------------------------------------
  app.get("/api/campaigns", (req, res) => {
    const { category, status, featured } = req.query;
    const list = campaigns.list({
      category: category as string | undefined,
      status: status as any,
      featured: featured === "true" ? true : featured === "false" ? false : undefined,
    });
    // Join brand for easier frontend use
    const out = list.map((c) => ({ ...c, brand: brands.byId(c.brand_id) }));
    res.json({ campaigns: out });
  });

  app.get("/api/campaigns/:id", (req, res) => {
    const c = campaigns.byId(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    const uid = getUserId(req);
    const myApp = uid ? applications.list({ creator_id: uid, campaign_id: c.id })[0] : null;
    const myDeliverables = uid ? deliverables.list({ creator_id: uid, campaign_id: c.id }) : [];
    res.json({
      campaign: { ...c, brand: brands.byId(c.brand_id) },
      myApplication: myApp || null,
      myDeliverables,
    });
  });

  app.post("/api/campaigns/:id/apply", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const c = campaigns.byId(req.params.id);
    if (!c) return res.status(404).json({ error: "Campaign not found" });
    if (c.status !== "open") return res.status(400).json({ error: "Campaign closed" });
    const existing = applications.list({ creator_id: uid, campaign_id: c.id })[0];
    if (existing) return res.status(409).json({ error: "Already applied", application: existing });

    // Enforce eligibility server-side
    const elig = eligibility.check(uid, c.id);
    if (!elig.eligible) {
      return res.status(403).json({ error: "Not eligible", reasons: elig.reasons });
    }

    const { pitch } = req.body || {};
    const a = applications.create(uid, c.id, pitch || "I'd love to be part of this campaign.");
    res.json({ application: a });
  });

  // Eligibility check (used by discover / detail page)
  app.get("/api/campaigns/:id/eligibility", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    res.json(eligibility.check(uid, req.params.id));
  });

  // ------------------------------------------------------------------
  // My campaigns (creator's own applications + deliverables)
  // ------------------------------------------------------------------
  app.get("/api/my/campaigns", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const apps = applications.list({ creator_id: uid });
    const out = apps.map((a) => {
      const c = campaigns.byId(a.campaign_id);
      const ds = deliverables.list({ creator_id: uid, campaign_id: a.campaign_id });
      return {
        application: a,
        campaign: c ? { ...c, brand: brands.byId(c.brand_id) } : null,
        deliverables: ds,
      };
    });
    res.json({ items: out });
  });

  app.get("/api/my/deliverables/:id", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const d = deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    res.json({ deliverable: d });
  });

  app.post("/api/my/deliverables/:id/submit", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const d = deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { asset_url, caption } = req.body || {};
    if (!asset_url || typeof asset_url !== "string" || !/^https?:\/\/.+/.test(asset_url)) {
      return res.status(400).json({ error: "Valid asset URL required (https://…)" });
    }
    if (d.status === "live") return res.status(400).json({ error: "Already live" });
    res.json({ deliverable: deliverables.submit(d.id, asset_url, (caption || "").slice(0, 2200)) });
  });

  app.post("/api/my/deliverables/:id/live", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const d = deliverables.byId(req.params.id);
    if (!d || d.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { live_url } = req.body || {};
    if (!live_url || typeof live_url !== "string" || !/^https?:\/\/.+/.test(live_url)) {
      return res.status(400).json({ error: "Valid public URL required (https://…)" });
    }
    if (d.status !== "approved") return res.status(400).json({ error: "Deliverable must be approved before marking live" });
    res.json({ deliverable: deliverables.markLive(d.id, live_url) });
  });

  // ------------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------------
  app.get("/api/threads", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const ts = messages.threadsForCreator(uid).map((t) => ({
      ...t,
      brand: brands.byId(t.brand_id),
      campaign: t.campaign_id ? campaigns.byId(t.campaign_id) : null,
    }));
    res.json({ threads: ts });
  });

  app.get("/api/threads/:id", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const t = messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const msgs = messages.listMessages(t.id);
    res.json({
      thread: { ...t, brand: brands.byId(t.brand_id), campaign: t.campaign_id ? campaigns.byId(t.campaign_id) : null },
      messages: msgs,
    });
  });

  app.post("/api/threads/:id/read", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const t = messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    messages.markRead(t.id);
    res.json({ ok: true });
  });

  app.post("/api/threads/:id/send", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const t = messages.thread(req.params.id);
    if (!t || t.creator_id !== uid) return res.status(404).json({ error: "Not found" });
    const { body, attachment } = req.body || {};
    const msg = messages.send(t.id, uid, "creator", body || "", attachment);
    // Auto-response from brand for demo realism (50% chance)
    if (msg && Math.random() > 0.5) {
      setTimeout(() => {
        messages.send(
          t.id,
          `brand:${t.brand_id}`,
          "brand",
          ["Got it \u2014 will review shortly.", "Thanks! Looks good on our end.", "Quick note: can you also tweak the caption?"][Math.floor(Math.random() * 3)]
        );
      }, 1200);
    }
    res.json({ message: msg });
  });

  app.post("/api/threads/new", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { brand_id, opener } = req.body || {};
    if (!brand_id) return res.status(400).json({ error: "brand_id required" });
    const t = messages.createThread(uid, brand_id, opener || "Hi! I'd love to work together.");
    res.json({ thread: t });
  });

  // ------------------------------------------------------------------
  // Earnings & withdrawals (INR)
  // ------------------------------------------------------------------
  app.get("/api/earnings", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const me = profiles.byId(uid);
    res.json({
      balance_cents: transactions.balanceCents(uid),
      transactions: transactions.forUser(uid),
      withdrawals: withdrawals.list({ user_id: uid }),
      kyc_status: me?.kyc_status,
      has_upi: !!me?.upi_id,
      has_bank: !!(me?.bank_account_number && me?.bank_ifsc),
      fy_earned_cents: me?.fy_earned_cents || 0,
    });
  });

  // Preview tax breakup before user confirms withdrawal
  app.post("/api/withdrawals/preview", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { amount_cents } = req.body || {};
    if (!amount_cents || amount_cents <= 0) return res.status(400).json({ error: "Invalid amount" });
    const preview = withdrawals.preview(uid, amount_cents);
    if (!preview) return res.status(404).json({ error: "Profile not found" });
    // Flatten for the frontend (it expects gross_cents/tds_cents/etc at top level)
    const fy_before = withdrawals.fyEarnedBeforeForUser(uid);
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

  app.post("/api/withdrawals", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { amount_cents, method } = req.body || {};
    if (!amount_cents || amount_cents <= 0) return res.status(400).json({ error: "Invalid amount" });
    if (!method || !(["upi", "bank"].includes(method))) return res.status(400).json({ error: "Method must be upi or bank" });
    const result = withdrawals.request(uid, amount_cents, method);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ withdrawal: result.withdrawal });
  });

  // ------------------------------------------------------------------
  // KYC & payout instruments (India)
  // ------------------------------------------------------------------
  app.get("/api/kyc", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const p = profiles.byId(uid)!;
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

  app.post("/api/kyc", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const { pan_number, pan_name, aadhaar_last4, gstin } = req.body || {};
    if (!pan_number || !pan_name) return res.status(400).json({ error: "PAN number and name are required" });
    const result = profiles.submitKyc(uid, { pan_number, pan_name, aadhaar_last4, gstin });
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ profile: result.profile });
  });

  app.get("/api/payout-instruments", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const p = profiles.byId(uid)!;
    res.json({
      upi_id: p.upi_id,
      bank_account_number: p.bank_account_number ? `${"\u2022".repeat(Math.max(0, p.bank_account_number.length - 4))}${p.bank_account_number.slice(-4)}` : null,
      bank_account_number_last4: p.bank_account_number?.slice(-4) || null,
      bank_ifsc: p.bank_ifsc,
      bank_account_holder: p.bank_account_holder,
    });
  });

  app.post("/api/payout-instruments", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const result = profiles.setPayoutInstrument(uid, req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ ok: true });
  });

  // Static lookups
  app.get("/api/lookups", (_req, res) => {
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
  app.get("/api/notifications", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    res.json({ notifications: notifications.forUser(uid) });
  });

  app.post("/api/notifications/:id/read", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    notifications.markRead(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/notifications/read-all", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    notifications.markAllRead(uid);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // Community (events + perks + news)
  // ------------------------------------------------------------------
  app.get("/api/community", (req, res) => {
    const { kind, city } = req.query;
    const list = community.list({
      kind: kind as any,
      city: city as string | undefined,
      published: true,
    });
    res.json({ items: list.map((c) => ({ ...c, brand: c.brand_id ? brands.byId(c.brand_id) : null })) });
  });

  app.post("/api/community/:id/rsvp", (req, res) => {
    const uid = requireUser(req, res); if (!uid) return;
    const c = community.register(req.params.id);
    res.json({ item: c });
  });

  // ------------------------------------------------------------------
  // Brands directory (for "New message" picker)
  // ------------------------------------------------------------------
  app.get("/api/brands", (_req, res) => {
    res.json({ brands: brands.list() });
  });

  // ==================================================================
  // ADMIN ROUTES
  // ==================================================================
  app.get("/api/admin/summary", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    res.json(analytics.summary());
  });

  // Creators ---------------------------------------------------------
  app.get("/api/admin/creators", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const q = (req.query.q as string) || "";
    const rows = q ? profiles.search(q) : profiles.list();
    res.json({ creators: rows.filter((p) => p.role === "creator") });
  });

  app.get("/api/admin/creators/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const p = profiles.byId(req.params.id);
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json({
      creator: p,
      socials: socials.forUser(p.id),
      applications: applications.list({ creator_id: p.id }),
      earnings_cents: transactions.forUser(p.id).filter((t) => t.kind === "earning" && t.status === "completed").reduce((a, t) => a + t.amount_cents, 0),
    });
  });

  app.patch("/api/admin/creators/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const updated = profiles.update(req.params.id, req.body);
    audit.log(uid, "update_creator", "creator", req.params.id, req.body);
    res.json({ creator: updated });
  });

  app.post("/api/admin/creators/:id/verify", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { verified } = req.body || {};
    const updated = profiles.update(req.params.id, { verified_pro: !!verified });
    audit.log(uid, verified ? "verify_creator" : "unverify_creator", "creator", req.params.id);
    res.json({ creator: updated });
  });

  app.post("/api/admin/creators/:id/suspend", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { suspended } = req.body || {};
    const updated = profiles.update(req.params.id, { suspended: !!suspended });
    audit.log(uid, suspended ? "suspend_creator" : "unsuspend_creator", "creator", req.params.id);
    res.json({ creator: updated });
  });

  // Brands -----------------------------------------------------------
  app.get("/api/admin/brands", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    res.json({ brands: brands.list() });
  });

  app.post("/api/admin/brands", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const b = brands.create(req.body);
    audit.log(uid, "create_brand", "brand", b.id);
    res.json({ brand: b });
  });

  app.patch("/api/admin/brands/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const b = brands.update(req.params.id, req.body);
    audit.log(uid, "update_brand", "brand", req.params.id);
    res.json({ brand: b });
  });

  app.delete("/api/admin/brands/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    brands.remove(req.params.id);
    audit.log(uid, "delete_brand", "brand", req.params.id);
    res.json({ ok: true });
  });

  // Campaigns --------------------------------------------------------
  app.get("/api/admin/campaigns", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    res.json({ campaigns: campaigns.list().map((c) => ({ ...c, brand: brands.byId(c.brand_id) })) });
  });

  app.post("/api/admin/campaigns", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const c = campaigns.create(req.body);
    audit.log(uid, "create_campaign", "campaign", c.id);
    res.json({ campaign: c });
  });

  app.patch("/api/admin/campaigns/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const c = campaigns.update(req.params.id, req.body);
    audit.log(uid, "update_campaign", "campaign", req.params.id);
    res.json({ campaign: c });
  });

  app.delete("/api/admin/campaigns/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    campaigns.remove(req.params.id);
    audit.log(uid, "delete_campaign", "campaign", req.params.id);
    res.json({ ok: true });
  });

  // Applications -----------------------------------------------------
  app.get("/api/admin/applications", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const list = applications.list({ status: (req.query.status as any) || undefined });
    const enriched = list.map((a) => ({
      ...a,
      creator: profiles.byId(a.creator_id),
      campaign: campaigns.byId(a.campaign_id),
    }));
    res.json({ applications: enriched });
  });

  app.post("/api/admin/applications/:id/decide", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { decision } = req.body || {};
    if (!["accepted", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const a = applications.decide(req.params.id, decision, uid);
    audit.log(uid, decision === "accepted" ? "accept_application" : "reject_application", "application", req.params.id);
    res.json({ application: a });
  });

  // Deliverables -----------------------------------------------------
  app.get("/api/admin/deliverables", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const list = deliverables.list({ status: (req.query.status as any) || "submitted" });
    const enriched = list.map((d) => ({
      ...d,
      creator: profiles.byId(d.creator_id),
      campaign: campaigns.byId(d.campaign_id),
    }));
    res.json({ deliverables: enriched });
  });

  app.post("/api/admin/deliverables/:id/decide", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { decision, feedback } = req.body || {};
    if (!["approved", "revision", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const d = deliverables.decide(req.params.id, decision, feedback || "", uid);
    audit.log(uid, `${decision}_deliverable`, "deliverable", req.params.id, { feedback });
    res.json({ deliverable: d });
  });

  // Payouts ----------------------------------------------------------
  app.get("/api/admin/payouts", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const list = withdrawals.list({ status: (req.query.status as any) || undefined });
    const enriched = list.map((w) => ({ ...w, creator: profiles.byId(w.user_id) }));
    res.json({ payouts: enriched });
  });

  app.post("/api/admin/payouts/:id/decide", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { decision, note, utr } = req.body || {};
    if (!["approved", "paid", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const w = withdrawals.decide(req.params.id, decision, uid, note, utr);
    audit.log(uid, `${decision}_payout`, "withdrawal", req.params.id, { note, utr });
    res.json({ withdrawal: w });
  });

  // KYC review queue (admin)
  app.get("/api/admin/kyc", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const status = (req.query.status as string) || "pending";
    const list = profiles.list().filter((p) => p.role === "creator" && p.kyc_status === status);
    res.json({ creators: list });
  });

  app.post("/api/admin/kyc/:userId/decide", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { decision, reason } = req.body || {};
    if (!["verified", "rejected"].includes(decision)) return res.status(400).json({ error: "bad decision" });
    const p = profiles.decideKyc(req.params.userId, decision, reason || null);
    audit.log(uid, `${decision}_kyc`, "creator", req.params.userId, { reason });
    res.json({ creator: p });
  });

  // Social handle verification (admin)
  app.get("/api/admin/handle-verifications", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    // Pending = connected + not verified
    const list = profiles.list()
      .filter((p) => p.role === "creator")
      .flatMap((p) => socials.forUser(p.id)
        .filter((s) => s.connected && !s.verified)
        .map((s) => ({ ...s, creator: p })));
    res.json({ handles: list });
  });

  app.post("/api/admin/handles/:id/verify", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const { note } = req.body || {};
    const s = profiles.verifyHandle(req.params.id, note || null);
    audit.log(uid, "verify_handle", "social", req.params.id, { note });
    res.json({ social: s });
  });

  // Community --------------------------------------------------------
  app.get("/api/admin/community", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    res.json({ items: community.list() });
  });

  app.post("/api/admin/community", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const c = community.create(req.body);
    audit.log(uid, "create_community", "community", c.id);
    res.json({ item: c });
  });

  app.patch("/api/admin/community/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const c = community.update(req.params.id, req.body);
    audit.log(uid, "update_community", "community", req.params.id);
    res.json({ item: c });
  });

  app.delete("/api/admin/community/:id", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    community.remove(req.params.id);
    audit.log(uid, "delete_community", "community", req.params.id);
    res.json({ ok: true });
  });

  // Audit log --------------------------------------------------------
  app.get("/api/admin/audit", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    const rows = audit.list().map((a) => ({
      ...a,
      admin: profiles.byId(a.admin_id),
    }));
    res.json({ audit: rows });
  });

  // Danger: reset demo data
  app.post("/api/admin/reset", (req, res) => {
    const uid = requireAdmin(req, res); if (!uid) return;
    resetDb();
    res.json({ ok: true });
  });

  return httpServer;
}
