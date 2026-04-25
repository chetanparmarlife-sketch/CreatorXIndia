export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    role: string;
    email: string;
  };
}

export interface CreatorProfile {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  niches: string[];
  languages: string[];
  followerCount: number;
  avatarUrl: string | null;
  profileComplete: boolean;
  role: "creator";
}

export interface BrandProfile {
  id: string;
  email: string;
  companyName: string;
  industry: string;
  websiteUrl: string | null;
  gstin?: string | null;
  logoUrl?: string | null;
  walletBalancePaise: number;
  role: "brand";
}

export interface Campaign {
  id: string;
  brandId: string;
  brandName?: string | null;
  title: string;
  description: string;
  niche: string;
  platforms: string[];
  deliverableType: string;
  budgetPaise: number;
  maxCreators: number;
  applicantCount?: number;
  applicationDeadline: string;
  status: string;
  briefUrl?: string | null;
  createdAt: string;
}

export interface HomeStats {
  activeApplications: number;
  pendingDeliverables: number;
  availableForWithdrawalPaise: number;
}

export interface PaginatedCampaigns {
  campaigns: Campaign[];
  nextCursor: string | null;
}

export interface CreatorApplication {
  applicationId: string;
  campaignId: string;
  status: string;
  appliedAt: string;
  brandName: string | null;
  deliverableStatus: string | null;
  campaign: Campaign;
}

export interface Application {
  id: string;
  campaignId: string;
  creatorId: string;
  pitch: string;
  status: string;
  appliedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface Deliverable {
  id: string;
  applicationId: string;
  campaignId: string;
  creatorId: string;
  deliverableType: string;
  contentUrl: string | null;
  notes: string | null;
  status: string;
  submittedAt: string | null;
  decidedAt: string | null;
  liveUrl: string | null;
}

export interface CampaignDetail {
  campaign: Campaign;
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  application: Application | null;
}

export interface Thread {
  id: string;
  campaignId: string | null;
  brandId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  brand: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  campaign: {
    id: string;
    title: string;
  } | null;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderRole: "creator" | "brand" | "system";
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface EarningsSummary {
  totalEarnedPaise: number;
  pendingPaise: number;
  availableForWithdrawalPaise: number;
  transactions: EarningTransaction[];
}

export interface EarningTransaction {
  id: string;
  amountPaise: number;
  type: string;
  description: string;
  createdAt: string;
  status: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data?: Record<string, string>;
}

export interface DashboardStats {
  activeCampaigns: number;
  totalSpentPaise: number;
  pendingApplications: number;
  approvedDeliverables: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
