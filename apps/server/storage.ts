import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import type {
  Application,
  AuditLog,
  Brand,
  BrandTeamRole,
  Campaign,
  CommunityItem,
  CreatorTier,
  Deliverable,
  Invoice,
  Message,
  MessageThread,
  Notification,
  PushPlatform,
  Profile,
  SocialPlatform,
  SocialAccount,
  Transaction,
  WalletTransaction,
  Withdrawal,
} from "@creatorx/schema";
import {
  UPI_LIMIT_PAISE,
  applications as applicationsTable,
  audit_log as auditLogTable,
  brands as brandsTable,
  brand_team_members as brandTeamMembersTable,
  campaigns as campaignsTable,
  checkCampaignEligibility,
  community as communityTable,
  computeTier,
  computeWithdrawalTax,
  db,
  deliverables as deliverablesTable,
  invoices as invoicesTable,
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
  wallet_transactions as walletTransactionsTable,
  withdrawals as withdrawalsTable,
} from "@creatorx/schema";
import { seed } from "./seed";
import { getAuditContext } from "./middleware/impersonate";

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
  const context = getAuditContext();
  const actorId = context.actorUserId ?? actorUserId ?? "system";
  const diff_json = toDiffJson(diff);
  const details = diff_json ? JSON.stringify(diff_json) : null;

  const row = {
    id: newId(),
    actor_user_id: actorId,
    acting_as_brand_id: context.actingAsBrandId,
    admin_id: actorId,
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
  getBrandCampaigns(userId: string, status?: Campaign["status"]): Promise<Array<Campaign & { applicant_count: number }>>;
  getCampaign(userId: string, campaignId: string): Promise<Campaign | null>;
  getCampaignStats(userId: string, campaignId: string): Promise<{
    totalApplications: number;
    pendingReview: number;
    approved: number;
    rejected: number;
  } | null>;
  updateCampaignStatus(userId: string, campaignId: string, status: Campaign["status"]): Promise<Campaign | null>;
  getCampaignApplications(
    userId: string,
    campaignId: string,
    status?: "pending" | "approved" | "rejected",
  ): Promise<Array<{
    id: string;
    campaign_id: string;
    creator_id: string;
    pitch: string;
    status: "pending" | "approved" | "rejected";
    applied_at: string;
    decided_at: string | null;
    decided_by: string | null;
    display_name: string;
    handle: string;
    avatar_url: string | null;
    follower_count: number;
    niches: string[];
  }>>;
  updateApplicationStatus(
    userId: string,
    applicationId: string,
    status: "approved" | "rejected",
  ): Promise<Application | null>;
  getCampaignDeliverables(
    userId: string,
    campaignId: string,
    status?: "pending" | "approved" | "rejected",
  ): Promise<Array<{
    id: string;
    application_id: string;
    campaign_id: string;
    creator_id: string;
    deliverable_type: string;
    status: "pending" | "approved" | "rejected";
    submitted_at: string | null;
    content_url: string | null;
    rejection_reason: string | null;
    display_name: string;
    avatar_url: string | null;
  }>>;
  updateDeliverableStatus(
    userId: string,
    deliverableId: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
  ): Promise<Deliverable | null>;
  createWalletTransaction(data: {
    brand_id: string;
    type: "credit" | "debit";
    amount_paise: number;
    description: string;
    razorpay_order_id?: string | null;
    razorpay_payment_id?: string | null;
    status: "pending" | "completed" | "failed";
  }): Promise<WalletTransaction>;
  updateWalletTransaction(
    id: string,
    patch: Partial<Pick<WalletTransaction, "status" | "razorpay_payment_id" | "description">>,
  ): Promise<WalletTransaction | null>;
  creditWalletBalance(brandId: string, amountPaise: number): Promise<Brand | null>;
  debitWalletBalance(brandId: string, amountPaise: number, description: string): Promise<Brand>;
  createInvoice(data: {
    brand_id: string;
    invoice_number: string;
    amount_paise: number;
    gst_paise: number;
    total_paise: number;
    pdf_url?: string | null;
    issued_at: string;
  }): Promise<Invoice>;
  getWalletSummary(brandId: string): Promise<{ balancePaise: number; transactions: WalletTransaction[] }>;
  getBrandInvoices(brandId: string): Promise<Invoice[]>;
  searchCreators(params: {
    search?: string;
    niches?: string[];
    platforms?: SocialPlatform[];
    minFollowers?: number;
    maxFollowers?: number;
    cursor?: string;
    limit?: number;
  }): Promise<{
    creators: Array<{
      id: string;
      display_name: string;
      handle: string;
      bio: string | null;
      avatar_url: string | null;
      follower_count: number;
      niches: string[];
      platforms: SocialPlatform[];
      profile_complete: boolean;
    }>;
    nextCursor: string | null;
  }>;
  getCreatorProfile(creatorId: string): Promise<{
    id: string;
    display_name: string;
    handle: string;
    bio: string | null;
    avatar_url: string | null;
    follower_count: number;
    following_count: number;
    avg_engagement_rate: number;
    niches: string[];
    languages: string[];
    platforms: Array<{ platform: SocialPlatform; handle: string; url: string | null }>;
    profile_complete: boolean;
  } | null>;
  getCreatorStats(creatorId: string): Promise<{
    campaignsCompleted: number;
    averageRating: number;
    totalEarningsPaise: number;
  }>;
  getCreatorPortfolio(creatorId: string): Promise<Array<{
    deliverableId: string;
    campaignTitle: string;
    deliverableType: string;
    contentUrl: string;
    approvedAt: string;
  }>>;
  inviteCreatorToCampaign(brandId: string, campaignId: string, creatorId: string): Promise<Application>;
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
  getBrandThreads(brandId: string): Promise<Array<{
    id: string;
    campaign_id: string | null;
    brand_id: string;
    creator_id: string;
    created_at: string;
    updated_at: string;
    last_message_preview: string;
    last_message_at: string;
    unread_count: number;
    creator: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
    campaign: {
      id: string;
      title: string;
    } | null;
  }>>;
  getThreadMessages(
    brandId: string,
    threadId: string,
  ): Promise<{
    thread: {
      id: string;
      campaign_id: string | null;
      brand_id: string;
      creator_id: string;
      created_at: string;
      updated_at: string;
      creator: {
        id: string;
        display_name: string;
        avatar_url: string | null;
      } | null;
      campaign: {
        id: string;
        title: string;
      } | null;
    };
    messages: Message[];
  } | null>;
  createMessage(
    brandId: string,
    threadId: string,
    body: string,
  ): Promise<Message | null>;
  createOrGetThread(
    brandId: string,
    creatorId: string,
    campaignId: string | null,
    body: string,
  ): Promise<{ threadId: string }>;
  getBrandTeam(brandId: string): Promise<Array<{
    id: string;
    brand_id: string;
    user_id: string;
    role: BrandTeamRole;
    invited_by: string;
    invited_at: string;
    accepted_at: string | null;
    created_at: string;
    user: {
      id: string;
      full_name: string;
      email: string;
      avatar_url: string | null;
    } | null;
  }>>;
  inviteTeamMember(brandId: string, invitedBy: string, email: string, role: BrandTeamRole): Promise<{
    id: string;
    brand_id: string;
    user_id: string;
    role: BrandTeamRole;
    invited_by: string;
    invited_at: string;
    accepted_at: string | null;
    created_at: string;
  }>;
  removeTeamMember(brandId: string, requesterId: string, userId: string): Promise<void>;
  updateNotificationPreferences(
    brandId: string,
    preferences: Record<string, boolean>,
  ): Promise<Record<string, boolean>>;
  getAllBrands(): Promise<Brand[]>;
  updateBrandStatus(brandId: string, status: "approved" | "rejected", reason?: string, actorUserId?: string): Promise<Brand | null>;
  getAllCampaigns(status?: string): Promise<Array<Campaign & { brand: Brand | null; brand_name: string | null }>>;
  adminUpdateCampaignStatus(
    campaignId: string,
    status: "active" | "rejected" | "paused" | "completed",
    actorUserId: string,
  ): Promise<Campaign | null>;
  getAllApplications(): Promise<Array<Application & {
    creator: Profile | null;
    campaign: Campaign | null;
    brand: Brand | null;
  }>>;
  adminUpdateApplicationStatus(
    applicationId: string,
    status: "approved" | "rejected",
    actorUserId: string,
  ): Promise<Application | null>;
  getAllDeliverables(): Promise<Array<Deliverable & {
    creator: Profile | null;
    campaign: Campaign | null;
    brand: Brand | null;
  }>>;
  adminUpdateDeliverableStatus(
    deliverableId: string,
    status: "approved" | "rejected",
    rejectionReason: string | undefined,
    actorUserId: string,
  ): Promise<Deliverable | null>;
  getAdminDashboardStats(): Promise<{
    totalBrands: number;
    activeCampaigns: number;
    totalCreators: number;
    platformRevenuePaise: number;
    campaignSignups30d: Array<{ date: string; count: number }>;
    revenue30d: Array<{ date: string; amountPaise: number }>;
  }>;
  getAuditLog(params: {
    actor?: string;
    action?: string;
    targetType?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ rows: AuditLog[]; nextCursor: string | null }>;
}

export async function resetDb(): Promise<void> {
  await db.execute(
    sql.raw(
      'TRUNCATE TABLE "wallet_transactions", "invoices", "push_tokens", "messages", "message_threads", "brand_team_members", "deliverables", "applications", "transactions", "withdrawals", "social_accounts", "community", "notifications", "campaigns", "brands", "audit_log", "profiles" CASCADE',
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
    status: "pending",
    website: null,
    industry: "",
    description: null,
    contact_email: profile?.email ?? null,
    wallet_balance_paise: 0,
    notification_preferences: {},
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

export async function getBrandThreads(brandId: string): Promise<Array<{
  id: string;
  campaign_id: string | null;
  brand_id: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
  creator: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  campaign: {
    id: string;
    title: string;
  } | null;
}>> {
  await ensureSeeded();

  const rows = await db
    .select()
    .from(messageThreadsTable)
    .where(eq(messageThreadsTable.brand_id, brandId));

  const sorted = rows.sort((a, b) => {
    const aTime = a.updated_at || a.last_message_at;
    const bTime = b.updated_at || b.last_message_at;
    return aTime < bTime ? 1 : -1;
  });

  return Promise.all(
    sorted.map(async (thread) => {
      const [creator, campaign, unreadForBrand] = await Promise.all([
        profiles.byId(thread.creator_id),
        thread.campaign_id ? campaigns.byId(thread.campaign_id) : Promise.resolve(null),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.thread_id, thread.id),
              eq(messagesTable.sender_role, "creator"),
              isNull(messagesTable.read_at),
            ),
          ),
      ]);

      return {
        id: thread.id,
        campaign_id: thread.campaign_id,
        brand_id: thread.brand_id,
        creator_id: thread.creator_id,
        created_at: thread.created_at || thread.last_message_at,
        updated_at: thread.updated_at || thread.last_message_at,
        last_message_preview: thread.last_message_preview,
        last_message_at: thread.last_message_at,
        unread_count: unreadForBrand[0]?.count ?? 0,
        creator: creator
          ? {
              id: creator.id,
              display_name: creator.full_name,
              avatar_url: creator.avatar_url,
            }
          : null,
        campaign: campaign
          ? {
              id: campaign.id,
              title: campaign.title,
            }
          : null,
      };
    }),
  );
}

export async function getThreadMessages(
  brandId: string,
  threadId: string,
): Promise<{
  thread: {
    id: string;
    campaign_id: string | null;
    brand_id: string;
    creator_id: string;
    created_at: string;
    updated_at: string;
    creator: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
    campaign: {
      id: string;
      title: string;
    } | null;
  };
  messages: Message[];
} | null> {
  await ensureSeeded();

  const [thread] = await db
    .select()
    .from(messageThreadsTable)
    .where(eq(messageThreadsTable.id, threadId))
    .limit(1);

  if (!thread) return null;
  if (thread.brand_id !== brandId) {
    throw new Error("FORBIDDEN");
  }

  const readAt = now();
  await db
    .update(messagesTable)
    .set({ read_at: readAt })
    .where(
      and(
        eq(messagesTable.thread_id, threadId),
        eq(messagesTable.sender_role, "creator"),
        isNull(messagesTable.read_at),
      ),
    );

  const [creator, campaign, messageRows] = await Promise.all([
    profiles.byId(thread.creator_id),
    thread.campaign_id ? campaigns.byId(thread.campaign_id) : Promise.resolve(null),
    db.select().from(messagesTable).where(eq(messagesTable.thread_id, threadId)),
  ]);

  return {
    thread: {
      id: thread.id,
      campaign_id: thread.campaign_id,
      brand_id: thread.brand_id,
      creator_id: thread.creator_id,
      created_at: thread.created_at || thread.last_message_at,
      updated_at: thread.updated_at || thread.last_message_at,
      creator: creator
        ? {
            id: creator.id,
            display_name: creator.full_name,
            avatar_url: creator.avatar_url,
          }
        : null,
      campaign: campaign
        ? {
            id: campaign.id,
            title: campaign.title,
          }
        : null,
    },
    messages: sortAscBy(messageRows),
  };
}

export async function createMessage(
  brandId: string,
  threadId: string,
  body: string,
): Promise<Message | null> {
  await ensureSeeded();

  const [thread] = await db
    .select()
    .from(messageThreadsTable)
    .where(eq(messageThreadsTable.id, threadId))
    .limit(1);
  if (!thread) return null;
  if (thread.brand_id !== brandId) {
    throw new Error("FORBIDDEN");
  }

  const createdAt = now();
  const msg: Message = {
    id: newId(),
    thread_id: threadId,
    sender_id: `brand:${brandId}`,
    sender_role: "brand",
    body,
    attachment_url: null,
    attachment_kind: null,
    attachment_name: null,
    attachment_size: null,
    read: false,
    read_at: null,
    created_at: createdAt,
  };

  await db.insert(messagesTable).values(msg);
  await db
    .update(messageThreadsTable)
    .set({
      last_message_preview: body.slice(0, 120),
      last_message_at: createdAt,
      updated_at: createdAt,
      unread_count: thread.unread_count + 1,
    })
    .where(eq(messageThreadsTable.id, threadId));

  await writeAudit(brandId, "brand_send_message", "message", msg.id, {
    thread_id: threadId,
  });

  return msg;
}

export async function createOrGetThread(
  brandId: string,
  creatorId: string,
  campaignId: string | null,
  body: string,
): Promise<{ threadId: string }> {
  await ensureSeeded();

  const creator = await profiles.byId(creatorId);
  if (!creator || creator.role !== "creator") {
    throw new Error("CREATOR_NOT_FOUND");
  }

  if (campaignId) {
    const campaign = await campaigns.byId(campaignId);
    if (!campaign) {
      throw new Error("CAMPAIGN_NOT_FOUND");
    }
    if (campaign.brand_id !== brandId) {
      throw new Error("FORBIDDEN");
    }
  }

  const existing = await db
    .select()
    .from(messageThreadsTable)
    .where(
      and(
        eq(messageThreadsTable.brand_id, brandId),
        eq(messageThreadsTable.creator_id, creatorId),
        campaignId
          ? eq(messageThreadsTable.campaign_id, campaignId)
          : isNull(messageThreadsTable.campaign_id),
      ),
    )
    .limit(1);

  const createdAt = now();
  let threadId = existing[0]?.id ?? "";
  let unreadCount = existing[0]?.unread_count ?? 0;

  if (!existing[0]) {
    threadId = newId();
    const thread: MessageThread = {
      id: threadId,
      creator_id: creatorId,
      brand_id: brandId,
      campaign_id: campaignId,
      last_message_preview: body.slice(0, 120),
      last_message_at: createdAt,
      unread_count: 1,
      brand_online: true,
      status_label: campaignId ? "CAMPAIGN ACTIVE" : null,
      created_at: createdAt,
      updated_at: createdAt,
    };
    await db.insert(messageThreadsTable).values(thread);
    unreadCount = 1;
    await writeAudit(brandId, "brand_create_thread", "thread", threadId, {
      creator_id: creatorId,
      campaign_id: campaignId,
    });
  }

  const msg: Message = {
    id: newId(),
    thread_id: threadId,
    sender_id: `brand:${brandId}`,
    sender_role: "brand",
    body,
    attachment_url: null,
    attachment_kind: null,
    attachment_name: null,
    attachment_size: null,
    read: false,
    read_at: null,
    created_at: createdAt,
  };
  await db.insert(messagesTable).values(msg);

  await db
    .update(messageThreadsTable)
    .set({
      last_message_preview: body.slice(0, 120),
      last_message_at: createdAt,
      updated_at: createdAt,
      unread_count: existing[0] ? unreadCount + 1 : unreadCount,
    })
    .where(eq(messageThreadsTable.id, threadId));

  await writeAudit(brandId, "brand_send_message", "message", msg.id, {
    thread_id: threadId,
  });

  return { threadId };
}

export async function getBrandTeam(brandId: string): Promise<Array<{
  id: string;
  brand_id: string;
  user_id: string;
  role: BrandTeamRole;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}>> {
  await ensureSeeded();

  const rows = await db
    .select()
    .from(brandTeamMembersTable)
    .where(eq(brandTeamMembersTable.brand_id, brandId));

  const sorted = rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return Promise.all(
    sorted.map(async (member) => {
      const user = await profiles.byId(member.user_id);
      return {
        ...member,
        user: user
          ? {
              id: user.id,
              full_name: user.full_name,
              email: user.email,
              avatar_url: user.avatar_url,
            }
          : null,
      };
    }),
  );
}

export async function inviteTeamMember(
  brandId: string,
  invitedBy: string,
  email: string,
  role: BrandTeamRole,
): Promise<{
  id: string;
  brand_id: string;
  user_id: string;
  role: BrandTeamRole;
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
}> {
  await ensureSeeded();
  await getBrandProfile(brandId);

  const normalizedEmail = email.trim().toLowerCase();
  let user = await profiles.byEmail(normalizedEmail);
  if (!user) {
    const localPart = normalizedEmail.split("@")[0] || "brand-member";
    const safeLocal = localPart.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "brand-member";
    const handle = `${safeLocal}-${newId().slice(0, 6)}`;
    user = await profiles.create({
      email: normalizedEmail,
      full_name: localPart,
      handle,
      role: "brand",
    });
  }

  const [existing] = await db
    .select()
    .from(brandTeamMembersTable)
    .where(
      and(
        eq(brandTeamMembersTable.brand_id, brandId),
        eq(brandTeamMembersTable.user_id, user.id),
      ),
    )
    .limit(1);
  if (existing) {
    return existing;
  }

  const createdAt = now();
  const row = {
    id: newId(),
    brand_id: brandId,
    user_id: user.id,
    role,
    invited_by: invitedBy,
    invited_at: createdAt,
    accepted_at: null,
    created_at: createdAt,
  };

  await db.insert(brandTeamMembersTable).values(row);
  await writeAudit(invitedBy, "invite_brand_team_member", "brand_team_member", row.id, {
    brand_id: brandId,
    user_id: user.id,
    email: normalizedEmail,
    role,
  });
  console.log(`[team] Invite sent to ${normalizedEmail} for brand ${brandId} as ${role}`);
  return row;
}

export async function removeTeamMember(
  brandId: string,
  requesterId: string,
  userId: string,
): Promise<void> {
  await ensureSeeded();
  if (requesterId === userId) {
    throw new Error("SELF_REMOVE_NOT_ALLOWED");
  }

  await db
    .delete(brandTeamMembersTable)
    .where(
      and(
        eq(brandTeamMembersTable.brand_id, brandId),
        eq(brandTeamMembersTable.user_id, userId),
      ),
    );

  await writeAudit(requesterId, "remove_brand_team_member", "brand_team_member", userId, {
    brand_id: brandId,
    user_id: userId,
  });
}

export async function updateNotificationPreferences(
  brandId: string,
  preferences: Record<string, boolean>,
): Promise<Record<string, boolean>> {
  await ensureSeeded();
  const current = await getBrandProfile(brandId);
  const merged = {
    ...(current.notification_preferences ?? {}),
    ...preferences,
  };

  await db
    .update(brandsTable)
    .set({ notification_preferences: merged })
    .where(eq(brandsTable.id, brandId));

  await writeAudit(brandId, "update_brand_notification_preferences", "brand", brandId, {
    preferences: merged,
  });

  return merged;
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

export async function getBrandCampaigns(
  userId: string,
  status?: Campaign["status"],
): Promise<Array<Campaign & { applicant_count: number }>> {
  await ensureSeeded();

  let rows = await db.select().from(campaignsTable).where(eq(campaignsTable.brand_id, userId));
  if (status) {
    rows = rows.filter((campaign) => campaign.status === status);
  }

  const campaigns = sortDescBy(rows);
  if (campaigns.length === 0) return [];

  const campaignIds = campaigns.map((campaign) => campaign.id);
  const applicationRows = await db
    .select({ campaign_id: applicationsTable.campaign_id })
    .from(applicationsTable)
    .where(inArray(applicationsTable.campaign_id, campaignIds));

  const counts = new Map<string, number>();
  for (const row of applicationRows) {
    counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
  }

  return campaigns.map((campaign) => ({
    ...campaign,
    applicant_count: counts.get(campaign.id) ?? 0,
  }));
}

export async function getCampaign(userId: string, campaignId: string): Promise<Campaign | null> {
  await ensureSeeded();
  const [row] = await db
    .select()
    .from(campaignsTable)
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.brand_id, userId)))
    .limit(1);
  return row ?? null;
}

export async function getCampaignStats(
  userId: string,
  campaignId: string,
): Promise<{
  totalApplications: number;
  pendingReview: number;
  approved: number;
  rejected: number;
} | null> {
  await ensureSeeded();

  const campaign = await getCampaign(userId, campaignId);
  if (!campaign) return null;

  const rows = await db
    .select({ status: applicationsTable.status })
    .from(applicationsTable)
    .where(eq(applicationsTable.campaign_id, campaignId));

  const totalApplications = rows.length;
  const pendingReview = rows.filter((application) => application.status === "pending").length;
  const approved = rows.filter((application) => application.status === "accepted").length;
  const rejected = rows.filter((application) => application.status === "rejected").length;

  return {
    totalApplications,
    pendingReview,
    approved,
    rejected,
  };
}

export async function updateCampaignStatus(
  userId: string,
  campaignId: string,
  status: Campaign["status"],
): Promise<Campaign | null> {
  await ensureSeeded();
  const current = await getCampaign(userId, campaignId);
  if (!current) return null;

  const [updated] = await db
    .update(campaignsTable)
    .set({ status })
    .where(and(eq(campaignsTable.id, campaignId), eq(campaignsTable.brand_id, userId)))
    .returning();

  if (!updated) return null;

  await writeAudit(userId, "update_brand_campaign_status", "campaign", campaignId, {
    from: current.status,
    to: status,
  });

  return updated;
}

function mapApplicationStatusForBrand(status: Application["status"]): "pending" | "approved" | "rejected" | null {
  if (status === "pending") return "pending";
  if (status === "invited") return "pending";
  if (status === "accepted") return "approved";
  if (status === "rejected" || status === "withdrawn") return "rejected";
  return null;
}

function mapDeliverableStatusForBrand(status: Deliverable["status"]): "pending" | "approved" | "rejected" | null {
  if (status === "pending" || status === "submitted") return "pending";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return null;
}

export async function getCampaignApplications(
  userId: string,
  campaignId: string,
  status?: "pending" | "approved" | "rejected",
): Promise<Array<{
  id: string;
  campaign_id: string;
  creator_id: string;
  pitch: string;
  status: "pending" | "approved" | "rejected";
  applied_at: string;
  decided_at: string | null;
  decided_by: string | null;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  follower_count: number;
  niches: string[];
}>> {
  await ensureSeeded();
  const campaign = await getCampaign(userId, campaignId);
  if (!campaign) return [];

  const rows = await db
    .select()
    .from(applicationsTable)
    .where(eq(applicationsTable.campaign_id, campaignId));

  const enriched = await Promise.all(
    rows.map(async (application) => {
      const mappedStatus = mapApplicationStatusForBrand(application.status);
      if (!mappedStatus) return null;

      const creator = await profiles.byId(application.creator_id);
      return {
        ...application,
        status: mappedStatus,
        display_name: creator?.full_name || creator?.handle || "Creator",
        handle: creator?.handle || "creator",
        avatar_url: creator?.avatar_url ?? null,
        follower_count: creator?.total_reach ?? 0,
        niches: creator?.niches ?? [],
      };
    }),
  );

  let filtered = enriched.filter((row): row is NonNullable<typeof row> => row !== null);
  if (status) {
    filtered = filtered.filter((row) => row.status === status);
  }

  return filtered.sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1));
}

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  status: "approved" | "rejected",
): Promise<Application | null> {
  await ensureSeeded();
  const decision: "accepted" | "rejected" = status === "approved" ? "accepted" : "rejected";
  return applications.decide(applicationId, decision, userId);
}

export async function getCampaignDeliverables(
  userId: string,
  campaignId: string,
  status?: "pending" | "approved" | "rejected",
): Promise<Array<{
  id: string;
  application_id: string;
  campaign_id: string;
  creator_id: string;
  deliverable_type: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string | null;
  content_url: string | null;
  rejection_reason: string | null;
  display_name: string;
  avatar_url: string | null;
}>> {
  await ensureSeeded();
  const campaign = await getCampaign(userId, campaignId);
  if (!campaign) return [];

  const rows = await db
    .select()
    .from(deliverablesTable)
    .where(eq(deliverablesTable.campaign_id, campaignId));

  const enriched = await Promise.all(
    rows.map(async (deliverable) => {
      const mappedStatus = mapDeliverableStatusForBrand(deliverable.status);
      if (!mappedStatus) return null;

      const creator = await profiles.byId(deliverable.creator_id);
      return {
        id: deliverable.id,
        application_id: deliverable.application_id,
        campaign_id: deliverable.campaign_id,
        creator_id: deliverable.creator_id,
        deliverable_type: deliverable.kind,
        status: mappedStatus,
        submitted_at: deliverable.submitted_at,
        content_url: deliverable.asset_url ?? deliverable.live_url ?? null,
        rejection_reason: deliverable.feedback ?? null,
        display_name: creator?.full_name || creator?.handle || "Creator",
        avatar_url: creator?.avatar_url ?? null,
      };
    }),
  );

  let filtered = enriched.filter((row): row is NonNullable<typeof row> => row !== null);
  if (status) {
    filtered = filtered.filter((row) => row.status === status);
  }

  return filtered.sort((a, b) => {
    const aTime = a.submitted_at ?? "";
    const bTime = b.submitted_at ?? "";
    return aTime < bTime ? 1 : -1;
  });
}

export async function updateDeliverableStatus(
  userId: string,
  deliverableId: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
): Promise<Deliverable | null> {
  await ensureSeeded();
  return deliverables.decide(deliverableId, status, rejectionReason ?? "", userId);
}

export async function createWalletTransaction(data: {
  brand_id: string;
  type: "credit" | "debit";
  amount_paise: number;
  description: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  status: "pending" | "completed" | "failed";
}): Promise<WalletTransaction> {
  await ensureSeeded();
  const row: WalletTransaction = {
    id: newId(),
    brand_id: data.brand_id,
    type: data.type,
    amount_paise: data.amount_paise,
    description: data.description,
    razorpay_order_id: data.razorpay_order_id ?? null,
    razorpay_payment_id: data.razorpay_payment_id ?? null,
    status: data.status,
    created_at: now(),
  };
  await db.insert(walletTransactionsTable).values(row);
  return row;
}

export async function updateWalletTransaction(
  id: string,
  patch: Partial<Pick<WalletTransaction, "status" | "razorpay_payment_id" | "description">>,
): Promise<WalletTransaction | null> {
  await ensureSeeded();
  const [updated] = await db
    .update(walletTransactionsTable)
    .set(patch)
    .where(eq(walletTransactionsTable.id, id))
    .returning();
  return updated ?? null;
}

export async function creditWalletBalance(brandId: string, amountPaise: number): Promise<Brand | null> {
  await ensureSeeded();
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId)).limit(1);
  if (!brand) return null;
  const [updated] = await db
    .update(brandsTable)
    .set({ wallet_balance_paise: brand.wallet_balance_paise + amountPaise })
    .where(eq(brandsTable.id, brandId))
    .returning();
  if (updated) {
    await writeAudit(brandId, "credit_wallet_balance", "brand", brandId, {
      amount_paise: amountPaise,
      new_balance_paise: updated.wallet_balance_paise,
    });
  }
  return updated ?? null;
}

export async function debitWalletBalance(
  brandId: string,
  amountPaise: number,
  description: string,
): Promise<Brand> {
  await ensureSeeded();
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, brandId)).limit(1);
  if (!brand) {
    throw new Error("Brand not found");
  }
  const nextBalance = brand.wallet_balance_paise - amountPaise;
  if (nextBalance < 0) {
    throw new Error("Insufficient wallet balance");
  }

  const [updated] = await db
    .update(brandsTable)
    .set({ wallet_balance_paise: nextBalance })
    .where(eq(brandsTable.id, brandId))
    .returning();

  if (!updated) {
    throw new Error("Brand not found");
  }

  await createWalletTransaction({
    brand_id: brandId,
    type: "debit",
    amount_paise: amountPaise,
    description,
    status: "completed",
  });

  await writeAudit(brandId, "debit_wallet_balance", "brand", brandId, {
    amount_paise: amountPaise,
    new_balance_paise: updated.wallet_balance_paise,
    description,
  });

  return updated;
}

export async function createInvoice(data: {
  brand_id: string;
  invoice_number: string;
  amount_paise: number;
  gst_paise: number;
  total_paise: number;
  pdf_url?: string | null;
  issued_at: string;
}): Promise<Invoice> {
  await ensureSeeded();
  const row: Invoice = {
    id: newId(),
    brand_id: data.brand_id,
    invoice_number: data.invoice_number,
    amount_paise: data.amount_paise,
    gst_paise: data.gst_paise,
    total_paise: data.total_paise,
    pdf_url: data.pdf_url ?? null,
    issued_at: data.issued_at,
    created_at: now(),
  };
  await db.insert(invoicesTable).values(row);
  return row;
}

export async function getWalletSummary(brandId: string): Promise<{ balancePaise: number; transactions: WalletTransaction[] }> {
  await ensureSeeded();
  const [brand] = await db.select({ wallet_balance_paise: brandsTable.wallet_balance_paise }).from(brandsTable).where(eq(brandsTable.id, brandId)).limit(1);
  const rows = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.brand_id, brandId))
    .orderBy(desc(walletTransactionsTable.created_at))
    .limit(20);
  return {
    balancePaise: brand?.wallet_balance_paise ?? 0,
    transactions: rows,
  };
}

export async function getBrandInvoices(brandId: string): Promise<Invoice[]> {
  await ensureSeeded();
  return db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.brand_id, brandId))
    .orderBy(desc(invoicesTable.created_at));
}

function isCreatorProfileComplete(profile: Profile, socials: SocialAccount[]): boolean {
  const connectedPlatforms = socials.filter((social) => social.connected);
  return Boolean(
    profile.role === "creator" &&
      profile.full_name.trim() &&
      profile.handle.trim() &&
      profile.bio &&
      profile.bio.trim().length > 0 &&
      profile.avatar_url &&
      profile.niches.length > 0 &&
      profile.languages.length > 0 &&
      profile.total_reach > 0 &&
      connectedPlatforms.length > 0,
  );
}

function socialUrl(platform: SocialPlatform, handle: string): string | null {
  const cleanHandle = handle.replace(/^@+/, "");
  if (!cleanHandle) return null;
  if (platform === "instagram") return `https://instagram.com/${cleanHandle}`;
  if (platform === "youtube") return `https://youtube.com/@${cleanHandle}`;
  if (platform === "twitter") return `https://x.com/${cleanHandle}`;
  if (platform === "linkedin") return `https://linkedin.com/in/${cleanHandle}`;
  return null;
}

export async function searchCreators(params: {
  search?: string;
  niches?: string[];
  platforms?: SocialPlatform[];
  minFollowers?: number;
  maxFollowers?: number;
  cursor?: string;
  limit?: number;
}): Promise<{
  creators: Array<{
    id: string;
    display_name: string;
    handle: string;
    bio: string | null;
    avatar_url: string | null;
    follower_count: number;
    niches: string[];
    platforms: SocialPlatform[];
    profile_complete: boolean;
  }>;
  nextCursor: string | null;
}> {
  await ensureSeeded();
  const limit = params.limit ?? 20;
  const search = (params.search ?? "").trim().toLowerCase();

  const [allProfiles, allSocials] = await Promise.all([profiles.list(), db.select().from(socialAccountsTable)]);

  const socialsByUser = new Map<string, SocialAccount[]>();
  for (const social of allSocials) {
    const existing = socialsByUser.get(social.user_id) ?? [];
    existing.push(social);
    socialsByUser.set(social.user_id, existing);
  }

  let creators = allProfiles
    .filter((profile) => profile.role === "creator")
    .map((profile) => {
      const userSocials = socialsByUser.get(profile.id) ?? [];
      const connectedPlatforms = userSocials.filter((social) => social.connected).map((social) => social.platform);
      const profile_complete = isCreatorProfileComplete(profile, userSocials);
      return {
        id: profile.id,
        display_name: profile.full_name,
        handle: profile.handle,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        follower_count: profile.total_reach,
        niches: profile.niches,
        platforms: Array.from(new Set(connectedPlatforms)),
        profile_complete,
      };
    })
    .filter((creator) => creator.profile_complete);

  if (search) {
    creators = creators.filter((creator) => {
      const haystack = `${creator.display_name} ${creator.handle} ${creator.bio ?? ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (params.niches && params.niches.length > 0) {
    const wanted = new Set(params.niches.map((niche) => niche.toLowerCase()));
    creators = creators.filter((creator) => creator.niches.some((niche) => wanted.has(niche.toLowerCase())));
  }

  if (params.platforms && params.platforms.length > 0) {
    const wanted = new Set(params.platforms);
    creators = creators.filter((creator) => creator.platforms.some((platform) => wanted.has(platform)));
  }

  if (typeof params.minFollowers === "number") {
    creators = creators.filter((creator) => creator.follower_count >= params.minFollowers!);
  }
  if (typeof params.maxFollowers === "number") {
    creators = creators.filter((creator) => creator.follower_count <= params.maxFollowers!);
  }

  creators.sort((a, b) => {
    if (a.follower_count === b.follower_count) return a.id.localeCompare(b.id);
    return b.follower_count - a.follower_count;
  });

  let startIndex = 0;
  if (params.cursor) {
    const cursorIndex = creators.findIndex((creator) => creator.id === params.cursor);
    if (cursorIndex >= 0) startIndex = cursorIndex + 1;
  }

  const slice = creators.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < creators.length;
  const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;

  return {
    creators: slice,
    nextCursor,
  };
}

export async function getCreatorProfile(creatorId: string): Promise<{
  id: string;
  display_name: string;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
  avg_engagement_rate: number;
  niches: string[];
  languages: string[];
  platforms: Array<{ platform: SocialPlatform; handle: string; url: string | null }>;
  profile_complete: boolean;
} | null> {
  await ensureSeeded();
  const profile = await profiles.byId(creatorId);
  if (!profile || profile.role !== "creator") return null;

  const socials = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.user_id, creatorId));
  const profile_complete = isCreatorProfileComplete(profile, socials);
  if (!profile_complete) return null;

  const connectedPlatforms = socials
    .filter((social) => social.connected)
    .map((social) => ({
      platform: social.platform,
      handle: social.handle,
      url: socialUrl(social.platform, social.handle),
    }));

  return {
    id: profile.id,
    display_name: profile.full_name,
    handle: profile.handle,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    follower_count: profile.total_reach,
    following_count: 0,
    avg_engagement_rate: profile.avg_engagement,
    niches: profile.niches,
    languages: profile.languages,
    platforms: connectedPlatforms,
    profile_complete: true,
  };
}

export async function getCreatorStats(creatorId: string): Promise<{
  campaignsCompleted: number;
  averageRating: number;
  totalEarningsPaise: number;
}> {
  await ensureSeeded();
  const [creatorDeliverables, creatorTransactions] = await Promise.all([
    db.select().from(deliverablesTable).where(eq(deliverablesTable.creator_id, creatorId)),
    db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.user_id, creatorId),
          eq(transactionsTable.kind, "earning"),
          eq(transactionsTable.status, "completed"),
        ),
      ),
  ]);

  const completedCampaigns = new Set(
    creatorDeliverables
      .filter((deliverable) => deliverable.status === "approved" || deliverable.status === "live")
      .map((deliverable) => deliverable.campaign_id),
  );
  const approved = creatorDeliverables.filter((deliverable) => deliverable.status === "approved" || deliverable.status === "live").length;
  const rejected = creatorDeliverables.filter((deliverable) => deliverable.status === "rejected").length;
  const reviewed = approved + rejected;
  const averageRating =
    reviewed === 0 ? 0 : Math.max(0, Math.min(5, Number((5 - (rejected / reviewed) * 2).toFixed(1))));

  const totalEarningsPaise = creatorTransactions.reduce((sum, transaction) => sum + transaction.amount_cents, 0);

  return {
    campaignsCompleted: completedCampaigns.size,
    averageRating,
    totalEarningsPaise,
  };
}

export async function getCreatorPortfolio(creatorId: string): Promise<Array<{
  deliverableId: string;
  campaignTitle: string;
  deliverableType: string;
  contentUrl: string;
  approvedAt: string;
}>> {
  await ensureSeeded();
  const creatorDeliverables = await db
    .select()
    .from(deliverablesTable)
    .where(eq(deliverablesTable.creator_id, creatorId));

  const approvedRows = creatorDeliverables
    .filter(
      (deliverable) =>
        (deliverable.status === "approved" || deliverable.status === "live") &&
        Boolean(deliverable.asset_url ?? deliverable.live_url) &&
        Boolean(deliverable.decided_at),
    )
    .sort((a, b) => (a.decided_at! < b.decided_at! ? 1 : -1));

  const campaignIds = Array.from(new Set(approvedRows.map((row) => row.campaign_id)));
  const campaignsMap = new Map<string, Campaign>();
  if (campaignIds.length > 0) {
    const rows = await db.select().from(campaignsTable).where(inArray(campaignsTable.id, campaignIds));
    rows.forEach((row) => campaignsMap.set(row.id, row));
  }

  return approvedRows.map((row) => ({
    deliverableId: row.id,
    campaignTitle: campaignsMap.get(row.campaign_id)?.title ?? "Campaign",
    deliverableType: row.kind,
    contentUrl: row.asset_url ?? row.live_url ?? "",
    approvedAt: row.decided_at ?? row.submitted_at ?? now(),
  }));
}

export async function inviteCreatorToCampaign(
  brandId: string,
  campaignId: string,
  creatorId: string,
): Promise<Application> {
  await ensureSeeded();
  const campaign = await campaigns.byId(campaignId);
  if (!campaign) {
    throw new Error("CAMPAIGN_NOT_FOUND");
  }
  if (campaign.brand_id !== brandId) {
    throw new Error("FORBIDDEN");
  }

  const creatorProfile = await profiles.byId(creatorId);
  if (!creatorProfile || creatorProfile.role !== "creator") {
    throw new Error("CREATOR_NOT_FOUND");
  }

  const creatorSocials = await db.select().from(socialAccountsTable).where(eq(socialAccountsTable.user_id, creatorId));
  if (!isCreatorProfileComplete(creatorProfile, creatorSocials)) {
    throw new Error("CREATOR_INCOMPLETE");
  }

  const [existing] = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .where(and(eq(applicationsTable.campaign_id, campaignId), eq(applicationsTable.creator_id, creatorId)))
    .limit(1);
  if (existing) {
    throw new Error("DUPLICATE_INVITE");
  }

  const row: Application = {
    id: newId(),
    campaign_id: campaignId,
    creator_id: creatorId,
    pitch: "Invited by brand",
    status: "invited",
    applied_at: now(),
    decided_at: null,
    decided_by: null,
  };
  await db.insert(applicationsTable).values(row);
  await writeAudit(brandId, "invite_creator_to_campaign", "application", row.id, {
    campaign_id: campaignId,
    creator_id: creatorId,
    status: "invited",
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

  async create(data: Omit<Brand, "id" | "created_at" | "wallet_balance_paise" | "notification_preferences" | "status"> & Partial<Pick<Brand, "status">>): Promise<Brand> {
    await ensureSeeded();
    const row: Brand = {
      ...data,
      id: newId(),
      status: data.status ?? "pending",
      wallet_balance_paise: 0,
      notification_preferences: {},
      created_at: now(),
    };
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

export async function getAllBrands(): Promise<Brand[]> {
  return brands.list();
}

export async function updateBrandStatus(
  brandId: string,
  status: "approved" | "rejected",
  reason?: string,
  actorUserId = "system",
): Promise<Brand | null> {
  await ensureSeeded();
  const [row] = await db
    .update(brandsTable)
    .set({
      status,
      verified: status === "approved",
    })
    .where(eq(brandsTable.id, brandId))
    .returning();

  if (!row) return null;
  await writeAudit(actorUserId, "update_brand_status", "brand", brandId, { status, reason });
  return row;
}

function mapAdminCampaignStatus(status?: string): Campaign["status"] | undefined {
  if (!status || status === "all") return undefined;
  if (status === "active") return "open";
  if (status === "paused") return "closed";
  if (status === "draft" || status === "completed" || status === "rejected") return status;
  return undefined;
}

function toCampaignStorageStatus(status: "active" | "rejected" | "paused" | "completed"): Campaign["status"] {
  if (status === "active") return "open";
  if (status === "paused") return "closed";
  return status;
}

export async function getAllCampaigns(status?: string): Promise<Array<Campaign & { brand: Brand | null; brand_name: string | null }>> {
  await ensureSeeded();
  const mappedStatus = mapAdminCampaignStatus(status);
  const [campaignRows, brandRows] = await Promise.all([
    db.select().from(campaignsTable),
    db.select().from(brandsTable),
  ]);
  const brandById = new Map(brandRows.map((brand) => [brand.id, brand]));
  const filtered = mappedStatus ? campaignRows.filter((campaign) => campaign.status === mappedStatus) : campaignRows;

  return sortDescBy(filtered).map((campaign) => {
    const brand = brandById.get(campaign.brand_id) ?? null;
    return {
      ...campaign,
      brand,
      brand_name: brand?.name ?? null,
    };
  });
}

export async function adminUpdateCampaignStatus(
  campaignId: string,
  status: "active" | "rejected" | "paused" | "completed",
  actorUserId: string,
): Promise<Campaign | null> {
  await ensureSeeded();
  const current = await campaigns.byId(campaignId);
  if (!current) return null;

  const nextStatus = toCampaignStorageStatus(status);
  const allowed =
    (current.status === "draft" && (nextStatus === "open" || nextStatus === "rejected")) ||
    (current.status === "open" && (nextStatus === "closed" || nextStatus === "completed")) ||
    (current.status === "closed" && nextStatus === "open");

  if (!allowed) {
    throw new Error("Invalid status transition");
  }

  const [updated] = await db
    .update(campaignsTable)
    .set({ status: nextStatus })
    .where(eq(campaignsTable.id, campaignId))
    .returning();

  if (!updated) return null;
  await writeAudit(actorUserId, "admin_update_campaign_status", "campaign", campaignId, {
    from: current.status,
    to: nextStatus,
  });
  return updated;
}

export async function getAllApplications(): Promise<Array<Application & {
  creator: Profile | null;
  campaign: Campaign | null;
  brand: Brand | null;
}>> {
  await ensureSeeded();
  const [applicationRows, profileRows, campaignRows, brandRows] = await Promise.all([
    db.select().from(applicationsTable),
    db.select().from(profilesTable),
    db.select().from(campaignsTable),
    db.select().from(brandsTable),
  ]);

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const campaignById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const brandById = new Map(brandRows.map((brand) => [brand.id, brand]));

  return [...applicationRows]
    .sort((a, b) => (a.applied_at < b.applied_at ? 1 : -1))
    .map((application) => {
      const campaign = campaignById.get(application.campaign_id) ?? null;
      return {
        ...application,
        creator: profileById.get(application.creator_id) ?? null,
        campaign,
        brand: campaign ? brandById.get(campaign.brand_id) ?? null : null,
      };
    });
}

export async function adminUpdateApplicationStatus(
  applicationId: string,
  status: "approved" | "rejected",
  actorUserId: string,
): Promise<Application | null> {
  const decision: "accepted" | "rejected" = status === "approved" ? "accepted" : "rejected";
  const row = await applications.decide(applicationId, decision, actorUserId);
  if (!row) return null;
  await writeAudit(actorUserId, "admin_override_application_status", "application", applicationId, { status });
  return row;
}

export async function getAllDeliverables(): Promise<Array<Deliverable & {
  creator: Profile | null;
  campaign: Campaign | null;
  brand: Brand | null;
}>> {
  await ensureSeeded();
  const [deliverableRows, profileRows, campaignRows, brandRows] = await Promise.all([
    db.select().from(deliverablesTable),
    db.select().from(profilesTable),
    db.select().from(campaignsTable),
    db.select().from(brandsTable),
  ]);

  const profileById = new Map(profileRows.map((profile) => [profile.id, profile]));
  const campaignById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const brandById = new Map(brandRows.map((brand) => [brand.id, brand]));

  return [...deliverableRows]
    .sort((a, b) => ((a.submitted_at ?? a.decided_at ?? "") < (b.submitted_at ?? b.decided_at ?? "") ? 1 : -1))
    .map((deliverable) => {
      const campaign = campaignById.get(deliverable.campaign_id) ?? null;
      return {
        ...deliverable,
        creator: profileById.get(deliverable.creator_id) ?? null,
        campaign,
        brand: campaign ? brandById.get(campaign.brand_id) ?? null : null,
      };
    });
}

export async function adminUpdateDeliverableStatus(
  deliverableId: string,
  status: "approved" | "rejected",
  rejectionReason: string | undefined,
  actorUserId: string,
): Promise<Deliverable | null> {
  if (status === "rejected" && !rejectionReason) {
    throw new Error("rejection_reason is required when rejecting");
  }
  const row = await deliverables.decide(deliverableId, status, rejectionReason ?? "", actorUserId);
  if (!row) return null;
  await writeAudit(actorUserId, "admin_override_deliverable_status", "deliverable", deliverableId, {
    status,
    rejection_reason: rejectionReason,
  });
  return row;
}

function last30DayKeys(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

function platformFeeForTransaction(transaction: Transaction, campaignById: Map<string, Campaign>): number {
  const campaign = transaction.reference_id ? campaignById.get(transaction.reference_id) : null;
  if (!campaign) return 0;
  return Math.round((transaction.amount_cents * campaign.commission_pct) / 100);
}

export async function getAdminDashboardStats(): Promise<{
  totalBrands: number;
  activeCampaigns: number;
  totalCreators: number;
  platformRevenuePaise: number;
  campaignSignups30d: Array<{ date: string; count: number }>;
  revenue30d: Array<{ date: string; amountPaise: number }>;
}> {
  await ensureSeeded();
  const [brandRows, campaignRows, profileRows, transactionRows] = await Promise.all([
    db.select().from(brandsTable),
    db.select().from(campaignsTable),
    db.select().from(profilesTable),
    db.select().from(transactionsTable),
  ]);

  const campaignById = new Map(campaignRows.map((campaign) => [campaign.id, campaign]));
  const earningTransactions = transactionRows.filter((transaction) => transaction.kind === "earning" && transaction.status === "completed");
  const days = last30DayKeys();

  return {
    totalBrands: brandRows.length,
    activeCampaigns: campaignRows.filter((campaign) => campaign.status === "open").length,
    totalCreators: profileRows.filter((profile) => profile.role === "creator").length,
    platformRevenuePaise: earningTransactions.reduce((sum, transaction) => sum + platformFeeForTransaction(transaction, campaignById), 0),
    campaignSignups30d: days.map((date) => ({
      date,
      count: campaignRows.filter((campaign) => campaign.created_at.slice(0, 10) === date).length,
    })),
    revenue30d: days.map((date) => ({
      date,
      amountPaise: earningTransactions
        .filter((transaction) => transaction.created_at.slice(0, 10) === date)
        .reduce((sum, transaction) => sum + platformFeeForTransaction(transaction, campaignById), 0),
    })),
  };
}

export async function getAuditLog(params: {
  actor?: string;
  action?: string;
  targetType?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}): Promise<{ rows: AuditLog[]; nextCursor: string | null }> {
  await ensureSeeded();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 50);
  const fromTime = params.from ? new Date(`${params.from}T00:00:00.000Z`).getTime() : null;
  const toTime = params.to ? new Date(`${params.to}T23:59:59.999Z`).getTime() : null;

  let rows = await audit.list();
  rows = rows.filter((row) => {
    if (params.actor && !row.actor_user_id?.toLowerCase().includes(params.actor.toLowerCase())) return false;
    if (params.action && !row.action.toLowerCase().includes(params.action.toLowerCase())) return false;
    if (params.targetType && row.target_type !== params.targetType) return false;
    const createdTime = new Date(row.created_at).getTime();
    if (fromTime !== null && createdTime < fromTime) return false;
    if (toTime !== null && createdTime > toTime) return false;
    return true;
  });

  const startIndex = params.cursor ? rows.findIndex((row) => row.id === params.cursor) + 1 : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const page = rows.slice(safeStartIndex, safeStartIndex + limit);
  const nextRow = rows[safeStartIndex + limit];

  return {
    rows: page,
    nextCursor: nextRow ? page[page.length - 1]?.id ?? null : null,
  };
}

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
          const createdAt = now();
          const thread: MessageThread = {
            id: newId(),
            creator_id: a.creator_id,
            brand_id: c.brand_id,
            campaign_id: c.id,
            last_message_preview: `Welcome to ${c.title}! Excited to collaborate.`,
            last_message_at: createdAt,
            unread_count: 1,
            brand_online: true,
            status_label: "CAMPAIGN ACTIVE",
            created_at: createdAt,
            updated_at: createdAt,
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
            read_at: null,
            created_at: createdAt,
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
    const current = await deliverables.byId(id);
    if (!current) return null;

    let approvedCampaign: Campaign | null = null;
    let perItem = 0;

    if (status === "approved") {
      approvedCampaign = await campaigns.byId(current.campaign_id);
      if (!approvedCampaign) {
        throw new Error("Campaign not found");
      }
      const totalDeliverables = approvedCampaign.deliverables.reduce((sum, item) => sum + item.qty, 0) || 1;
      perItem = Math.round(approvedCampaign.base_earning_cents / totalDeliverables);
      await debitWalletBalance(approvedCampaign.brand_id, perItem, `${approvedCampaign.title} — ${current.kind}`);
    }

    const [d] = await db
      .update(deliverablesTable)
      .set({ status, feedback, decided_at: now() })
      .where(eq(deliverablesTable.id, id))
      .returning();

    if (!d) return null;

    if (status === "approved") {
      const c = approvedCampaign;
      if (!c) {
        throw new Error("Campaign not found");
      }

      await transactions.create(d.creator_id, {
        kind: "earning",
        status: "completed",
        amount_cents: perItem,
        description: `${c.title} — ${d.kind}`,
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

    const createdAt = now();
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
      read_at: senderRole === "brand" ? null : createdAt,
      created_at: createdAt,
    };

    await db.insert(messagesTable).values(msg);
    await db
      .update(messageThreadsTable)
      .set({
        last_message_preview: body.slice(0, 120),
        last_message_at: msg.created_at,
        updated_at: msg.created_at,
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

    await db.update(messageThreadsTable).set({ unread_count: 0, updated_at: now() }).where(eq(messageThreadsTable.id, threadId));
    await db
      .update(messagesTable)
      .set({ read: true, read_at: now() })
      .where(
        and(
          eq(messagesTable.thread_id, threadId),
          eq(messagesTable.sender_role, "brand"),
        ),
      );
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

    const createdAt = now();
    const t: MessageThread = {
      id: newId(),
      creator_id,
      brand_id,
      campaign_id: null,
      last_message_preview: opener.slice(0, 120),
      last_message_at: createdAt,
      unread_count: 0,
      brand_online: Math.random() > 0.5,
      status_label: null,
      created_at: createdAt,
      updated_at: createdAt,
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
      read_at: null,
      created_at: createdAt,
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
