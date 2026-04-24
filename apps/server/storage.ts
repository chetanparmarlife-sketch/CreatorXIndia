import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  Application,
  AuditLog,
  Brand,
  Campaign,
  CommunityItem,
  CreatorTier,
  Deliverable,
  Message,
  MessageThread,
  Notification,
  PushPlatform,
  Profile,
  SocialAccount,
  Transaction,
  Withdrawal,
} from "@creatorx/schema";
import {
  UPI_LIMIT_PAISE,
  applications as applicationsTable,
  audit_log as auditLogTable,
  brands as brandsTable,
  campaigns as campaignsTable,
  checkCampaignEligibility,
  community as communityTable,
  computeTier,
  computeWithdrawalTax,
  db,
  deliverables as deliverablesTable,
  isValidAadhaarLast4,
  isValidGSTIN,
  isValidIFSC,
  isValidPAN,
  isValidUPI,
  message_threads as messageThreadsTable,
  messages as messagesTable,
  nextInvoiceNumber,
  notifications as notificationsTable,
  push_tokens as pushTokensTable,
  profiles as profilesTable,
  social_accounts as socialAccountsTable,
  suggestedPayoutMethod,
  transactions as transactionsTable,
  withdrawals as withdrawalsTable,
} from "@creatorx/schema";
import { seed } from "./seed";

const newId = () => nanoid(12);
const now = () => new Date().toISOString();

let initPromise: Promise<void> | null = null;

async function ensureSeeded(): Promise<void> {
  if (!initPromise) {
    initPromise = seed().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
}

function currentFyStartIso(): string {
  const d = new Date();
  const fyStart = d.getMonth() >= 3 ? new Date(d.getFullYear(), 3, 1) : new Date(d.getFullYear() - 1, 3, 1);
  return fyStart.toISOString();
}

function redactPII(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => redactPII(item));
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (/(email|phone|pan)/i.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactPII(v);
      }
    }
    return out;
  }
  return input;
}

function toDiffJson(diff: unknown): Record<string, unknown> | null {
  if (diff === undefined || diff === null) return null;
  const redacted = redactPII(diff);
  if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
    return redacted as Record<string, unknown>;
  }
  return { value: redacted };
}

async function writeAudit(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  diff?: unknown,
): Promise<AuditLog> {
  const created_at = now();
  const actorId = actorUserId ?? "system";
  const diff_json = toDiffJson(diff);
  const details = diff_json ? JSON.stringify(diff_json) : null;

  const row = {
    id: newId(),
    actor_user_id: actorId ?? "system",
    admin_id: actorId ?? "system",
    action,
    target_type: targetType,
    target_id: targetId,
    entity_kind: targetType,
    entity_id: targetId,
    diff_json,
    details,
    created_at,
  };

  await db.insert(auditLogTable).values(row);
  return row;
}

function sortDescBy<T extends { created_at: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

function sortAscBy<T extends { created_at: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export interface IStorage {
  upsertPushToken(userId: string, token: string, platform: PushPlatform): Promise<void>;
  getBrandProfile(userId: string): Promise<Brand>;
  updateBrandProfile(
    userId: string,
    data: {
      companyName: string;
      industry: string;
      websiteUrl: string;
      gstin?: string;
      logoUrl?: string;
    },
  ): Promise<Brand>;
  getBrandDashboardStats(userId: string): Promise<{
    activeCampaigns: number;
    totalSpentPaise: number;
    pendingApplications: number;
    approvedDeliverables: number;
  }>;
  getBrandActivity(userId: string): Promise<AuditLog[]>;
  createCampaign(
    userId: string,
    data: {
      title: string;
      description: string;
      niche: string;
      platforms: Campaign["platforms"];
      deliverable_type: "post" | "reel" | "story" | "video";
      budget_paise: number;
      max_creators: number;
      application_deadline: string;
      brief_url?: string;
    },
  ): Promise<Campaign>;
}

export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw(
      'TRUNCATE TABLE "push_tokens", "messages", "message_threads", "deliverables", "applications", "transactions", "withdrawals", "social_accounts", "community", "notifications", "campaigns", "brands", "audit_log", "profiles" CASCADE',
    ),
  );
  initPromise = null;
  await ensureSeeded();
  await writeAudit("system", "reset_database", "system", "database", { reset: true });
}

export async function upsertPushToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
  await ensureSeeded();

  const [existing] = await db
    .select({ id: pushTokensTable.id })
    .from(pushTokensTable)
    .where(and(eq(pushTokensTable.user_id, userId), eq(pushTokensTable.platform, platform)))
    .limit(1);

  if (existing) {
    await db
      .update(pushTokensTable)
      .set({ token, updated_at: now() })
      .where(eq(pushTokensTable.id, existing.id));
    await writeAudit(userId, "update_push_token", "push_token", existing.id, { platform });
    return;
  }

  const row = {
    id: newId(),
    user_id: userId,
    token,
    platform,
    created_at: now(),
    updated_at: now(),
  };

  await db.insert(pushTokensTable).values(row);
  await writeAudit(userId, "create_push_token", "push_token", row.id, { platform });
}

export async function getBrandProfile(userId: string): Promise<Brand> {
  await ensureSeeded();

  const [existing] = await db.select().from(brandsTable).where(eq(brandsTable.id, userId)).limit(1);
  if (existing) return existing;

  const profile = await profiles.byId(userId);
  const row: Brand = {
    id: userId,
    name: profile?.full_name ? `${profile.full_name} Brand` : "My Brand",
    logo_url: null,
    verified: false,
    website: null,
    industry: "",
    description: null,
    contact_email: profile?.email ?? null,
    created_at: now(),
  };

  await db.insert(brandsTable).values(row);
  await writeAudit(userId, "create_brand_profile", "brand", userId, { created: true });
  return row;
}

export async function updateBrandProfile(
  userId: string,
  data: {
    companyName: string;
    industry: string;
    websiteUrl: string;
    gstin?: string;
    logoUrl?: string;
  },
): Promise<Brand> {
  await ensureSeeded();

  const current = await getBrandProfile(userId);
  const [updated] = await db
    .update(brandsTable)
    .set({
      name: data.companyName.trim(),
      industry: data.industry.trim(),
      website: data.websiteUrl.trim(),
      logo_url: data.logoUrl?.trim() || current.logo_url,
    })
    .where(eq(brandsTable.id, userId))
    .returning();

  if (data.gstin) {
    await db
      .update(profilesTable)
      .set({ gstin: data.gstin.toUpperCase() })
      .where(eq(profilesTable.id, userId));
  }

  await writeAudit(userId, "update_brand_profile", "brand", userId, {
    companyName: data.companyName,
    industry: data.industry,
    websiteUrl: data.websiteUrl,
    gstin: data.gstin,
    logoUrl: data.logoUrl,
  });

  return updated ?? current;
}

export async function getBrandDashboardStats(userId: string): Promise<{
  activeCampaigns: number;
  totalSpentPaise: number;
  pendingApplications: number;
  approvedDeliverables: number;
}> {
  await ensureSeeded();

  const brandCampaigns = await db
    .select({ id: campaignsTable.id, status: campaignsTable.status })
    .from(campaignsTable)
    .where(eq(campaignsTable.brand_id, userId));

  const campaignIds = brandCampaigns.map((campaign) => campaign.id);
  const activeCampaigns = brandCampaigns.filter((campaign) => campaign.status === "open").length;

  if (campaignIds.length === 0) {
    return {
      activeCampaigns,
      totalSpentPaise: 0,
      pendingApplications: 0,
      approvedDeliverables: 0,
    };
  }

  const [brandApplications, brandDeliverables, brandTransactions] = await Promise.all([
    db
      .select({ status: applicationsTable.status })
      .from(applicationsTable)
      .where(inArray(applicationsTable.campaign_id, campaignIds)),
    db
      .select({ status: deliverablesTable.status })
      .from(deliverablesTable)
      .where(inArray(deliverablesTable.campaign_id, campaignIds)),
    db
      .select({
        amount_cents: transactionsTable.amount_cents,
        kind: transactionsTable.kind,
        status: transactionsTable.status,
      })
      .from(transactionsTable)
      .where(inArray(transactionsTable.reference_id, campaignIds)),
  ]);

  const pendingApplications = brandApplications.filter((application) => application.status === "pending").length;
  const approvedDeliverables = brandDeliverables.filter((deliverable) => deliverable.status === "approved").length;
  const totalSpentPaise = brandTransactions
    .filter((transaction) => transaction.kind === "earning" && transaction.status === "completed")
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount_cents), 0);

  return {
    activeCampaigns,
    totalSpentPaise,
    pendingApplications,
    approvedDeliverables,
  };
}

export async function getBrandActivity(userId: string): Promise<AuditLog[]> {
  await ensureSeeded();

  const [brandCampaigns, allAuditRows] = await Promise.all([
    db.select({ id: campaignsTable.id }).from(campaignsTable).where(eq(campaignsTable.brand_id, userId)),
    db.select().from(auditLogTable),
  ]);

  const campaignIds = new Set(brandCampaigns.map((campaign) => campaign.id));

  const rows = allAuditRows.filter((entry) => {
    if (entry.actor_user_id === userId) return true;
    if (entry.target_type === "brand" && entry.target_id === userId) return true;
    if (entry.entity_kind === "brand" && entry.entity_id === userId) return true;
    if (entry.target_type === "campaign" && campaignIds.has(entry.target_id)) return true;
    if (entry.entity_kind === "campaign" && campaignIds.has(entry.entity_id)) return true;
    return false;
  });

  return sortDescBy(rows).slice(0, 10);
}

export async function createCampaign(
  userId: string,
  data: {
    title: string;
    description: string;
    niche: string;
    platforms: Campaign["platforms"];
    deliverable_type: "post" | "reel" | "story" | "video";
    budget_paise: number;
    max_creators: number;
    application_deadline: string;
    brief_url?: string;
  },
): Promise<Campaign> {
  await ensureSeeded();
  await getBrandProfile(userId);

  const deadlineDate = new Date(`${data.application_deadline}T23:59:59.000Z`);
  const draftDeadlineDate = new Date(deadlineDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const liveDate = new Date(deadlineDate.getTime() + 14 * 24 * 60 * 60 * 1000);

  const perCreatorBudget = Math.max(1, Math.floor(data.budget_paise / data.max_creators));
  const deliverableKind: Record<"post" | "reel" | "story" | "video", string> = {
    post: "Post",
    reel: "Reel",
    story: "Story",
    video: "Video",
  };

  const row: Campaign = {
    id: newId(),
    brand_id: userId,
    title: data.title.trim(),
    cover_image_url: null,
    description: data.description.trim(),
    category: data.niche,
    tags: [],
    deliverables: [
      {
        kind: deliverableKind[data.deliverable_type],
        qty: 1,
        spec: data.brief_url ? `See brief: ${data.brief_url}` : "Refer to campaign brief",
      },
    ],
    platforms: data.platforms,
    base_earning_cents: perCreatorBudget,
    commission_pct: 0,
    product_bonus: false,
    product_bonus_cents: 0,
    required_niches: [data.niche],
    min_followers: 0,
    max_followers: 0,
    allowed_tiers: [],
    preferred_cities: [],
    preferred_languages: [],
    min_engagement_rate: 0,
    requires_kyc: false,
    slots_total: data.max_creators,
    slots_filled: 0,
    apply_deadline: deadlineDate.toISOString(),
    draft_deadline: draftDeadlineDate.toISOString(),
    live_date: liveDate.toISOString(),
    status: "draft",
    featured: false,
    high_ticket: false,
    dos: [],
    donts: [],
    created_at: now(),
  };

  await db.insert(campaignsTable).values(row);
  await writeAudit(userId, "create_brand_campaign", "campaign", row.id, {
    title: row.title,
    budget_paise: data.budget_paise,
    max_creators: data.max_creators,
    application_deadline: data.application_deadline,
  });

  return row;
}

export const profiles = {
  async list(): Promise<Profile[]> {
    await ensureSeeded();
    return db.select().from(profilesTable);
  },

  async byId(id: string): Promise<Profile | null> {
    await ensureSeeded();
    const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, id)).limit(1);
    return row ?? null;
  },

  async byEmail(email: string): Promise<Profile | null> {
    await ensureSeeded();
    const [row] = await db
      .select()
      .from(profilesTable)
      .where(sql`lower(${profilesTable.email}) = lower(${email})`)
      .limit(1);
    return row ?? null;
  },

  async search(q: string): Promise<Profile[]> {
    await ensureSeeded();
    const s = `%${q}%`;
    return db
      .select()
      .from(profilesTable)
      .where(
        or(
          ilike(profilesTable.full_name, s),
          ilike(profilesTable.handle, s),
          ilike(profilesTable.email, s),
        ),
      );
  },

  async create(data: Partial<Profile> & { email: string; full_name: string; handle: string }): Promise<Profile> {
    await ensureSeeded();
    const row: Profile = {
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
    await db.insert(profilesTable).values(row);
    await writeAudit(row.id, "create_profile", "profile", row.id, row);
    return row;
  },

  async update(id: string, patch: Partial<Profile>): Promise<Profile | null> {
    await ensureSeeded();
    const [updated] = await db
      .update(profilesTable)
      .set(patch)
      .where(eq(profilesTable.id, id))
      .returning();
    if (!updated) return null;
    await writeAudit(id, "update_profile", "profile", id, patch);
    return updated;
  },

  async remove(id: string): Promise<boolean> {
    await ensureSeeded();
    const deleted = await db.delete(profilesTable).where(eq(profilesTable.id, id)).returning({ id: profilesTable.id });
    if (deleted.length === 0) return false;
    await writeAudit(id, "remove_profile", "profile", id, { removed: true });
    return true;
  },

  async recomputeStats(userId: string): Promise<Profile | null> {
    await ensureSeeded();
    const allSocials = await db
      .select()
      .from(socialAccountsTable)
      .where(and(eq(socialAccountsTable.user_id, userId), eq(socialAccountsTable.connected, true)));

    const total_reach = allSocials.reduce((a, s) => a + s.followers, 0);
    const avg_engagement =
      allSocials.length > 0
        ? Math.round((allSocials.reduce((a, s) => a + s.engagement_rate, 0) / allSocials.length) * 10) / 10
        : 0;

    const allTx = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.user_id, userId), eq(transactionsTable.kind, "earning"), eq(transactionsTable.status, "completed")));

    const total_earned_cents = allTx.reduce((a, t) => a + t.amount_cents, 0);
    const fyStartIso = currentFyStartIso();
    const fy_earned_cents = allTx.filter((t) => t.created_at >= fyStartIso).reduce((a, t) => a + t.amount_cents, 0);
    const tier = computeTier(total_reach);

    return profiles.update(userId, { total_reach, avg_engagement, total_earned_cents, fy_earned_cents, tier });
  },

  async submitKyc(
    userId: string,
    data: { pan_number: string; pan_name: string; aadhaar_last4?: string | null; gstin?: string | null },
  ): Promise<{ ok: true; profile: Profile } | { ok: false; error: string }> {
    await ensureSeeded();
    const p = await profiles.byId(userId);
    if (!p) return { ok: false, error: "Profile not found" };

    const pan = data.pan_number.trim().toUpperCase();
    if (!isValidPAN(pan)) return { ok: false, error: "Invalid PAN format (expected ABCDE1234F)" };
    if (!data.pan_name?.trim()) return { ok: false, error: "Name as on PAN is required" };
    if (data.aadhaar_last4 && !isValidAadhaarLast4(data.aadhaar_last4)) {
      return { ok: false, error: "Aadhaar last-4 must be 4 digits" };
    }
    if (data.gstin && !isValidGSTIN(data.gstin)) return { ok: false, error: "Invalid GSTIN format" };

    const updated = await profiles.update(userId, {
      pan_number: pan,
      pan_name: data.pan_name.trim().toUpperCase(),
      aadhaar_last4: data.aadhaar_last4 || null,
      gstin: data.gstin ? data.gstin.toUpperCase() : null,
      kyc_status: "pending",
      kyc_submitted_at: now(),
      kyc_rejection_reason: null,
    });

    if (!updated) return { ok: false, error: "Profile not found" };

    await notifications.push(userId, {
      kind: "system",
      title: "KYC submitted",
      body: "We're reviewing your PAN. Usually verified within 24 hours.",
      link: "/settings",
    });

    return { ok: true, profile: updated };
  },

  async decideKyc(userId: string, decision: "verified" | "rejected", reason: string | null): Promise<Profile | null> {
    await ensureSeeded();
    const updated = await profiles.update(userId, {
      kyc_status: decision,
      kyc_verified_at: decision === "verified" ? now() : null,
      kyc_rejection_reason: decision === "rejected" ? reason || "Please re-submit with correct details" : null,
    });
    if (!updated) return null;

    if (decision === "verified") {
      await notifications.push(userId, {
        kind: "kyc_verified",
        title: "KYC verified ✓",
        body: "You can now apply to KYC-required campaigns and withdraw funds.",
        link: "/settings",
      });
    } else {
      await notifications.push(userId, {
        kind: "kyc_rejected",
        title: "KYC needs attention",
        body: updated.kyc_rejection_reason || "Please re-submit with correct details",
        link: "/settings",
      });
    }

    return updated;
  },

  async setPayoutInstrument(
    userId: string,
    data: {
      upi_id?: string | null;
      bank_account_number?: string | null;
      bank_ifsc?: string | null;
      bank_account_holder?: string | null;
    },
  ): Promise<{ ok: true; profile: Profile } | { ok: false; error: string }> {
    await ensureSeeded();
    const p = await profiles.byId(userId);
    if (!p) return { ok: false, error: "Profile not found" };

    const patch: Partial<Profile> = {};

    if (data.upi_id !== undefined) {
      if (data.upi_id && !isValidUPI(data.upi_id)) return { ok: false, error: "Invalid UPI ID (expected user@bank)" };
      patch.upi_id = data.upi_id || null;
    }

    if (data.bank_ifsc !== undefined) {
      if (data.bank_ifsc && !isValidIFSC(data.bank_ifsc)) {
        return { ok: false, error: "Invalid IFSC (expected 4 letters + 0 + 6 alphanumeric)" };
      }
      patch.bank_ifsc = data.bank_ifsc ? data.bank_ifsc.toUpperCase() : null;
    }

    if (data.bank_account_number !== undefined) {
      if (data.bank_account_number && !/^[0-9]{9,18}$/.test(data.bank_account_number)) {
        return { ok: false, error: "Bank account number must be 9–18 digits" };
      }
      patch.bank_account_number = data.bank_account_number || null;
    }

    if (data.bank_account_holder !== undefined) patch.bank_account_holder = data.bank_account_holder || null;

    const updated = await profiles.update(userId, patch);
    if (!updated) return { ok: false, error: "Profile not found" };

    return { ok: true, profile: updated };
  },

  async verifyHandle(socialId: string, note: string | null): Promise<SocialAccount | null> {
    await ensureSeeded();
    const [s] = await db
      .update(socialAccountsTable)
      .set({ verified: true, verification_note: note })
      .where(eq(socialAccountsTable.id, socialId))
      .returning();

    if (!s) return null;

    await writeAudit("system", "verify_handle", "social", socialId, { note });

    await notifications.push(s.user_id, {
      kind: "handle_verified",
      title: `${s.platform} handle verified`,
      body: `${s.handle} is now verified.`,
      link: "/settings",
    });

    return s;
  },
};

export const socials = {
  async forUser(userId: string): Promise<SocialAccount[]> {
    await ensureSeeded();
    return db.select().from(socialAccountsTable).where(eq(socialAccountsTable.user_id, userId));
  },

  async connect(
    userId: string,
    platform: SocialAccount["platform"],
    handle: string,
    followers: number,
    engagement_rate: number,
  ): Promise<SocialAccount> {
    await ensureSeeded();
    const existing = await db
      .select()
      .from(socialAccountsTable)
      .where(and(eq(socialAccountsTable.user_id, userId), eq(socialAccountsTable.platform, platform)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(socialAccountsTable)
        .set({
          connected: true,
          handle,
          followers,
          engagement_rate,
          connected_at: now(),
          verified: false,
          verification_note: null,
        })
        .where(eq(socialAccountsTable.id, existing[0].id))
        .returning();

      await profiles.recomputeStats(userId);
      await writeAudit(userId, "social_connect", "social", updated.id, updated);
      return updated;
    }

    const row: SocialAccount = {
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

    await db.insert(socialAccountsTable).values(row);
    await profiles.recomputeStats(userId);
    await writeAudit(userId, "social_connect", "social", row.id, row);
    return row;
  },

  async toggle(id: string, connected: boolean): Promise<SocialAccount | null> {
    await ensureSeeded();
    const [s] = await db
      .update(socialAccountsTable)
      .set({ connected, connected_at: connected ? now() : null })
      .where(eq(socialAccountsTable.id, id))
      .returning();

    if (!s) return null;
    await profiles.recomputeStats(s.user_id);
    await writeAudit(s.user_id, "social_toggle", "social", id, { connected });
    return s;
  },

  async disconnect(id: string): Promise<SocialAccount | null> {
    return socials.toggle(id, false);
  },
};

export const brands = {
  async list(): Promise<Brand[]> {
    await ensureSeeded();
    return db.select().from(brandsTable);
  },

  async byId(id: string): Promise<Brand | null> {
    await ensureSeeded();
    const [row] = await db.select().from(brandsTable).where(eq(brandsTable.id, id)).limit(1);
    return row ?? null;
  },

  async create(data: Omit<Brand, "id" | "created_at">): Promise<Brand> {
    await ensureSeeded();
    const row: Brand = { ...data, id: newId(), created_at: now() };
    await db.insert(brandsTable).values(row);
    await writeAudit("system", "create_brand", "brand", row.id, row);
    return row;
  },

  async update(id: string, patch: Partial<Brand>): Promise<Brand | null> {
    await ensureSeeded();
    const [row] = await db.update(brandsTable).set(patch).where(eq(brandsTable.id, id)).returning();
    if (!row) return null;
    await writeAudit("system", "update_brand", "brand", id, patch);
    return row;
  },

  async remove(id: string): Promise<void> {
    await ensureSeeded();
    await db.delete(brandsTable).where(eq(brandsTable.id, id));
    await writeAudit("system", "delete_brand", "brand", id, { removed: true });
  },
};

export const campaigns = {
  async list(filters?: { category?: string; status?: Campaign["status"]; featured?: boolean }): Promise<Campaign[]> {
    await ensureSeeded();
    let rows = await db.select().from(campaignsTable);
    if (filters?.category && filters.category !== "All") rows = rows.filter((c) => c.category === filters.category);
    if (filters?.status) rows = rows.filter((c) => c.status === filters.status);
    if (filters?.featured !== undefined) rows = rows.filter((c) => c.featured === filters.featured);
    return rows;
  },

  async byId(id: string): Promise<Campaign | null> {
    await ensureSeeded();
    const [row] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id)).limit(1);
    return row ?? null;
  },

  async create(data: Omit<Campaign, "id" | "created_at" | "slots_filled">): Promise<Campaign> {
    await ensureSeeded();
    const row: Campaign = { ...data, id: newId(), slots_filled: 0, created_at: now() };
    await db.insert(campaignsTable).values(row);
    await writeAudit("system", "create_campaign", "campaign", row.id, row);
    return row;
  },

  async update(id: string, patch: Partial<Campaign>): Promise<Campaign | null> {
    await ensureSeeded();
    const [row] = await db.update(campaignsTable).set(patch).where(eq(campaignsTable.id, id)).returning();
    if (!row) return null;
    await writeAudit("system", "update_campaign", "campaign", id, patch);
    return row;
  },

  async remove(id: string): Promise<void> {
    await ensureSeeded();
    await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
    await writeAudit("system", "delete_campaign", "campaign", id, { removed: true });
  },
};

export const applications = {
  async list(filter?: {
    creator_id?: string;
    campaign_id?: string;
    status?: Application["status"];
  }): Promise<Application[]> {
    await ensureSeeded();
    let rows = await db.select().from(applicationsTable);
    if (filter?.creator_id) rows = rows.filter((a) => a.creator_id === filter.creator_id);
    if (filter?.campaign_id) rows = rows.filter((a) => a.campaign_id === filter.campaign_id);
    if (filter?.status) rows = rows.filter((a) => a.status === filter.status);
    return rows;
  },

  async byId(id: string): Promise<Application | null> {
    await ensureSeeded();
    const [row] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id)).limit(1);
    return row ?? null;
  },

  async create(creator_id: string, campaign_id: string, pitch: string): Promise<Application> {
    await ensureSeeded();
    const row: Application = {
      id: newId(),
      creator_id,
      campaign_id,
      pitch,
      status: "pending",
      applied_at: now(),
      decided_at: null,
      decided_by: null,
    };
    await db.insert(applicationsTable).values(row);
    await writeAudit(creator_id, "create_application", "application", row.id, row);
    return row;
  },

  async decide(id: string, decision: "accepted" | "rejected", admin_id: string): Promise<Application | null> {
    await ensureSeeded();
    const [a] = await db
      .update(applicationsTable)
      .set({ status: decision, decided_at: now(), decided_by: admin_id })
      .where(eq(applicationsTable.id, id))
      .returning();

    if (!a) return null;

    if (decision === "accepted") {
      const c = await campaigns.byId(a.campaign_id);
      if (c) {
        const nextSlots = Math.min(c.slots_filled + 1, c.slots_total);
        await db.update(campaignsTable).set({ slots_filled: nextSlots }).where(eq(campaignsTable.id, c.id));

        const toCreate: Deliverable[] = [];
        for (const d of c.deliverables) {
          for (let i = 0; i < d.qty; i++) {
            toCreate.push({
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
        }
        if (toCreate.length > 0) await db.insert(deliverablesTable).values(toCreate);

        const [existingThread] = await db
          .select()
          .from(messageThreadsTable)
          .where(
            and(
              eq(messageThreadsTable.creator_id, a.creator_id),
              eq(messageThreadsTable.brand_id, c.brand_id),
              eq(messageThreadsTable.campaign_id, c.id),
            ),
          )
          .limit(1);

        if (!existingThread) {
          const thread: MessageThread = {
            id: newId(),
            creator_id: a.creator_id,
            brand_id: c.brand_id,
            campaign_id: c.id,
            last_message_preview: `Welcome to ${c.title}! Excited to collaborate.`,
            last_message_at: now(),
            unread_count: 1,
            brand_online: true,
            status_label: "CAMPAIGN ACTIVE",
          };
          await db.insert(messageThreadsTable).values(thread);
          await db.insert(messagesTable).values({
            id: newId(),
            thread_id: thread.id,
            sender_id: `brand:${c.brand_id}`,
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

      await notifications.push(a.creator_id, {
        kind: "application_accepted",
        title: "Application accepted",
        body: `You're in for ${c?.title || "the campaign"}.`,
        link: `/campaigns/${a.campaign_id}`,
      });
    } else {
      await notifications.push(a.creator_id, {
        kind: "application_rejected",
        title: "Application update",
        body: "Unfortunately, your application wasn't selected this time.",
        link: `/campaigns/${a.campaign_id}`,
      });
    }

    await writeAudit(admin_id, `${decision}_application`, "application", id, { decision });
    return a;
  },
};

export const deliverables = {
  async list(filter?: { creator_id?: string; campaign_id?: string; status?: Deliverable["status"] }): Promise<Deliverable[]> {
    await ensureSeeded();
    let rows = await db.select().from(deliverablesTable);
    if (filter?.creator_id) rows = rows.filter((d) => d.creator_id === filter.creator_id);
    if (filter?.campaign_id) rows = rows.filter((d) => d.campaign_id === filter.campaign_id);
    if (filter?.status) rows = rows.filter((d) => d.status === filter.status);
    return rows;
  },

  async byId(id: string): Promise<Deliverable | null> {
    await ensureSeeded();
    const [row] = await db.select().from(deliverablesTable).where(eq(deliverablesTable.id, id)).limit(1);
    return row ?? null;
  },

  async submit(id: string, asset_url: string, caption: string): Promise<Deliverable | null> {
    await ensureSeeded();
    const [row] = await db
      .update(deliverablesTable)
      .set({ status: "submitted", asset_url, caption, submitted_at: now() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    if (!row) return null;
    await writeAudit(row.creator_id, "submit_deliverable", "deliverable", id, { asset_url, caption });
    return row;
  },

  async decide(
    id: string,
    status: "approved" | "revision" | "rejected",
    feedback: string,
    admin_id: string,
  ): Promise<Deliverable | null> {
    await ensureSeeded();
    const [d] = await db
      .update(deliverablesTable)
      .set({ status, feedback, decided_at: now() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    if (!d) return null;

    if (status === "approved") {
      const c = await campaigns.byId(d.campaign_id);
      const totalDeliverables = c?.deliverables.reduce((a, x) => a + x.qty, 0) || 1;
      const perItem = Math.round((c?.base_earning_cents || 0) / totalDeliverables);

      await transactions.create(d.creator_id, {
        kind: "earning",
        status: "completed",
        amount_cents: perItem,
        description: `${c?.title || "Campaign"} — ${d.kind}`,
        reference_id: d.campaign_id,
      });

      const formatted = "₹" + (perItem / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
      await notifications.push(d.creator_id, {
        kind: "deliverable_approved",
        title: "Deliverable approved",
        body: `"${d.kind}" approved. ${formatted} credited to your wallet.`,
        link: "/earnings",
      });

      await profiles.recomputeStats(d.creator_id);
    } else if (status === "revision") {
      await notifications.push(d.creator_id, {
        kind: "deliverable_feedback",
        title: "Revision requested",
        body: feedback.slice(0, 120),
        link: `/campaigns/${d.campaign_id}`,
      });
    }

    await writeAudit(admin_id, `${status}_deliverable`, "deliverable", id, { feedback });
    return d;
  },

  async markLive(id: string, live_url: string): Promise<Deliverable | null> {
    await ensureSeeded();
    const [row] = await db
      .update(deliverablesTable)
      .set({ status: "live", live_url, live_at: now() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    if (!row) return null;
    await writeAudit(row.creator_id, "live_deliverable", "deliverable", id, { live_url });
    return row;
  },
};

export const messages = {
  async threadsForCreator(creatorId: string): Promise<MessageThread[]> {
    await ensureSeeded();
    const rows = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.creator_id, creatorId));
    return rows.sort((a, b) => (a.last_message_at < b.last_message_at ? 1 : -1));
  },

  async thread(id: string): Promise<MessageThread | null> {
    await ensureSeeded();
    const [row] = await db.select().from(messageThreadsTable).where(eq(messageThreadsTable.id, id)).limit(1);
    return row ?? null;
  },

  async listMessages(threadId: string): Promise<Message[]> {
    await ensureSeeded();
    const rows = await db.select().from(messagesTable).where(eq(messagesTable.thread_id, threadId));
    return sortAscBy(rows);
  },

  async send(
    threadId: string,
    senderId: string,
    senderRole: Message["sender_role"],
    body: string,
    attachment?: { url: string; kind: "image" | "video" | "file"; name: string; size: string },
  ): Promise<Message | null> {
    await ensureSeeded();
    const t = await messages.thread(threadId);
    if (!t) return null;

    const msg: Message = {
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

    await db.insert(messagesTable).values(msg);
    await db
      .update(messageThreadsTable)
      .set({
        last_message_preview: body.slice(0, 120),
        last_message_at: msg.created_at,
        unread_count: senderRole !== "creator" ? t.unread_count + 1 : 0,
      })
      .where(eq(messageThreadsTable.id, threadId));

    await writeAudit(senderId, "send_message", "message", msg.id, { thread_id: threadId });
    return msg;
  },

  async markRead(threadId: string): Promise<void> {
    await ensureSeeded();
    const t = await messages.thread(threadId);
    if (!t) return;

    await db.update(messageThreadsTable).set({ unread_count: 0 }).where(eq(messageThreadsTable.id, threadId));
    await db.update(messagesTable).set({ read: true }).where(eq(messagesTable.thread_id, threadId));
    await writeAudit(t.creator_id, "mark_thread_read", "thread", threadId, { read: true });
  },

  async createThread(creator_id: string, brand_id: string, opener: string): Promise<MessageThread> {
    await ensureSeeded();
    const [existing] = await db
      .select()
      .from(messageThreadsTable)
      .where(and(eq(messageThreadsTable.creator_id, creator_id), eq(messageThreadsTable.brand_id, brand_id)))
      .limit(1);

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

    await db.insert(messageThreadsTable).values(t);
    await db.insert(messagesTable).values({
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

    await writeAudit(creator_id, "create_thread", "thread", t.id, { brand_id });
    return t;
  },
};

export const transactions = {
  async forUser(userId: string): Promise<Transaction[]> {
    await ensureSeeded();
    const rows = await db.select().from(transactionsTable).where(eq(transactionsTable.user_id, userId));
    return sortDescBy(rows);
  },

  async create(userId: string, data: Omit<Transaction, "id" | "user_id" | "created_at">): Promise<Transaction> {
    await ensureSeeded();
    const row: Transaction = { id: newId(), user_id: userId, created_at: now(), ...data };
    await db.insert(transactionsTable).values(row);
    await writeAudit(userId, "create_transaction", "transaction", row.id, row);
    return row;
  },

  async balanceCents(userId: string): Promise<number> {
    await ensureSeeded();
    const tx = await db.select().from(transactionsTable).where(eq(transactionsTable.user_id, userId));
    const ws = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.user_id, userId));

    const earned = tx
      .filter((t) => t.kind === "earning" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    const bonuses = tx
      .filter((t) => t.kind === "bonus" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);
    const withdrawn = ws
      .filter((w) => w.status === "approved" || w.status === "paid" || w.status === "requested")
      .reduce((a, w) => a + w.gross_cents, 0);

    return earned + bonuses - withdrawn;
  },

  async fyEarnedBefore(userId: string): Promise<number> {
    await ensureSeeded();
    const fyStart = currentFyStartIso();
    const ws = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.user_id, userId));
    return ws
      .filter((w) => (w.status === "approved" || w.status === "paid") && w.requested_at >= fyStart)
      .reduce((a, w) => a + w.gross_cents, 0);
  },
};

export const withdrawals = {
  async list(filter?: { user_id?: string; status?: Withdrawal["status"] }): Promise<Withdrawal[]> {
    await ensureSeeded();
    let rows = await db.select().from(withdrawalsTable);
    if (filter?.user_id) rows = rows.filter((w) => w.user_id === filter.user_id);
    if (filter?.status) rows = rows.filter((w) => w.status === filter.status);
    return rows.sort((a, b) => (a.requested_at < b.requested_at ? 1 : -1));
  },

  async byId(id: string): Promise<Withdrawal | null> {
    await ensureSeeded();
    const [row] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id)).limit(1);
    return row ?? null;
  },

  async preview(user_id: string, gross_cents: number): Promise<{
    breakup: {
      gross_cents: number;
      tds_cents: number;
      gst_cents: number;
      net_cents: number;
      tds_reason: string;
      gst_reason: string;
    };
    suggested_method: "upi" | "bank" | null;
    method_reason: string;
    kyc_status: Profile["kyc_status"];
    has_pan: boolean;
    has_gstin: boolean;
    upi_limit_paise: number;
  } | null> {
    await ensureSeeded();
    const p = await profiles.byId(user_id);
    if (!p) return null;

    const fy_before = await withdrawals.fyEarnedBeforeForUser(user_id);
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

  async fyEarnedBeforeForUser(userId: string): Promise<number> {
    await ensureSeeded();
    const fyStart = currentFyStartIso();
    const ws = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.user_id, userId));
    return ws
      .filter((w) => (w.status === "approved" || w.status === "paid") && w.requested_at >= fyStart)
      .reduce((a, w) => a + w.gross_cents, 0);
  },

  async request(user_id: string, gross_cents: number, method: "upi" | "bank"): Promise<
    | { ok: true; withdrawal: Withdrawal }
    | { ok: false; error: string }
  > {
    await ensureSeeded();
    const p = await profiles.byId(user_id);
    if (!p) return { ok: false, error: "Profile not found" };

    if (gross_cents < 50_000) return { ok: false, error: "Minimum withdrawal is ₹500" };

    const bal = await transactions.balanceCents(user_id);
    if (gross_cents > bal) {
      return { ok: false, error: `Insufficient balance (₹${(bal / 100).toLocaleString("en-IN")} available)` };
    }

    if (p.kyc_status !== "verified") {
      return { ok: false, error: "Complete KYC (PAN verification) before withdrawing" };
    }

    let destination = "";
    if (method === "upi") {
      if (!p.upi_id) return { ok: false, error: "Add a UPI ID in Settings" };
      if (gross_cents > UPI_LIMIT_PAISE) {
        return { ok: false, error: "UPI limit is ₹1,00,000 per transaction — choose bank transfer" };
      }
      destination = p.upi_id;
    } else {
      if (!p.bank_account_number || !p.bank_ifsc) {
        return { ok: false, error: "Add bank account + IFSC in Settings" };
      }
      destination = `${p.bank_ifsc.slice(0, 4)} ••••${p.bank_account_number.slice(-4)}`;
    }

    const fy_before = await withdrawals.fyEarnedBeforeForUser(user_id);
    const breakup = computeWithdrawalTax({
      gross_cents,
      fy_earned_before_cents: fy_before,
      has_pan: !!p.pan_number,
      has_gstin: !!p.gstin,
    });

    let invoice_number: string | null = null;
    if (p.gstin) {
      const rows = await db
        .select({ id: withdrawalsTable.id })
        .from(withdrawalsTable)
        .where(sql`${withdrawalsTable.invoice_number} is not null`);
      invoice_number = nextInvoiceNumber(rows.length);
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

    await db.insert(withdrawalsTable).values(w);

    await transactions.create(user_id, {
      kind: "withdrawal",
      status: "pending",
      amount_cents: -gross_cents,
      description: `Withdrawal via ${method.toUpperCase()} to ${destination}`,
      reference_id: w.id,
    });

    await writeAudit(user_id, "request_withdrawal", "withdrawal", w.id, {
      method,
      gross_cents,
      destination,
    });

    return { ok: true, withdrawal: w };
  },

  async decide(
    id: string,
    status: Withdrawal["status"],
    admin_id: string,
    note?: string,
    utr?: string,
  ): Promise<Withdrawal | null> {
    await ensureSeeded();
    const current = await withdrawals.byId(id);
    if (!current) return null;

    let nextUtr = current.utr;
    let paid_at = current.paid_at;

    if (status === "paid") {
      paid_at = now();
      if (utr) nextUtr = utr;
      else if (!nextUtr) nextUtr = "UTR" + Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
    }

    const [updated] = await db
      .update(withdrawalsTable)
      .set({
        status,
        decided_at: now(),
        paid_at,
        utr: nextUtr,
        admin_note: note ?? current.admin_note,
      })
      .where(eq(withdrawalsTable.id, id))
      .returning();

    if (!updated) return null;

    const txRows = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.reference_id, id), eq(transactionsTable.kind, "withdrawal")));

    if (txRows.length > 0) {
      const txStatus = status === "paid" ? "completed" : status === "rejected" ? "failed" : txRows[0].status;
      await db.update(transactionsTable).set({ status: txStatus }).where(eq(transactionsTable.id, txRows[0].id));
    }

    if (status === "paid") {
      const formatted = "₹" + (updated.net_cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
      await notifications.push(updated.user_id, {
        kind: "withdrawal_paid",
        title: "Withdrawal paid",
        body: `${formatted} sent via ${updated.method.toUpperCase()} to ${updated.destination}. UTR: ${updated.utr}`,
        link: "/earnings",
      });
    }

    await writeAudit(admin_id, `${status}_withdrawal`, "withdrawal", id, { note, utr: updated.utr });
    return updated;
  },
};

export const eligibility = {
  async check(user_id: string, campaign_id: string): Promise<{ eligible: boolean; reasons: string[] }> {
    await ensureSeeded();
    const p = await profiles.byId(user_id);
    const c = await campaigns.byId(campaign_id);
    if (!p || !c) return { eligible: false, reasons: ["Not found"] };

    const rows = await db
      .select({ id: socialAccountsTable.id })
      .from(socialAccountsTable)
      .where(
        and(
          eq(socialAccountsTable.user_id, user_id),
          eq(socialAccountsTable.verified, true),
          eq(socialAccountsTable.connected, true),
        ),
      );

    const verifiedHandle = rows.length > 0;

    return checkCampaignEligibility(
      {
        niches: p.niches,
        total_reach: p.total_reach,
        tier: p.tier,
        avg_engagement: p.avg_engagement,
        city: p.city,
        languages: p.languages,
        kyc_status: p.kyc_status,
        verified_handle: verifiedHandle,
      },
      {
        required_niches: c.required_niches,
        min_followers: c.min_followers,
        max_followers: c.max_followers,
        allowed_tiers: c.allowed_tiers,
        preferred_cities: c.preferred_cities,
        preferred_languages: c.preferred_languages,
        min_engagement_rate: c.min_engagement_rate,
        requires_kyc: c.requires_kyc,
        base_earning_cents: c.base_earning_cents,
      },
    );
  },
};

export const community = {
  async list(filter?: { kind?: CommunityItem["kind"]; city?: string; published?: boolean }): Promise<CommunityItem[]> {
    await ensureSeeded();
    let rows = await db.select().from(communityTable);
    if (filter?.kind) rows = rows.filter((c) => c.kind === filter.kind);
    if (filter?.city && filter.city !== "All Cities") rows = rows.filter((c) => c.city === filter.city);
    if (filter?.published !== undefined) rows = rows.filter((c) => c.published === filter.published);
    return rows;
  },

  async byId(id: string): Promise<CommunityItem | null> {
    await ensureSeeded();
    const [row] = await db.select().from(communityTable).where(eq(communityTable.id, id)).limit(1);
    return row ?? null;
  },

  async create(data: Omit<CommunityItem, "id" | "created_at" | "registered">): Promise<CommunityItem> {
    await ensureSeeded();
    const row: CommunityItem = { ...data, id: newId(), registered: 0, created_at: now() };
    await db.insert(communityTable).values(row);
    await writeAudit("system", "create_community", "community", row.id, row);
    return row;
  },

  async update(id: string, patch: Partial<CommunityItem>): Promise<CommunityItem | null> {
    await ensureSeeded();
    const [row] = await db.update(communityTable).set(patch).where(eq(communityTable.id, id)).returning();
    if (!row) return null;
    await writeAudit("system", "update_community", "community", id, patch);
    return row;
  },

  async remove(id: string): Promise<void> {
    await ensureSeeded();
    await db.delete(communityTable).where(eq(communityTable.id, id));
    await writeAudit("system", "delete_community", "community", id, { removed: true });
  },

  async register(id: string): Promise<CommunityItem | null> {
    await ensureSeeded();
    const current = await community.byId(id);
    if (!current) return null;
    const [row] = await db
      .update(communityTable)
      .set({ registered: current.registered + 1 })
      .where(eq(communityTable.id, id))
      .returning();
    if (!row) return null;
    await writeAudit("system", "register_community", "community", id, { registered: row.registered });
    return row;
  },
};

export const notifications = {
  async forUser(userId: string): Promise<Notification[]> {
    await ensureSeeded();
    const rows = await db.select().from(notificationsTable).where(eq(notificationsTable.user_id, userId));
    return sortDescBy(rows);
  },

  async push(
    user_id: string,
    data: Omit<Notification, "id" | "user_id" | "created_at" | "read">,
  ): Promise<Notification> {
    await ensureSeeded();
    const row: Notification = { id: newId(), user_id, created_at: now(), read: false, ...data };
    await db.insert(notificationsTable).values(row);
    await writeAudit(user_id, "push_notification", "notification", row.id, row);
    return row;
  },

  async markRead(id: string): Promise<Notification | undefined> {
    await ensureSeeded();
    const [row] = await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.id, id)).returning();
    if (!row) return undefined;
    await writeAudit(row.user_id, "mark_notification_read", "notification", id, { read: true });
    return row;
  },

  async markAllRead(user_id: string): Promise<void> {
    await ensureSeeded();
    await db.update(notificationsTable).set({ read: true }).where(eq(notificationsTable.user_id, user_id));
    await writeAudit(user_id, "mark_all_notifications_read", "notification", user_id, { read_all: true });
  },
};

export const audit = {
  async list(): Promise<AuditLog[]> {
    await ensureSeeded();
    const rows = await db.select().from(auditLogTable);
    return rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  async log(
    admin_id: string,
    action: string,
    entity_kind: string,
    entity_id: string,
    details?: unknown,
  ): Promise<AuditLog> {
    await ensureSeeded();
    return writeAudit(admin_id, action, entity_kind, entity_id, details);
  },
};

export const analytics = {
  async summary(): Promise<{
    activeCampaigns: number;
    creators: number;
    verifiedCreators: number;
    gmvCents: number;
    pendingPayouts: number;
    pendingPayoutCents: number;
    pendingApplications: number;
    pendingDeliverables: number;
    daily: { date: string; cents: number }[];
  }> {
    await ensureSeeded();

    const [campaignRows, profileRows, transactionRows, withdrawalRows, applicationRows, deliverableRows] = await Promise.all([
      db.select().from(campaignsTable),
      db.select().from(profilesTable),
      db.select().from(transactionsTable),
      db.select().from(withdrawalsTable),
      db.select().from(applicationsTable),
      db.select().from(deliverablesTable),
    ]);

    const activeCampaigns = campaignRows.filter((c) => c.status === "open").length;
    const creators = profileRows.filter((p) => p.role === "creator").length;
    const verifiedCreators = profileRows.filter((p) => p.role === "creator" && p.verified_pro).length;

    const gmvCents = transactionRows
      .filter((t) => t.kind === "earning" && t.status === "completed")
      .reduce((a, t) => a + t.amount_cents, 0);

    const pendingPayouts = withdrawalRows.filter((w) => w.status === "requested").length;
    const pendingPayoutCents = withdrawalRows
      .filter((w) => w.status === "requested")
      .reduce((a, w) => a + w.amount_cents, 0);

    const pendingApplications = applicationRows.filter((a) => a.status === "pending").length;
    const pendingDeliverables = deliverableRows.filter((d) => d.status === "submitted").length;

    const daily: { date: string; cents: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cents = transactionRows
        .filter((t) => t.kind === "earning" && t.status === "completed" && t.created_at.slice(0, 10) === key)
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
