import { z } from "zod";
import {
  ApiError,
  type AuthResponse,
  type BrandProfile,
  type Campaign,
  type CreatorApplication,
  type CreatorProfile,
  type DashboardStats,
  type EarningTransaction,
  type EarningsSummary,
  type HomeStats,
  type Notification,
  type PaginatedCampaigns,
} from "./types";

export { ApiError } from "./types";
export type {
  AuthResponse,
  BrandProfile,
  Campaign,
  CreatorApplication,
  CreatorProfile,
  DashboardStats,
  EarningTransaction,
  EarningsSummary,
  HomeStats,
  Notification,
  PaginatedCampaigns,
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
  transactions: z.array(rawTransactionSchema).optional().default([]),
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
    transactions,
  };
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

      async getCampaignDetail(id: string): Promise<Campaign> {
        return parseCampaignDetail(await get(`/api/campaigns/${encodeURIComponent(id)}`));
      },

      async getMyApplications(status?: string): Promise<CreatorApplication[]> {
        return parseCreatorApplications(await get(withQuery("/api/creator/my-campaigns", { status })));
      },

      async getEarnings(): Promise<EarningsSummary> {
        return parseEarnings(await get("/api/creator/earnings"));
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
  };
}
