import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import type { CampaignStatus, SocialPlatform } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate, fmtMoney } from "@/lib/format";
import { Icon } from "@/components/brand";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type CreatorProfileResponse = {
  profile: {
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
  };
  stats: {
    campaignsCompleted: number;
    averageRating: number;
    totalEarningsPaise: number;
  };
  portfolio: Array<{
    deliverableId: string;
    campaignTitle: string;
    deliverableType: string;
    contentUrl: string;
    approvedAt: string;
  }>;
};

type ActiveCampaign = {
  id: string;
  title: string;
  status: CampaignStatus;
};

function formatFollowerCount(value: number): string {
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const scaled = value / 1_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}K`;
  }
  return `${value}`;
}

function platformIcon(platform: SocialPlatform): string {
  if (platform === "instagram") return "photo_camera";
  if (platform === "youtube") return "smart_display";
  if (platform === "twitter") return "alternate_email";
  return "work";
}

export default function CreatorProfilePage() {
  const { brandId } = useBrandContext();
  const [matched, params] = useRoute<{ creatorId: string }>("/creators/:creatorId");
  const { toast } = useToast();
  const creatorId = params?.creatorId ?? "";
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  const creatorQuery = useQuery<CreatorProfileResponse>({
    queryKey: ["brand", brandId, "creator-profile", creatorId],
    enabled: matched && creatorId.length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/brand/creators/${creatorId}`);
      return res.json() as Promise<CreatorProfileResponse>;
    },
  });

  const activeCampaignsQuery = useQuery<{ campaigns: ActiveCampaign[] }>({
    queryKey: ["brand", brandId, "campaigns", "active", "invite-picker"],
    enabled: isInviteDialogOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/campaigns?status=active");
      return res.json() as Promise<{ campaigns: ActiveCampaign[] }>;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiRequest("POST", `/api/brand/campaigns/${campaignId}/invite`, { creatorId });
      return res.json() as Promise<{ application: { id: string } }>;
    },
    onSuccess: async (_data, campaignId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId, "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "creator-profile", creatorId] }),
      ]);
      setIsInviteDialogOpen(false);
      setSelectedCampaignId("");
      toast({ title: "Invite sent" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not send invite";
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    },
  });

  if (!matched) return null;

  if (creatorQuery.isLoading || !creatorQuery.data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto w-full max-w-6xl text-sm text-muted-foreground">
          {creatorQuery.isError ? "Could not load creator profile." : "Loading creator profile..."}
        </div>
      </div>
    );
  }

  const { profile, stats, portfolio } = creatorQuery.data;
  const activeCampaigns = (activeCampaignsQuery.data?.campaigns ?? []).filter((campaign) => campaign.status === "open");

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <img
                src={profile.avatar_url || ""}
                alt=""
                className="h-20 w-20 rounded-full bg-muted object-cover"
              />
              <div className="min-w-0 space-y-2">
                <h1 className="text-2xl font-bold truncate">{profile.display_name}</h1>
                <p className="text-sm text-muted-foreground">{profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`}</p>
                {profile.bio && <p className="text-sm text-foreground">{profile.bio}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatFollowerCount(profile.follower_count)} followers</span>
                  <span>{formatFollowerCount(profile.following_count)} following</span>
                  <span>{profile.avg_engagement_rate.toFixed(1)}% avg engagement</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.platforms.map((platform) => {
                    if (!platform.url) {
                      return (
                        <span
                          key={platform.platform}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                        >
                          <Icon name={platformIcon(platform.platform)} className="text-[16px]" />
                        </span>
                      );
                    }

                    return (
                      <a
                        key={platform.platform}
                        href={platform.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted hover:bg-muted/80"
                        data-testid={`link-platform-${platform.platform}`}
                      >
                        <Icon name={platformIcon(platform.platform)} className="text-[16px]" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => setIsInviteDialogOpen(true)}
              data-testid="btn-invite-to-campaign"
            >
              Invite to Campaign
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-semibold">Niches & Languages</h2>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Niches</p>
            <div className="flex flex-wrap gap-2">
              {profile.niches.map((niche) => (
                <span
                  key={niche}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                  data-testid={`niche-badge-${niche.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {niche}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Languages</p>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((language) => (
                <span
                  key={language}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium"
                  data-testid={`language-badge-${language.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {language}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Campaigns Completed"
            value={stats.campaignsCompleted.toString()}
            testId="stat-campaigns-completed"
          />
          <StatCard
            title="Average Rating"
            value={`${stats.averageRating.toFixed(1)} / 5`}
            testId="stat-average-rating"
          />
          <StatCard
            title="Total Earnings"
            value={fmtMoney(stats.totalEarningsPaise)}
            testId="stat-total-earnings"
          />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-semibold">Past Work</h2>
          {portfolio.length === 0 ? (
            <div className="text-sm text-muted-foreground">No approved public deliverables yet.</div>
          ) : (
            <div className="space-y-3">
              {portfolio.map((item) => (
                <article
                  key={item.deliverableId}
                  className="rounded-xl border border-border p-4"
                  data-testid={`portfolio-item-${item.deliverableId}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{item.campaignTitle}</p>
                      <p className="text-sm text-muted-foreground capitalize">{item.deliverableType}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{fmtDate(item.approvedAt)}</p>
                  </div>
                  <a
                    href={item.contentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-sm font-medium text-primary underline"
                    data-testid={`link-portfolio-${item.deliverableId}`}
                  >
                    Open content
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {isInviteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold">Invite to Campaign</h3>
            <div className="mt-4 space-y-3">
              <label htmlFor="invite-campaign-select" className="text-sm text-muted-foreground">
                Select active campaign
              </label>
              <select
                id="invite-campaign-select"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedCampaignId}
                onChange={(event) => setSelectedCampaignId(event.target.value)}
                data-testid="select-campaign"
              >
                <option value="">Choose campaign</option>
                {activeCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsInviteDialogOpen(false);
                    setSelectedCampaignId("");
                  }}
                  data-testid="btn-cancel-invite"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => inviteMutation.mutate(selectedCampaignId)}
                  disabled={!selectedCampaignId || inviteMutation.isPending}
                  data-testid="btn-send-invite"
                >
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, testId }: { title: string; value: string; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" data-testid={testId}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
