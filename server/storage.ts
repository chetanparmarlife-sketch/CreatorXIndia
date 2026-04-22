/**
 * CreatorX — In-memory storage with persistent JSON snapshots.
 *
 * Data lives in /tmp/creatorx-db.json so it survives dev-server restarts but
 * is fine for demo purposes. When wiring up Supabase, replace the body of each
 * method with a Supabase query — the interface stays the same.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type {
  Profile, SocialAccount, Brand, Campaign, Application, Deliverable,
  MessageThread, Message, Transaction, Withdrawal, CommunityItem,
  Notification, AuditLog,
} from "../shared/schema";
import { seed } from "./seed";
import {
  computeTier, computeWithdrawalTax, nextInvoiceNumber,
  isValidPAN, isValidGSTIN, isValidIFSC, isValidUPI, isValidAadhaarLast4,
  checkCampaignEligibility, suggestedPayoutMethod,
  UPI_LIMIT_PAISE,
} from "../shared/india";

const DB_PATH = process.env.CREATORX_DB_PATH || "/tmp/creatorx-db.json";

interface DB {
  profiles: Profile[];
  social_accounts: SocialAccount[];
  brands: Brand[];
  campaigns: Campaign[];
  applications: Application[];
  deliverables: Deliverable[];
  message_threads: MessageThread[];
  messages: Message[];
  transactions: Transaction[];
  withdrawals: Withdrawal[];
  community: CommunityItem[];
  notifications: Notification[];
  audit_log: AuditLog[];
}

function migrate(parsed: any): DB {
  // Backfill newly added fields on existing profiles so snapshots don't crash.
  for (const p of parsed.profiles || []) {
    if (p.notif_push === undefined) p.notif_push = true;
    if (p.notif_email_digest === undefined) p.notif_email_digest = true;
    if (p.notif_marketing === undefined) p.notif_marketing = false;
  }
  return parsed as DB;
}

function load(): DB {
  if (existsSync(DB_PATH)) {
    try {
      const raw = readFileSync(DB_PATH, "utf8");
      const parsed = JSON.parse(raw);
      // Only use the snapshot if it includes the right shape.
      if (parsed && Array.isArray(parsed.profiles)) return migrate(parsed);
    } catch {}
  }
  const fresh = seed();
  writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
  return fresh;
}

let db: DB = load();

function persist() {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function resetDb() {
  db = seed();
  persist();
}

// ---------- Generic helpers ----------
const newId = () => nanoid(12);
const now = () => new Date().toISOString();

// ================================================================
// Profiles & auth (simple email-based mock)
// ================================================================

export const profiles = {
  list: () => db.profiles,
  byId: (id: string) => db.profiles.find((p) => p.id === id) || null,
  byEmail: (email: string) =>
    db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null,
  search: (q: string) => {
    const s = q.toLowerCase();
    return db.profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(s) ||
        p.handle.toLowerCase().includes(s) ||
        p.email.toLowerCase().includes(s)
    );
  },
  create: (data: Partial<Profile> & { email: string; full_name: string; handle: string }) => {
    const p: Profile = {
      id: newId(),
      email: data.email,
      phone: data.phone ?? null,
      full_name: data.full_name,
      handle: data.handle,
      avatar_url: data.avatar_url ?? null,
      bio: data.bio ?? null,
      role: data.role ?? "creator",
      verified_pro: false,
      niches: data.niches ?? [],
      city: data.city ?? null,
      languages: data.languages ?? [],
      total_reach: 0,
      avg_engagement: 0,
      tier: "nano",
      total_earned_cents: 0,
      fy_earned_cents: 0,
      created_at: now(),
      suspended: false,
      kyc_status: "none",
      pan_number: null,
      pan_name: null,
      aadhaar_last4: null,
      gstin: null,
      kyc_submitted_at: null,
      kyc_verified_at: null,
      kyc_rejection_reason: null,
      upi_id: null,
      bank_account_number: null,
      bank_ifsc: null,
      bank_account_holder: null,
      notif_push: true,
      notif_email_digest: true,
      notif_marketing: false,
    };
    db.profiles.push(p);
    persist();
    return p;
  },
  update: (id: string, patch: Partial<Profile>) => {
    const idx = db.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    db.profiles[idx] = { ...db.profiles[idx], ...patch };
    persist();
    return db.profiles[idx];
  },
  remove: (id: string) => {
    const idx = db.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    db.profiles.splice(idx, 1);
    // cascade: remove user's data
    db.social_accounts = db.social_accounts.filter((s) => s.user_id !== id);
    db.applications = db.applications.filter((a) => a.creator_id !== id);
    db.deliverables = db.deliverables.filter((d) => d.creator_id !== id);
    db.transactions = db.transactions.filter((t) => t.user_id !== id);
    db.withdrawals = db.withdrawals.filter((w) => w.user_id !== id);
    db.notifications = db.notifications.filter((n) => n.user_id !== id);
    db.message_threads = db.message_threads.filter((t) => t.creator_id !== id);
    db.messages = db.messages.filter((m) => m.sender_id !== id);
    persist();
    return true;
  },
  recomputeStats: (userId: string) => {
    const socials = db.social_accounts.filter((s) => s.user_id === userId && s.connected);
    const total_reach = socials.reduce((a, s) => a + s.followers, 0);
    const avg_engagement =
      socials.length > 0
        ? Math.round(socials.reduce((a, s) => a + s.engagement_rate, 0) / socials.length * 10) / 10
        : 0;
    const total_earned_cents = db.transactions
      .filter((t) => t.user_id === userId && t.kind === "earning" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    // Indian FY: Apr 1 – Mar 31
    const now = new Date();
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)
      : new Date(now.getFullYear() - 1, 3, 1);
    const fy_earned_cents = db.transactions
      .filter((t) => t.user_id === userId && t.kind === "earning" && t.status === "completed"
        && new Date(t.created_at) >= fyStart)
      .reduce((a, t) => a + t.amount_cents, 0);
    const tier = computeTier(total_reach);
    return profiles.update(userId, { total_reach, avg_engagement, total_earned_cents, fy_earned_cents, tier });
  },

  // ---------- KYC (India) ----------
  submitKyc: (userId: string, data: { pan_number: string; pan_name: string; aadhaar_last4?: string | null; gstin?: string | null }) => {
    const p = db.profiles.find((x) => x.id === userId);
    if (!p) return { ok: false, error: "Profile not found" };
    const pan = data.pan_number.trim().toUpperCase();
    if (!isValidPAN(pan)) return { ok: false, error: "Invalid PAN format (expected ABCDE1234F)" };
    if (!data.pan_name?.trim()) return { ok: false, error: "Name as on PAN is required" };
    if (data.aadhaar_last4 && !isValidAadhaarLast4(data.aadhaar_last4)) return { ok: false, error: "Aadhaar last-4 must be 4 digits" };
    if (data.gstin && !isValidGSTIN(data.gstin)) return { ok: false, error: "Invalid GSTIN format" };
    p.pan_number = pan;
    p.pan_name = data.pan_name.trim().toUpperCase();
    p.aadhaar_last4 = data.aadhaar_last4 || null;
    p.gstin = data.gstin ? data.gstin.toUpperCase() : null;
    p.kyc_status = "pending";
    p.kyc_submitted_at = now();
    p.kyc_rejection_reason = null;
    persist();
    notifications.push(userId, {
      kind: "system",
      title: "KYC submitted",
      body: "We're reviewing your PAN. Usually verified within 24 hours.",
      link: "/settings",
    });
    return { ok: true, profile: p };
  },

  decideKyc: (userId: string, decision: "verified" | "rejected", reason: string | null) => {
    const p = db.profiles.find((x) => x.id === userId);
    if (!p) return null;
    p.kyc_status = decision;
    if (decision === "verified") {
      p.kyc_verified_at = now();
      p.kyc_rejection_reason = null;
      notifications.push(userId, {
        kind: "kyc_verified",
        title: "KYC verified ✓",
        body: "You can now apply to KYC-required campaigns and withdraw funds.",
        link: "/settings",
      });
    } else {
      p.kyc_rejection_reason = reason || "Please re-submit with correct details";
      notifications.push(userId, {
        kind: "kyc_rejected",
        title: "KYC needs attention",
        body: p.kyc_rejection_reason,
        link: "/settings",
      });
    }
    persist();
    return p;
  },

  // ---------- Payout instruments ----------
  setPayoutInstrument: (userId: string, data: { upi_id?: string | null; bank_account_number?: string | null; bank_ifsc?: string | null; bank_account_holder?: string | null }) => {
    const p = db.profiles.find((x) => x.id === userId);
    if (!p) return { ok: false, error: "Profile not found" };
    if (data.upi_id !== undefined) {
      if (data.upi_id && !isValidUPI(data.upi_id)) return { ok: false, error: "Invalid UPI ID (expected user@bank)" };
      p.upi_id = data.upi_id || null;
    }
    if (data.bank_ifsc !== undefined) {
      if (data.bank_ifsc && !isValidIFSC(data.bank_ifsc)) return { ok: false, error: "Invalid IFSC (expected 4 letters + 0 + 6 alphanumeric)" };
      p.bank_ifsc = data.bank_ifsc ? data.bank_ifsc.toUpperCase() : null;
    }
    if (data.bank_account_number !== undefined) {
      if (data.bank_account_number && !/^[0-9]{9,18}$/.test(data.bank_account_number)) {
        return { ok: false, error: "Bank account number must be 9–18 digits" };
      }
      p.bank_account_number = data.bank_account_number || null;
    }
    if (data.bank_account_holder !== undefined) p.bank_account_holder = data.bank_account_holder || null;
    persist();
    return { ok: true, profile: p };
  },

  // ---------- Social handle admin-verify ----------
  verifyHandle: (socialId: string, note: string | null) => {
    const s = db.social_accounts.find((x) => x.id === socialId);
    if (!s) return null;
    s.verified = true;
    s.verification_note = note;
    persist();
    notifications.push(s.user_id, {
      kind: "handle_verified",
      title: `${s.platform} handle verified`,
      body: `${s.handle} is now verified.`,
      link: "/settings",
    });
    return s;
  },
};

// ================================================================
// Social accounts
// ================================================================

export const socials = {
  forUser: (userId: string) =>
    db.social_accounts.filter((s) => s.user_id === userId),
  connect: (userId: string, platform: SocialAccount["platform"], handle: string, followers: number, engagement_rate: number) => {
    const existing = db.social_accounts.find((s) => s.user_id === userId && s.platform === platform);
    if (existing) {
      existing.connected = true;
      existing.handle = handle;
      existing.followers = followers;
      existing.engagement_rate = engagement_rate;
      existing.connected_at = now();
      existing.verified = false; // re-verify on change
      existing.verification_note = null;
      persist();
      profiles.recomputeStats(userId);
      return existing;
    }
    const s: SocialAccount = {
      id: newId(),
      user_id: userId,
      platform,
      handle,
      followers,
      engagement_rate,
      connected: true,
      connected_at: now(),
      verified: false,
      verification_note: null,
    };
    db.social_accounts.push(s);
    persist();
    profiles.recomputeStats(userId);
    return s;
  },
  toggle: (id: string, connected: boolean) => {
    const s = db.social_accounts.find((x) => x.id === id);
    if (!s) return null;
    s.connected = connected;
    if (connected) s.connected_at = now();
    persist();
    profiles.recomputeStats(s.user_id);
    return s;
  },
  disconnect: (id: string) => socials.toggle(id, false),
};

// ================================================================
// Brands
// ================================================================

export const brands = {
  list: () => db.brands,
  byId: (id: string) => db.brands.find((b) => b.id === id) || null,
  create: (data: Omit<Brand, "id" | "created_at">) => {
    const b: Brand = { ...data, id: newId(), created_at: now() };
    db.brands.push(b);
    persist();
    return b;
  },
  update: (id: string, patch: Partial<Brand>) => {
    const idx = db.brands.findIndex((b) => b.id === id);
    if (idx < 0) return null;
    db.brands[idx] = { ...db.brands[idx], ...patch };
    persist();
    return db.brands[idx];
  },
  remove: (id: string) => {
    db.brands = db.brands.filter((b) => b.id !== id);
    persist();
  },
};

// ================================================================
// Campaigns
// ================================================================

export const campaigns = {
  list: (filters?: { category?: string; status?: Campaign["status"]; featured?: boolean }) => {
    let r = db.campaigns;
    if (filters?.category && filters.category !== "All")
      r = r.filter((c) => c.category === filters.category);
    if (filters?.status) r = r.filter((c) => c.status === filters.status);
    if (filters?.featured !== undefined)
      r = r.filter((c) => c.featured === filters.featured);
    return r;
  },
  byId: (id: string) => db.campaigns.find((c) => c.id === id) || null,
  create: (data: Omit<Campaign, "id" | "created_at" | "slots_filled">) => {
    const c: Campaign = { ...data, id: newId(), slots_filled: 0, created_at: now() };
    db.campaigns.push(c);
    persist();
    return c;
  },
  update: (id: string, patch: Partial<Campaign>) => {
    const idx = db.campaigns.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    db.campaigns[idx] = { ...db.campaigns[idx], ...patch };
    persist();
    return db.campaigns[idx];
  },
  remove: (id: string) => {
    db.campaigns = db.campaigns.filter((c) => c.id !== id);
    persist();
  },
};

// ================================================================
// Applications
// ================================================================

export const applications = {
  list: (filter?: { creator_id?: string; campaign_id?: string; status?: Application["status"] }) => {
    let r = db.applications;
    if (filter?.creator_id) r = r.filter((a) => a.creator_id === filter.creator_id);
    if (filter?.campaign_id) r = r.filter((a) => a.campaign_id === filter.campaign_id);
    if (filter?.status) r = r.filter((a) => a.status === filter.status);
    return r;
  },
  byId: (id: string) => db.applications.find((a) => a.id === id) || null,
  create: (creator_id: string, campaign_id: string, pitch: string) => {
    const a: Application = {
      id: newId(),
      creator_id,
      campaign_id,
      pitch,
      status: "pending",
      applied_at: now(),
      decided_at: null,
      decided_by: null,
    };
    db.applications.push(a);
    persist();
    return a;
  },
  decide: (id: string, decision: "accepted" | "rejected", admin_id: string) => {
    const a = db.applications.find((x) => x.id === id);
    if (!a) return null;
    a.status = decision;
    a.decided_at = now();
    a.decided_by = admin_id;

    if (decision === "accepted") {
      const c = db.campaigns.find((x) => x.id === a.campaign_id);
      if (c) {
        c.slots_filled = Math.min(c.slots_filled + 1, c.slots_total);
        // Generate deliverables
        c.deliverables.forEach((d) => {
          for (let i = 0; i < d.qty; i++) {
            db.deliverables.push({
              id: newId(),
              application_id: a.id,
              campaign_id: c.id,
              creator_id: a.creator_id,
              kind: d.kind,
              asset_url: null,
              caption: null,
              status: "pending",
              feedback: null,
              submitted_at: null,
              decided_at: null,
              live_url: null,
              live_at: null,
            });
          }
        });
        // Open a thread
        const brand = db.brands.find((b) => b.id === c.brand_id);
        if (brand) {
          const existingThread = db.message_threads.find(
            (t) => t.creator_id === a.creator_id && t.brand_id === brand.id && t.campaign_id === c.id
          );
          if (!existingThread) {
            db.message_threads.push({
              id: newId(),
              creator_id: a.creator_id,
              brand_id: brand.id,
              campaign_id: c.id,
              last_message_preview: `Welcome to ${c.title}! Excited to collaborate.`,
              last_message_at: now(),
              unread_count: 1,
              brand_online: true,
              status_label: "CAMPAIGN ACTIVE",
            });
            const thread = db.message_threads[db.message_threads.length - 1];
            db.messages.push({
              id: newId(),
              thread_id: thread.id,
              sender_id: `brand:${brand.id}`,
              sender_role: "brand",
              body: `Welcome to ${c.title}! Excited to collaborate.`,
              attachment_url: null,
              attachment_kind: null,
              attachment_name: null,
              attachment_size: null,
              read: false,
              created_at: now(),
            });
          }
        }
      }
      const camp = db.campaigns.find((x) => x.id === a.campaign_id);
      notifications.push(a.creator_id, {
        kind: "application_accepted",
        title: "Application accepted",
        body: `You're in for ${camp?.title || "the campaign"}.`,
        link: `/campaigns/${a.campaign_id}`,
      });
    } else {
      notifications.push(a.creator_id, {
        kind: "application_rejected",
        title: "Application update",
        body: "Unfortunately, your application wasn't selected this time.",
        link: `/campaigns/${a.campaign_id}`,
      });
    }

    persist();
    return a;
  },
};

// ================================================================
// Deliverables
// ================================================================

export const deliverables = {
  list: (filter?: { creator_id?: string; campaign_id?: string; status?: Deliverable["status"] }) => {
    let r = db.deliverables;
    if (filter?.creator_id) r = r.filter((d) => d.creator_id === filter.creator_id);
    if (filter?.campaign_id) r = r.filter((d) => d.campaign_id === filter.campaign_id);
    if (filter?.status) r = r.filter((d) => d.status === filter.status);
    return r;
  },
  byId: (id: string) => db.deliverables.find((d) => d.id === id) || null,
  submit: (id: string, asset_url: string, caption: string) => {
    const d = db.deliverables.find((x) => x.id === id);
    if (!d) return null;
    d.status = "submitted";
    d.asset_url = asset_url;
    d.caption = caption;
    d.submitted_at = now();
    persist();
    return d;
  },
  decide: (id: string, status: "approved" | "revision" | "rejected", feedback: string, admin_id: string) => {
    const d = db.deliverables.find((x) => x.id === id);
    if (!d) return null;
    d.status = status;
    d.feedback = feedback;
    d.decided_at = now();
    // Credit earnings on approval (INR, paise)
    if (status === "approved") {
      const c = db.campaigns.find((x) => x.id === d.campaign_id);
      const totalDeliverables = c?.deliverables.reduce((a, x) => a + x.qty, 0) || 1;
      const perItem = Math.round((c?.base_earning_cents || 0) / totalDeliverables);
      transactions.create(d.creator_id, {
        kind: "earning",
        status: "completed",
        amount_cents: perItem,
        description: `${c?.title || "Campaign"} \u2014 ${d.kind}`,
        reference_id: d.campaign_id,
      });
      const formatted = "\u20b9" + (perItem / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
      notifications.push(d.creator_id, {
        kind: "deliverable_approved",
        title: "Deliverable approved",
        body: `"${d.kind}" approved. ${formatted} credited to your wallet.`,
        link: `/earnings`,
      });
      profiles.recomputeStats(d.creator_id);
    } else if (status === "revision") {
      notifications.push(d.creator_id, {
        kind: "deliverable_feedback",
        title: "Revision requested",
        body: feedback.slice(0, 120),
        link: `/campaigns/${d.campaign_id}`,
      });
    }
    persist();
    return d;
  },
  markLive: (id: string, live_url: string) => {
    const d = db.deliverables.find((x) => x.id === id);
    if (!d) return null;
    d.status = "live";
    d.live_url = live_url;
    d.live_at = now();
    persist();
    return d;
  },
};

// ================================================================
// Messages
// ================================================================

export const messages = {
  threadsForCreator: (creatorId: string) =>
    db.message_threads
      .filter((t) => t.creator_id === creatorId)
      .sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1)),
  thread: (id: string) => db.message_threads.find((t) => t.id === id) || null,
  listMessages: (threadId: string) =>
    db.messages
      .filter((m) => m.thread_id === threadId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
  send: (threadId: string, senderId: string, senderRole: Message["sender_role"], body: string, attachment?: { url: string; kind: "image" | "video" | "file"; name: string; size: string }) => {
    const t = db.message_threads.find((x) => x.id === threadId);
    if (!t) return null;
    const m: Message = {
      id: newId(),
      thread_id: threadId,
      sender_id: senderId,
      sender_role: senderRole,
      body,
      attachment_url: attachment?.url ?? null,
      attachment_kind: attachment?.kind ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
      read: senderRole === "creator",
      created_at: now(),
    };
    db.messages.push(m);
    t.last_message_preview = body.slice(0, 120);
    t.last_message_at = m.created_at;
    if (senderRole !== "creator") t.unread_count += 1;
    else t.unread_count = 0;
    persist();
    return m;
  },
  markRead: (threadId: string) => {
    const t = db.message_threads.find((x) => x.id === threadId);
    if (!t) return;
    t.unread_count = 0;
    db.messages.filter((m) => m.thread_id === threadId).forEach((m) => (m.read = true));
    persist();
  },
  createThread: (creator_id: string, brand_id: string, opener: string) => {
    const existing = db.message_threads.find((t) => t.creator_id === creator_id && t.brand_id === brand_id);
    if (existing) return existing;
    const t: MessageThread = {
      id: newId(),
      creator_id,
      brand_id,
      campaign_id: null,
      last_message_preview: opener.slice(0, 120),
      last_message_at: now(),
      unread_count: 0,
      brand_online: Math.random() > 0.5,
      status_label: null,
    };
    db.message_threads.push(t);
    db.messages.push({
      id: newId(),
      thread_id: t.id,
      sender_id: creator_id,
      sender_role: "creator",
      body: opener,
      attachment_url: null,
      attachment_kind: null,
      attachment_name: null,
      attachment_size: null,
      read: true,
      created_at: now(),
    });
    persist();
    return t;
  },
};

// ================================================================
// Transactions & withdrawals
// ================================================================

export const transactions = {
  forUser: (userId: string) =>
    db.transactions
      .filter((t) => t.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  create: (userId: string, data: Omit<Transaction, "id" | "user_id" | "created_at">) => {
    const t: Transaction = { id: newId(), user_id: userId, created_at: now(), ...data };
    db.transactions.push(t);
    persist();
    return t;
  },
  balanceCents: (userId: string) => {
    const earned = db.transactions
      .filter((t) => t.user_id === userId && t.kind === "earning" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    const bonuses = db.transactions
      .filter((t) => t.user_id === userId && t.kind === "bonus" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    // Debit GROSS for each active withdrawal (balance shows what's still "in wallet")
    const withdrawn = db.withdrawals
      .filter((w) => w.user_id === userId && (w.status === "approved" || w.status === "paid" || w.status === "requested"))
      .reduce((a, w) => a + w.gross_cents, 0);
    return earned + bonuses - withdrawn;
  },
  fyEarnedBefore: (userId: string) => {
    // Paid-out earnings already taxed this FY — for Sec 194R threshold
    const fyStart = (() => {
      const now = new Date();
      return now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)
        : new Date(now.getFullYear() - 1, 3, 1);
    })();
    return db.withdrawals
      .filter((w) => w.user_id === userId && (w.status === "approved" || w.status === "paid")
        && new Date(w.requested_at) >= fyStart)
      .reduce((a, w) => a + w.gross_cents, 0);
  },
};

export const withdrawals = {
  list: (filter?: { user_id?: string; status?: Withdrawal["status"] }) => {
    let r = db.withdrawals;
    if (filter?.user_id) r = r.filter((w) => w.user_id === filter.user_id);
    if (filter?.status) r = r.filter((w) => w.status === filter.status);
    return r.sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));
  },
  byId: (id: string) => db.withdrawals.find((w) => w.id === id) || null,
  /**
   * Preview the tax breakup WITHOUT creating a withdrawal.
   * Frontend uses this to show gross / TDS / GST / net before user confirms.
   */
  preview: (user_id: string, gross_cents: number) => {
    const p = db.profiles.find((x) => x.id === user_id);
    if (!p) return null;
    const fy_before = withdrawals.fyEarnedBeforeForUser(user_id);
    const breakup = computeWithdrawalTax({
      gross_cents,
      fy_earned_before_cents: fy_before,
      has_pan: !!p.pan_number,
      has_gstin: !!p.gstin,
    });
    const hint = suggestedPayoutMethod(gross_cents, !!p.upi_id, !!p.bank_account_number);
    return {
      breakup,
      suggested_method: hint.method,
      method_reason: hint.reason,
      kyc_status: p.kyc_status,
      has_pan: !!p.pan_number,
      has_gstin: !!p.gstin,
      upi_limit_paise: UPI_LIMIT_PAISE,
    };
  },

  fyEarnedBeforeForUser: (userId: string) => {
    const fyStart = (() => {
      const now = new Date();
      return now.getMonth() >= 3
        ? new Date(now.getFullYear(), 3, 1)
        : new Date(now.getFullYear() - 1, 3, 1);
    })();
    return db.withdrawals
      .filter((w) => w.user_id === userId && (w.status === "approved" || w.status === "paid")
        && new Date(w.requested_at) >= fyStart)
      .reduce((a, w) => a + w.gross_cents, 0);
  },

  /**
   * Creates a withdrawal request with Indian tax compliance.
   * Validates: KYC verified, valid method + destination exists on profile, sufficient balance.
   */
  request: (user_id: string, gross_cents: number, method: "upi" | "bank") => {
    const p = db.profiles.find((x) => x.id === user_id);
    if (!p) return { ok: false, error: "Profile not found" };

    if (gross_cents < 50_000) return { ok: false, error: "Minimum withdrawal is \u20b9500" };

    // Balance check (against gross)
    const bal = transactions.balanceCents(user_id);
    if (gross_cents > bal) return { ok: false, error: `Insufficient balance (\u20b9${(bal/100).toLocaleString("en-IN")} available)` };

    // KYC mandatory for withdrawals (RBI / 194R hygiene)
    if (p.kyc_status !== "verified") {
      return { ok: false, error: "Complete KYC (PAN verification) before withdrawing" };
    }

    // Destination check
    let destination = "";
    if (method === "upi") {
      if (!p.upi_id) return { ok: false, error: "Add a UPI ID in Settings" };
      if (gross_cents > UPI_LIMIT_PAISE) return { ok: false, error: `UPI limit is \u20b91,00,000 per transaction \u2014 choose bank transfer` };
      destination = p.upi_id;
    } else {
      if (!p.bank_account_number || !p.bank_ifsc) return { ok: false, error: "Add bank account + IFSC in Settings" };
      destination = `${p.bank_ifsc.slice(0, 4)} \u2022\u2022\u2022\u2022${p.bank_account_number.slice(-4)}`;
    }

    // Tax breakup
    const fy_before = withdrawals.fyEarnedBeforeForUser(user_id);
    const breakup = computeWithdrawalTax({
      gross_cents,
      fy_earned_before_cents: fy_before,
      has_pan: !!p.pan_number,
      has_gstin: !!p.gstin,
    });

    // Generate invoice number for GST-registered creators
    let invoice_number: string | null = null;
    if (p.gstin) {
      const count = db.withdrawals.filter((w) => w.invoice_number).length;
      invoice_number = nextInvoiceNumber(count);
    }

    const w: Withdrawal = {
      id: newId(),
      user_id,
      gross_cents,
      tds_cents: breakup.tds_cents,
      gst_cents: breakup.gst_cents,
      net_cents: breakup.net_cents,
      amount_cents: breakup.net_cents,
      method,
      destination,
      utr: null,
      invoice_number,
      status: "requested",
      requested_at: now(),
      decided_at: null,
      paid_at: null,
      admin_note: null,
    };
    db.withdrawals.push(w);
    transactions.create(user_id, {
      kind: "withdrawal",
      status: "pending",
      amount_cents: -gross_cents,
      description: `Withdrawal via ${method.toUpperCase()} to ${destination}`,
      reference_id: w.id,
    });
    persist();
    return { ok: true, withdrawal: w };
  },
  decide: (id: string, status: Withdrawal["status"], admin_id: string, note?: string, utr?: string) => {
    const w = db.withdrawals.find((x) => x.id === id);
    if (!w) return null;
    w.status = status;
    w.decided_at = now();
    if (status === "paid") {
      w.paid_at = now();
      if (utr) w.utr = utr;
      else if (!w.utr) w.utr = "UTR" + Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
    }
    if (note) w.admin_note = note;

    // Update associated transaction
    const tx = db.transactions.find((t) => t.reference_id === w.id);
    if (tx) {
      if (status === "paid") tx.status = "completed";
      else if (status === "rejected") tx.status = "failed";
    }

    if (status === "paid") {
      const formatted = "\u20b9" + (w.net_cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
      notifications.push(w.user_id, {
        kind: "withdrawal_paid",
        title: "Withdrawal paid",
        body: `${formatted} sent via ${w.method.toUpperCase()} to ${w.destination}. UTR: ${w.utr}`,
        link: "/earnings",
      });
    }
    persist();
    return w;
  },
};

// ================================================================
// Campaign eligibility (server-authoritative)
// ================================================================

export const eligibility = {
  check: (user_id: string, campaign_id: string) => {
    const p = db.profiles.find((x) => x.id === user_id);
    const c = db.campaigns.find((x) => x.id === campaign_id);
    if (!p || !c) return { eligible: false, reasons: ["Not found"] };

    // Require at least one verified handle
    const verifiedHandle = db.social_accounts.some((s) => s.user_id === user_id && s.verified && s.connected);

    return checkCampaignEligibility({
      niches: p.niches,
      total_reach: p.total_reach,
      tier: p.tier,
      avg_engagement: p.avg_engagement,
      city: p.city,
      languages: p.languages,
      kyc_status: p.kyc_status,
      verified_handle: verifiedHandle,
    }, {
      required_niches: c.required_niches,
      min_followers: c.min_followers,
      max_followers: c.max_followers,
      allowed_tiers: c.allowed_tiers,
      preferred_cities: c.preferred_cities,
      preferred_languages: c.preferred_languages,
      min_engagement_rate: c.min_engagement_rate,
      requires_kyc: c.requires_kyc,
      base_earning_cents: c.base_earning_cents,
    });
  },
};

// ================================================================
// Community (events + perks + news)
// ================================================================

export const community = {
  list: (filter?: { kind?: CommunityItem["kind"]; city?: string; published?: boolean }) => {
    let r = db.community;
    if (filter?.kind) r = r.filter((c) => c.kind === filter.kind);
    if (filter?.city && filter.city !== "All Cities") r = r.filter((c) => c.city === filter.city);
    if (filter?.published !== undefined) r = r.filter((c) => c.published === filter.published);
    return r;
  },
  byId: (id: string) => db.community.find((c) => c.id === id) || null,
  create: (data: Omit<CommunityItem, "id" | "created_at" | "registered">) => {
    const c: CommunityItem = { ...data, id: newId(), registered: 0, created_at: now() };
    db.community.push(c);
    persist();
    return c;
  },
  update: (id: string, patch: Partial<CommunityItem>) => {
    const idx = db.community.findIndex((c) => c.id === id);
    if (idx < 0) return null;
    db.community[idx] = { ...db.community[idx], ...patch };
    persist();
    return db.community[idx];
  },
  remove: (id: string) => {
    db.community = db.community.filter((c) => c.id !== id);
    persist();
  },
  register: (id: string) => {
    const c = db.community.find((x) => x.id === id);
    if (!c) return null;
    c.registered += 1;
    persist();
    return c;
  },
};

// ================================================================
// Notifications
// ================================================================

export const notifications = {
  forUser: (userId: string) =>
    db.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  push: (user_id: string, data: Omit<Notification, "id" | "user_id" | "created_at" | "read">) => {
    const n: Notification = { id: newId(), user_id, created_at: now(), read: false, ...data };
    db.notifications.push(n);
    persist();
    return n;
  },
  markRead: (id: string) => {
    const n = db.notifications.find((x) => x.id === id);
    if (n) {
      n.read = true;
      persist();
    }
    return n;
  },
  markAllRead: (user_id: string) => {
    db.notifications.filter((n) => n.user_id === user_id).forEach((n) => (n.read = true));
    persist();
  },
};

// ================================================================
// Audit log
// ================================================================

export const audit = {
  list: () =>
    db.audit_log.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  log: (admin_id: string, action: string, entity_kind: string, entity_id: string, details?: any) => {
    const a: AuditLog = {
      id: newId(),
      admin_id,
      action,
      entity_kind,
      entity_id,
      details: details ? JSON.stringify(details) : null,
      created_at: now(),
    };
    db.audit_log.push(a);
    persist();
    return a;
  },
};

// ================================================================
// Admin analytics
// ================================================================

export const analytics = {
  summary: () => {
    const activeCampaigns = db.campaigns.filter((c) => c.status === "open").length;
    const creators = db.profiles.filter((p) => p.role === "creator").length;
    const verifiedCreators = db.profiles.filter((p) => p.role === "creator" && p.verified_pro).length;
    const gmvCents = db.transactions
      .filter((t) => t.kind === "earning" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    const pendingPayouts = db.withdrawals.filter((w) => w.status === "requested").length;
    const pendingPayoutCents = db.withdrawals
      .filter((w) => w.status === "requested")
      .reduce((a, w) => a + w.amount_cents, 0);
    const pendingApplications = db.applications.filter((a) => a.status === "pending").length;
    const pendingDeliverables = db.deliverables.filter((d) => d.status === "submitted").length;

    // Last 30 days earnings by day
    const daily: { date: string; cents: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cents = db.transactions
        .filter(
          (t) =>
            t.kind === "earning" &&
            t.status === "completed" &&
            t.created_at.slice(0, 10) === key
        )
        .reduce((a, t) => a + t.amount_cents, 0);
      daily.push({ date: key, cents });
    }

    return {
      activeCampaigns,
      creators,
      verifiedCreators,
      gmvCents,
      pendingPayouts,
      pendingPayoutCents,
      pendingApplications,
      pendingDeliverables,
      daily,
    };
  },
};
