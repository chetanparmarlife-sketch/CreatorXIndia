import { z } from "zod";
import {
  ApiError,
  type Application,
  type AuthResponse,
  type BrandProfile,
  type Campaign,
  type CampaignDetail,
  type CreatorApplication,
  type CreatorProfile,
  type DashboardStats,
  type Deliverable,
  type EarningTransaction,
  type EarningsSummary,
  type HomeStats,
  type KycRecord,
  type Message,
  type Notification,
  type PaginatedCampaigns,
  type PaymentMethods,
  type PayoutRequest,
  type Thread,
  type UploadPresignResponse,
} from "./types";

export { ApiError } from "./types";
export type {
  Application,
  AuthResponse,
  BrandProfile,
  Campaign,
  CampaignDetail,
  CreatorApplication,
  CreatorProfile,
  DashboardStats,
  Deliverable,
  EarningTransaction,
  EarningsSummary,
  HomeStats,
  KycRecord,
  Message,
  Notification,
  PaginatedCampaigns,
  PaymentMethods,
  PayoutRequest,
  Thread,
  UploadPresignResponse,
} from "./types";

type HttpMethod = "GET" | "POST" | "PATCH";

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => Promise<string | null>;
}

const emailBodySchema = z.object({
  email: z.string().trim().email("email must be valid"),
});

const verifyOtpBodySchema = emailBodySchema.extend({
  otp: z.string().trim().regex(/^[0-9]{6}$/, "otp must be 6 digits"),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().trim().min(1, "refreshToken is required"),
});

const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    role: z.string().min(1),
    email: z.string().email(),
  }).passthrough(),
});

const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
});

const rawCreatorProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  full_name: z.string().optional(),
  displayName: z.string().optional(),
  bio: z.string().nullable().optional().default(null),
  niches: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  total_reach: z.number().optional(),
  followerCount: z.number().optional(),
  avatar_url: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  profile_complete: z.boolean().optional(),
  profileComplete: z.boolean().optional(),
  role: z.string(),
}).passthrough();

const creatorProfileResponseSchema = z.object({
  profile: rawCreatorProfileSchema,
}).passthrough();

const creatorProfileInputSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).optional(),
  bio: z.string().nullable().optional(),
  niches: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  followerCount: z.number().optional(),
  avatarUrl: z.string().nullable().optional(),
  profileComplete: z.boolean().optional(),
  role: z.literal("creator").optional(),
}).strict();

const creatorProfileRequestSchema = z.object({
  full_name: z.string().trim().min(1).optional(),
  bio: z.string().nullable().optional(),
  niches: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  avatar_url: z.string().nullable().optional(),
}).strict();

const rawBrandProfileSchema = z.object({
  id: z.string(),
  contact_email: z.string().nullable().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  companyName: z.string().optional(),
  industry: z.string(),
  website: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  wallet_balance_paise: z.number().optional(),
  walletBalancePaise: z.number().optional(),
}).passthrough();

const brandProfileResponseSchema = z.object({
  brand: rawBrandProfileSchema,
}).passthrough();

const brandProfileInputSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
  companyName: z.string().trim().min(1).optional(),
  industry: z.string().trim().min(1).optional(),
  websiteUrl: z.string().url().nullable().optional(),
  gstin: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  walletBalancePaise: z.number().optional(),
  role: z.literal("brand").optional(),
}).strict();

const brandProfileRequestSchema = z.object({
  companyName: z.string().trim().min(1, "companyName is required"),
  industry: z.string().trim().min(1, "industry is required"),
  websiteUrl: z.string().url("websiteUrl must be a valid URL"),
  gstin: z.string().trim().min(1).optional(),
  logoUrl: z.string().url().optional(),
}).strict();

const rawCampaignSchema = z.object({
  id: z.string(),
  brand_id: z.string().optional(),
  brandId: z.string().optional(),
  brand_name: z.string().nullable().optional(),
  brandName: z.string().nullable().optional(),
  title: z.string(),
  description: z.string(),
  category: z.string().optional(),
  niche: z.string().optional(),
  platforms: z.array(z.string()).optional().default([]),
  deliverables: z.array(z.object({
    kind: z.string().optional(),
    spec: z.string().optional(),
  }).passthrough()).optional(),
  deliverable_type: z.string().optional(),
  deliverableType: z.string().optional(),
  budget_paise: z.number().optional(),
  budgetPaise: z.number().optional(),
  base_earning_cents: z.number().optional(),
  max_creators: z.number().optional(),
  maxCreators: z.number().optional(),
  slots_total: z.number().optional(),
  applicant_count: z.number().optional(),
  applicantCount: z.number().optional(),
  application_deadline: z.string().optional(),
  applicationDeadline: z.string().optional(),
  apply_deadline: z.string().optional(),
  status: z.string(),
  brief_url: z.string().nullable().optional(),
  briefUrl: z.string().nullable().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
}).passthrough();

const campaignListResponseSchema = z.object({
  campaigns: z.array(rawCampaignSchema),
}).passthrough();

const paginatedCampaignsResponseSchema = campaignListResponseSchema.extend({
  nextCursor: z.string().nullable(),
});

const campaignDetailResponseSchema = z.object({
  campaign: rawCampaignSchema,
}).passthrough();

const rawApplicationSchema = z.object({
  id: z.string(),
  campaign_id: z.string().optional(),
  campaignId: z.string().optional(),
  creator_id: z.string().optional(),
  creatorId: z.string().optional(),
  pitch: z.string().optional().default(""),
  status: z.string(),
  applied_at: z.string().optional(),
  appliedAt: z.string().optional(),
  decided_at: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  decided_by: z.string().nullable().optional(),
  decidedBy: z.string().nullable().optional(),
}).passthrough();

const rawDeliverableSchema = z.object({
  id: z.string(),
  application_id: z.string().optional(),
  applicationId: z.string().optional(),
  campaign_id: z.string().optional(),
  campaignId: z.string().optional(),
  creator_id: z.string().optional(),
  creatorId: z.string().optional(),
  kind: z.string().optional(),
  deliverableType: z.string().optional(),
  asset_url: z.string().nullable().optional(),
  contentUrl: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.string(),
  submitted_at: z.string().nullable().optional(),
  submittedAt: z.string().nullable().optional(),
  decided_at: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
  live_url: z.string().nullable().optional(),
  liveUrl: z.string().nullable().optional(),
}).passthrough();

const rawThreadSchema = z.object({
  id: z.string(),
  campaign_id: z.string().nullable().optional(),
  campaignId: z.string().nullable().optional(),
  brand_id: z.string().optional(),
  brandId: z.string().optional(),
  creator_id: z.string().optional(),
  creatorId: z.string().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
  updated_at: z.string().optional(),
  updatedAt: z.string().optional(),
  last_message_preview: z.string().optional(),
  lastMessagePreview: z.string().optional(),
  last_message_at: z.string().optional(),
  lastMessageAt: z.string().optional(),
  unread_count: z.number().optional(),
  unreadCount: z.number().optional(),
  brand: z.object({
    id: z.string(),
    name: z.string(),
    logo_url: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
  }).nullable().optional(),
  campaign: z.object({
    id: z.string(),
    title: z.string(),
  }).nullable().optional(),
}).passthrough();

const rawMessageSchema = z.object({
  id: z.string(),
  thread_id: z.string().optional(),
  threadId: z.string().optional(),
  sender_id: z.string().optional(),
  senderId: z.string().optional(),
  sender_role: z.enum(["creator", "brand", "system"]).optional(),
  senderRole: z.enum(["creator", "brand", "system"]).optional(),
  body: z.string(),
  read_at: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
}).passthrough();

const creatorCampaignDetailResponseSchema = z.object({
  campaign: rawCampaignSchema,
  brand: z.object({
    id: z.string(),
    name: z.string(),
    logo_url: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
  }).nullable().optional(),
  application: rawApplicationSchema.nullable().optional(),
}).passthrough();

const applicationResponseSchema = z.object({
  application: rawApplicationSchema,
}).passthrough();

const deliverableResponseSchema = z.object({
  deliverable: rawDeliverableSchema,
}).passthrough();

const threadListResponseSchema = z.object({
  threads: z.array(rawThreadSchema),
}).passthrough();

const threadMessagesResponseSchema = z.object({
  thread: rawThreadSchema,
  messages: z.array(rawMessageSchema),
}).passthrough();

const messageResponseSchema = z.object({
  message: rawMessageSchema,
}).passthrough();

const homeStatsSchema = z.object({
  activeApplications: z.number(),
  pendingDeliverables: z.number(),
  availableForWithdrawalPaise: z.number(),
});

const rawCreatorApplicationSchema = z.object({
  applicationId: z.string(),
  campaignId: z.string(),
  status: z.string(),
  appliedAt: z.string(),
  brandName: z.string().nullable().optional(),
  deliverableStatus: z.string().nullable().optional(),
  campaign: rawCampaignSchema,
}).passthrough();

const creatorApplicationsResponseSchema = z.object({
  applications: z.array(rawCreatorApplicationSchema),
}).passthrough();

const rawTransactionSchema = z.object({
  id: z.string(),
  amount_cents: z.number().optional(),
  amountPaise: z.number().optional(),
  kind: z.string().optional(),
  type: z.string().optional(),
  description: z.string(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
  status: z.string(),
}).passthrough();

const earningsResponseSchema = z.object({
  balance_cents: z.number().optional(),
  availableForWithdrawalPaise: z.number().optional(),
  totalEarnedPaise: z.number().optional(),
  pendingPaise: z.number().optional(),
  upi_id: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  bank_account: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  transactions: z.array(rawTransactionSchema).optional().default([]),
}).passthrough();

const withdrawalRequestSchema = z.object({
  amountPaise: z.number().int().min(50_000, "Minimum withdrawal is ₹500"),
}).strict();

const rawPayoutRequestSchema = z.object({
  id: z.string(),
  creator_id: z.string().optional(),
  creatorId: z.string().optional(),
  amount_paise: z.number().optional(),
  amountPaise: z.number().optional(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  upi_id: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  bank_account: z.string().nullable().optional(),
  bankAccount: z.string().nullable().optional(),
  razorpay_payout_id: z.string().nullable().optional(),
  razorpayPayoutId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
  updated_at: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const payoutRequestResponseSchema = z.object({
  payoutRequest: rawPayoutRequestSchema,
}).passthrough();

const socialAccountsBodySchema = z.object({
  instagram: z.string().trim().optional(),
  youtube: z.string().trim().optional(),
  twitter: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
}).strict();

const upiBodySchema = z.object({
  upiId: z.string().trim().regex(/^[a-z0-9._-]+@[a-z0-9.-]+$/i),
}).strict();

const bankAccountBodySchema = z.object({
  accountNumber: z.string().trim().regex(/^[0-9]{9,18}$/),
  ifsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i),
  accountName: z.string().trim().min(1),
}).strict();

const paymentMethodsResponseSchema = z.object({
  upiId: z.string().nullable(),
  bankAccount: z.string().nullable(),
}).passthrough();

const rawKycSchema = z.object({
  id: z.string().optional(),
  creator_id: z.string().optional(),
  creatorId: z.string().optional(),
  pan_url: z.string().optional(),
  panUrl: z.string().optional(),
  aadhaar_url: z.string().optional(),
  aadhaarUrl: z.string().optional(),
  status: z.enum(["not_submitted", "pending", "approved", "rejected"]),
  rejection_reason: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  reviewed_by: z.string().nullable().optional(),
  reviewedBy: z.string().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
  updated_at: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

const kycResponseSchema = z.object({
  kyc: rawKycSchema,
}).passthrough();

const kycBodySchema = z.object({
  panUrl: z.string().trim().url(),
  aadhaarUrl: z.string().trim().url(),
}).strict();

const notificationPreferencesBodySchema = z.object({
  preferences: z.record(z.boolean()),
}).strict();

const notificationPreferencesResponseSchema = z.object({
  preferences: z.record(z.boolean()),
}).passthrough();

const changeEmailBodySchema = z.object({
  newEmail: z.string().trim().email(),
}).strict();

const uploadPresignBodySchema = z.object({
  type: z.enum(["avatar", "kyc", "deliverable"]),
  filename: z.string().trim().min(1),
  campaignId: z.string().trim().min(1).optional(),
}).strict();

const uploadPresignResponseSchema = z.object({
  uploadUrl: z.string().min(1),
  publicUrl: z.string().optional(),
}).passthrough();

const stringRecordSchema = z.record(z.string());

const rawNotificationSchema = z.object({
  id: z.string(),
  kind: z.string().optional(),
  type: z.string().optional(),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable().optional(),
  read: z.boolean().optional(),
  read_at: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
  created_at: z.string().optional(),
  createdAt: z.string().optional(),
  data: stringRecordSchema.optional(),
}).passthrough();

const notificationListResponseSchema = z.object({
  notifications: z.array(rawNotificationSchema),
}).passthrough();

const dashboardStatsSchema = z.object({
  activeCampaigns: z.number(),
  totalSpentPaise: z.number(),
  pendingApplications: z.number(),
  approvedDeliverables: z.number(),
});

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value.length > 0) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.clone().json();
    if (isRecord(data)) {
      const error = data.error;
      const message = data.message;
      if (typeof error === "string" && error.length > 0) return error;
      if (typeof message === "string" && message.length > 0) return message;
    }
  } catch {
    // Fall through to text/status below.
  }

  try {
    const text = await response.text();
    if (text.length > 0) return text;
  } catch {
    // Fall through to status text.
  }

  return response.statusText || "Request failed";
}

async function requestJson(
  config: ApiClientConfig,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const token = await config.getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${normalizeBaseUrl(config.baseUrl)}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (response.status === 204) return undefined;

  const text = await response.text();
  if (text.length === 0) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(response.status, "Invalid JSON response");
  }
}

function mapCreatorProfile(raw: z.infer<typeof rawCreatorProfileSchema>): CreatorProfile {
  const displayName = raw.displayName ?? raw.full_name ?? raw.email;
  const profileComplete = raw.profileComplete
    ?? raw.profile_complete
    ?? (displayName.trim().length > 0 && raw.niches.length > 0);

  return {
    id: raw.id,
    email: raw.email,
    displayName,
    bio: raw.bio,
    niches: raw.niches,
    languages: raw.languages,
    followerCount: raw.followerCount ?? raw.total_reach ?? 0,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
    profileComplete,
    role: "creator",
  };
}

function parseCreatorProfile(data: unknown): CreatorProfile {
  return mapCreatorProfile(creatorProfileResponseSchema.parse(data).profile);
}

function mapBrandProfile(raw: z.infer<typeof rawBrandProfileSchema>): BrandProfile {
  return {
    id: raw.id,
    email: raw.email ?? raw.contact_email ?? "",
    companyName: raw.companyName ?? raw.name ?? "My Brand",
    industry: raw.industry,
    websiteUrl: raw.websiteUrl ?? raw.website ?? null,
    gstin: raw.gstin,
    logoUrl: raw.logoUrl ?? raw.logo_url ?? null,
    walletBalancePaise: raw.walletBalancePaise ?? raw.wallet_balance_paise ?? 0,
    role: "brand",
  };
}

function parseBrandProfile(data: unknown): BrandProfile {
  return mapBrandProfile(brandProfileResponseSchema.parse(data).brand);
}

function briefUrlFromDeliverable(raw: z.infer<typeof rawCampaignSchema>): string | null {
  const direct = raw.briefUrl ?? raw.brief_url;
  if (direct !== undefined) return direct;

  const firstSpec = raw.deliverables?.[0]?.spec;
  const prefix = "See brief: ";
  if (firstSpec?.startsWith(prefix)) return firstSpec.slice(prefix.length);
  return null;
}

function mapCampaign(raw: z.infer<typeof rawCampaignSchema>): Campaign {
  const maxCreators = raw.maxCreators ?? raw.max_creators ?? raw.slots_total ?? 0;
  const perCreatorBudget = raw.base_earning_cents ?? 0;

  return {
    id: raw.id,
    brandId: raw.brandId ?? raw.brand_id ?? "",
    brandName: raw.brandName ?? raw.brand_name ?? null,
    title: raw.title,
    description: raw.description,
    niche: raw.niche ?? raw.category ?? "",
    platforms: raw.platforms,
    deliverableType: raw.deliverableType ?? raw.deliverable_type ?? raw.deliverables?.[0]?.kind ?? "",
    budgetPaise: raw.budgetPaise ?? raw.budget_paise ?? perCreatorBudget * Math.max(maxCreators, 1),
    maxCreators,
    applicantCount: raw.applicantCount ?? raw.applicant_count ?? 0,
    applicationDeadline: raw.applicationDeadline ?? raw.application_deadline ?? raw.apply_deadline ?? "",
    status: raw.status,
    briefUrl: briefUrlFromDeliverable(raw),
    createdAt: raw.createdAt ?? raw.created_at ?? "",
  };
}

function parseCampaignList(data: unknown): Campaign[] {
  return campaignListResponseSchema.parse(data).campaigns.map(mapCampaign);
}

function parseCampaignDetail(data: unknown): Campaign {
  const wrapped = campaignDetailResponseSchema.safeParse(data);
  if (wrapped.success) return mapCampaign(wrapped.data.campaign);
  return mapCampaign(rawCampaignSchema.parse(data));
}

function mapApplication(raw: z.infer<typeof rawApplicationSchema>): Application {
  return {
    id: raw.id,
    campaignId: raw.campaignId ?? raw.campaign_id ?? "",
    creatorId: raw.creatorId ?? raw.creator_id ?? "",
    pitch: raw.pitch,
    status: raw.status,
    appliedAt: raw.appliedAt ?? raw.applied_at ?? "",
    decidedAt: raw.decidedAt ?? raw.decided_at ?? null,
    decidedBy: raw.decidedBy ?? raw.decided_by ?? null,
  };
}

function mapDeliverable(raw: z.infer<typeof rawDeliverableSchema>): Deliverable {
  return {
    id: raw.id,
    applicationId: raw.applicationId ?? raw.application_id ?? "",
    campaignId: raw.campaignId ?? raw.campaign_id ?? "",
    creatorId: raw.creatorId ?? raw.creator_id ?? "",
    deliverableType: raw.deliverableType ?? raw.kind ?? "Deliverable",
    contentUrl: raw.contentUrl ?? raw.asset_url ?? null,
    notes: raw.notes ?? raw.caption ?? null,
    status: raw.status,
    submittedAt: raw.submittedAt ?? raw.submitted_at ?? null,
    decidedAt: raw.decidedAt ?? raw.decided_at ?? null,
    liveUrl: raw.liveUrl ?? raw.live_url ?? null,
  };
}

function parseCreatorCampaignDetail(data: unknown): CampaignDetail {
  const raw = creatorCampaignDetailResponseSchema.parse(data);
  return {
    campaign: mapCampaign(raw.campaign),
    brand: raw.brand
      ? {
          id: raw.brand.id,
          name: raw.brand.name,
          logoUrl: raw.brand.logoUrl ?? raw.brand.logo_url ?? null,
        }
      : null,
    application: raw.application ? mapApplication(raw.application) : null,
  };
}

function parseApplication(data: unknown): Application {
  return mapApplication(applicationResponseSchema.parse(data).application);
}

function parseDeliverable(data: unknown): Deliverable {
  return mapDeliverable(deliverableResponseSchema.parse(data).deliverable);
}

function mapThread(raw: z.infer<typeof rawThreadSchema>): Thread {
  return {
    id: raw.id,
    campaignId: raw.campaignId ?? raw.campaign_id ?? null,
    brandId: raw.brandId ?? raw.brand_id ?? "",
    creatorId: raw.creatorId ?? raw.creator_id ?? "",
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    updatedAt: raw.updatedAt ?? raw.updated_at ?? "",
    lastMessagePreview: raw.lastMessagePreview ?? raw.last_message_preview ?? "",
    lastMessageAt: raw.lastMessageAt ?? raw.last_message_at ?? "",
    unreadCount: raw.unreadCount ?? raw.unread_count ?? 0,
    brand: raw.brand
      ? {
          id: raw.brand.id,
          name: raw.brand.name,
          logoUrl: raw.brand.logoUrl ?? raw.brand.logo_url ?? null,
        }
      : null,
    campaign: raw.campaign ?? null,
  };
}

function mapMessage(raw: z.infer<typeof rawMessageSchema>): Message {
  return {
    id: raw.id,
    threadId: raw.threadId ?? raw.thread_id ?? "",
    senderId: raw.senderId ?? raw.sender_id ?? "",
    senderRole: raw.senderRole ?? raw.sender_role ?? "system",
    body: raw.body,
    readAt: raw.readAt ?? raw.read_at ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
  };
}

function parseThreads(data: unknown): Thread[] {
  return threadListResponseSchema.parse(data).threads.map(mapThread);
}

function parseThreadMessages(data: unknown): { thread: Thread; messages: Message[] } {
  const raw = threadMessagesResponseSchema.parse(data);
  return {
    thread: mapThread(raw.thread),
    messages: raw.messages.map(mapMessage),
  };
}

function parseMessage(data: unknown): Message {
  return mapMessage(messageResponseSchema.parse(data).message);
}

function parsePaginatedCampaigns(data: unknown): PaginatedCampaigns {
  const raw = paginatedCampaignsResponseSchema.parse(data);
  return {
    campaigns: raw.campaigns.map(mapCampaign),
    nextCursor: raw.nextCursor,
  };
}

function parseCreatorApplications(data: unknown): CreatorApplication[] {
  const raw = creatorApplicationsResponseSchema.parse(data);
  return raw.applications.map((application) => ({
    applicationId: application.applicationId,
    campaignId: application.campaignId,
    status: application.status,
    appliedAt: application.appliedAt,
    brandName: application.brandName ?? null,
    deliverableStatus: application.deliverableStatus ?? null,
    campaign: mapCampaign(application.campaign),
  }));
}

function mapTransaction(raw: z.infer<typeof rawTransactionSchema>): EarningTransaction {
  return {
    id: raw.id,
    amountPaise: raw.amountPaise ?? raw.amount_cents ?? 0,
    type: raw.type ?? raw.kind ?? "earning",
    description: raw.description,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    status: raw.status,
  };
}

function parseEarnings(data: unknown): EarningsSummary {
  const raw = earningsResponseSchema.parse(data);
  const transactions = raw.transactions.map(mapTransaction);
  const totalEarnedPaise = raw.totalEarnedPaise
    ?? transactions
      .filter((transaction) => transaction.type === "earning" && transaction.status === "completed")
      .reduce((sum, transaction) => sum + transaction.amountPaise, 0);
  const pendingPaise = raw.pendingPaise
    ?? transactions
      .filter((transaction) => transaction.status === "pending")
      .reduce((sum, transaction) => sum + Math.abs(transaction.amountPaise), 0);

  return {
    totalEarnedPaise,
    pendingPaise,
    availableForWithdrawalPaise: raw.availableForWithdrawalPaise ?? raw.balance_cents ?? 0,
    upiId: raw.upiId ?? raw.upi_id ?? null,
    bankAccount: raw.bankAccount ?? raw.bank_account ?? null,
    transactions,
  };
}

function mapPayoutRequest(raw: z.infer<typeof rawPayoutRequestSchema>): PayoutRequest {
  return {
    id: raw.id,
    creatorId: raw.creatorId ?? raw.creator_id ?? "",
    amountPaise: raw.amountPaise ?? raw.amount_paise ?? 0,
    status: raw.status,
    upiId: raw.upiId ?? raw.upi_id ?? null,
    bankAccount: raw.bankAccount ?? raw.bank_account ?? null,
    razorpayPayoutId: raw.razorpayPayoutId ?? raw.razorpay_payout_id ?? null,
    notes: raw.notes ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    updatedAt: raw.updatedAt ?? raw.updated_at ?? "",
  };
}

function parsePayoutRequest(data: unknown): PayoutRequest {
  return mapPayoutRequest(payoutRequestResponseSchema.parse(data).payoutRequest);
}

function mapKyc(raw: z.infer<typeof rawKycSchema>): KycRecord {
  return {
    id: raw.id,
    creatorId: raw.creatorId ?? raw.creator_id,
    panUrl: raw.panUrl ?? raw.pan_url,
    aadhaarUrl: raw.aadhaarUrl ?? raw.aadhaar_url,
    status: raw.status,
    rejectionReason: raw.rejectionReason ?? raw.rejection_reason ?? null,
    reviewedBy: raw.reviewedBy ?? raw.reviewed_by,
    reviewedAt: raw.reviewedAt ?? raw.reviewed_at,
    createdAt: raw.createdAt ?? raw.created_at,
    updatedAt: raw.updatedAt ?? raw.updated_at,
  };
}

function parseKyc(data: unknown): KycRecord {
  return mapKyc(kycResponseSchema.parse(data).kyc);
}

function mapNotification(raw: z.infer<typeof rawNotificationSchema>): Notification {
  const data = raw.data ?? (raw.link ? { link: raw.link } : undefined);

  return {
    id: raw.id,
    type: raw.type ?? raw.kind ?? "system",
    title: raw.title,
    body: raw.body,
    readAt: raw.readAt ?? raw.read_at ?? (raw.read ? raw.created_at ?? raw.createdAt ?? null : null),
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    data,
  };
}

function parseNotifications(data: unknown): Notification[] {
  return notificationListResponseSchema.parse(data).notifications.map(mapNotification);
}

function toCreatorProfileBody(data: Partial<CreatorProfile>): z.infer<typeof creatorProfileRequestSchema> {
  const input = creatorProfileInputSchema.parse(data);
  return creatorProfileRequestSchema.parse({
    full_name: input.displayName,
    bio: input.bio,
    niches: input.niches,
    languages: input.languages,
    avatar_url: input.avatarUrl,
  });
}

function toBrandProfileBody(
  data: Partial<BrandProfile>,
  current: BrandProfile,
): z.infer<typeof brandProfileRequestSchema> {
  const input = brandProfileInputSchema.parse(data);
  return brandProfileRequestSchema.parse({
    companyName: input.companyName ?? current.companyName,
    industry: input.industry ?? current.industry,
    websiteUrl: input.websiteUrl ?? current.websiteUrl,
    gstin: input.gstin ?? undefined,
    logoUrl: input.logoUrl ?? undefined,
  });
}

export function createApiClient(config: ApiClientConfig) {
  const clientConfig: ApiClientConfig = {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    getToken: config.getToken,
  };

  const get = (path: string) => requestJson(clientConfig, "GET", path);
  const post = (path: string, body?: unknown) => requestJson(clientConfig, "POST", path, body);
  const patch = (path: string, body?: unknown) => requestJson(clientConfig, "PATCH", path, body);

  const brand = {
    async getProfile(): Promise<BrandProfile> {
      return parseBrandProfile(await get("/api/brand/profile"));
    },

    async updateProfile(data: Partial<BrandProfile>): Promise<BrandProfile> {
      const current = await brand.getProfile();
      const body = toBrandProfileBody(data, current);
      return parseBrandProfile(await patch("/api/brand/profile", body));
    },

    async getDashboardStats(): Promise<DashboardStats> {
      return dashboardStatsSchema.parse(await get("/api/brand/dashboard-stats"));
    },

    async getCampaigns(status?: string): Promise<Campaign[]> {
      return parseCampaignList(await get(withQuery("/api/brand/campaigns", { status })));
    },

    async getCampaignDetail(id: string): Promise<Campaign> {
      return parseCampaignDetail(await get(`/api/brand/campaigns/${encodeURIComponent(id)}`));
    },
  };

  return {
    auth: {
      async requestOtp(email: string): Promise<void> {
        const body = emailBodySchema.parse({ email });
        await post("/api/auth/request-otp", body);
      },

      async verifyOtp(email: string, otp: string): Promise<AuthResponse> {
        const body = verifyOtpBodySchema.parse({ email, otp });
        return authResponseSchema.parse(await post("/api/auth/verify-otp", body));
      },

      async refresh(refreshToken: string): Promise<{ accessToken: string }> {
        const body = refreshBodySchema.parse({ refreshToken });
        return refreshResponseSchema.parse(await post("/api/auth/refresh", body));
      },

      async logout(): Promise<void> {
        await post("/api/auth/logout");
      },
    },

    creator: {
      async getProfile(): Promise<CreatorProfile> {
        return parseCreatorProfile(await get("/api/creator/profile"));
      },

      async updateProfile(data: Partial<CreatorProfile>): Promise<CreatorProfile> {
        const body = toCreatorProfileBody(data);
        return parseCreatorProfile(await patch("/api/creator/profile", body));
      },

      async getHomeStats(): Promise<HomeStats> {
        return homeStatsSchema.parse(await get("/api/creator/home-stats"));
      },

      async getCampaigns(status?: string, limit?: number): Promise<Campaign[]> {
        return parseCampaignList(await get(withQuery("/api/creator/campaigns", {
          status,
          limit: limit === undefined ? undefined : String(limit),
        })));
      },

      async discoverCampaigns(params: {
        search?: string;
        niche?: string;
        cursor?: string;
        limit?: number;
      } = {}): Promise<PaginatedCampaigns> {
        return parsePaginatedCampaigns(await get(withQuery("/api/creator/campaigns/discover", {
          search: params.search,
          niche: params.niche,
          cursor: params.cursor,
          limit: params.limit === undefined ? undefined : String(params.limit),
        })));
      },

      async getCampaignDetail(id: string): Promise<CampaignDetail> {
        return parseCreatorCampaignDetail(await get(`/api/creator/campaigns/${encodeURIComponent(id)}`));
      },

      async applyToCampaign(id: string, coverNote?: string): Promise<Application> {
        return parseApplication(await post(`/api/creator/campaigns/${encodeURIComponent(id)}/apply`, {
          coverNote,
        }));
      },

      async submitDeliverable(
        id: string,
        data: { contentUrl: string; notes?: string },
      ): Promise<Deliverable> {
        return parseDeliverable(await post(`/api/creator/campaigns/${encodeURIComponent(id)}/deliverable`, data));
      },

      async respondToInvite(id: string, accept: boolean): Promise<Application> {
        return parseApplication(await patch(`/api/creator/campaigns/${encodeURIComponent(id)}/invite-response`, {
          accept,
        }));
      },

      async getMyApplications(status?: string): Promise<CreatorApplication[]> {
        return parseCreatorApplications(await get(withQuery("/api/creator/my-campaigns", { status })));
      },

      async getThreads(): Promise<Thread[]> {
        return parseThreads(await get("/api/creator/threads"));
      },

      async getThreadMessages(threadId: string): Promise<{ thread: Thread; messages: Message[] }> {
        return parseThreadMessages(await get(`/api/creator/threads/${encodeURIComponent(threadId)}/messages`));
      },

      async sendMessage(threadId: string, body: string): Promise<Message> {
        return parseMessage(await post(`/api/creator/threads/${encodeURIComponent(threadId)}/messages`, { body }));
      },

      async getEarnings(): Promise<EarningsSummary> {
        return parseEarnings(await get("/api/creator/earnings"));
      },

      async requestWithdrawal(amountPaise: number): Promise<PayoutRequest> {
        const body = withdrawalRequestSchema.parse({ amountPaise });
        return parsePayoutRequest(await post("/api/creator/withdrawals", body));
      },

      async updateSocialAccounts(data: {
        instagram?: string;
        youtube?: string;
        twitter?: string;
        linkedin?: string;
      }): Promise<void> {
        const body = socialAccountsBodySchema.parse(data);
        await patch("/api/creator/social-accounts", body);
      },

      async updateUpi(upiId: string): Promise<PaymentMethods> {
        const body = upiBodySchema.parse({ upiId });
        return paymentMethodsResponseSchema.parse(await patch("/api/creator/payment-methods/upi", body));
      },

      async updateBankAccount(data: {
        accountNumber: string;
        ifsc: string;
        accountName: string;
      }): Promise<PaymentMethods> {
        const body = bankAccountBodySchema.parse(data);
        return paymentMethodsResponseSchema.parse(await patch("/api/creator/payment-methods/bank", body));
      },

      async getKyc(): Promise<KycRecord> {
        return parseKyc(await get("/api/creator/kyc"));
      },

      async submitKyc(data: { panUrl: string; aadhaarUrl: string }): Promise<KycRecord> {
        const body = kycBodySchema.parse(data);
        return parseKyc(await post("/api/creator/kyc", body));
      },

      async updateNotificationPreferences(preferences: Record<string, boolean>): Promise<Record<string, boolean>> {
        const body = notificationPreferencesBodySchema.parse({ preferences });
        return notificationPreferencesResponseSchema.parse(
          await patch("/api/creator/notification-preferences", body),
        ).preferences;
      },

      async logoutAll(): Promise<void> {
        await post("/api/auth/logout-all");
      },

      async changeEmail(newEmail: string): Promise<void> {
        const body = changeEmailBodySchema.parse({ newEmail });
        await post("/api/creator/change-email", body);
      },

      async presignUpload(data: {
        type: "avatar" | "kyc" | "deliverable";
        filename: string;
        campaignId?: string;
      }): Promise<UploadPresignResponse> {
        const body = uploadPresignBodySchema.parse(data);
        return uploadPresignResponseSchema.parse(await post("/api/uploads/presign", body));
      },

      async getNotifications(limit?: number): Promise<Notification[]> {
        return parseNotifications(await get(withQuery("/api/creator/notifications", {
          limit: limit === undefined ? undefined : String(limit),
        })));
      },

      async markNotificationRead(id: string): Promise<void> {
        await patch(`/api/creator/notifications/${encodeURIComponent(id)}/read`);
      },

      async markAllNotificationsRead(): Promise<void> {
        await patch("/api/creator/notifications/read-all");
      },
    },

    brand,

    async registerPushToken(token: string, platform: "ios" | "android" | "web"): Promise<void> {
      await post("/api/push-tokens", { token, platform });
    },

    async uploadToPresignedUrl(uploadUrl: string): Promise<void> {
      const url = z.string().url().parse(uploadUrl);
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "image/jpeg",
        },
        body: "",
      });
      if (!response.ok) {
        throw new ApiError(response.status, await readErrorMessage(response));
      }
    },
  };
}
