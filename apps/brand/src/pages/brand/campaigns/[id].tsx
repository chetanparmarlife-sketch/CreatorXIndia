import { Link, useLocation, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Campaign } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtCompact, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type ApplicantPreview = {
  applicationId: string;
  status: string;
  creator: {
    id: string;
    avatar_url: string | null;
    display_name: string;
    follower_count: number;
  };
};

type CampaignDetailResponse = {
  campaign: Campaign;
  applicants: ApplicantPreview[];
};

type CampaignStatsResponse = {
  totalApplications: number;
  pendingReview: number;
  approved: number;
  rejected: number;
};

function toUiStatus(status: Campaign["status"]): "draft" | "active" | "paused" | "completed" {
  if (status === "open") return "active";
  if (status === "closed") return "paused";
  if (status === "completed") return "completed";
  return "draft";
}

function deadlineLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function findBriefUrl(campaign: Campaign): string | null {
  const spec = campaign.deliverables[0]?.spec ?? "";
  const match = spec.match(/https?:\/\/\S+/);
  return match?.[0] ?? null;
}

function statusBadgeClass(status: ReturnType<typeof toUiStatus>): string {
  if (status === "active") return "bg-emerald-500/15 text-emerald-500";
  if (status === "paused") return "bg-amber-500/15 text-amber-500";
  if (status === "completed") return "bg-blue-500/15 text-blue-500";
  return "bg-slate-500/15 text-slate-500";
}

export default function CampaignDetailPage() {
  const [, navigate] = useLocation();
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/brands/${brandId}` : "";
  const [brandMatched, brandParams] = useRoute<{ id: string }>("/campaigns/:id");
  const [adminMatched, adminParams] = useRoute<{ brandId: string; id: string }>("/brands/:brandId/campaigns/:id");
  const { toast } = useToast();

  const matched = brandMatched || adminMatched;
  const campaignId = brandParams?.id ?? adminParams?.id ?? "";

  const { data: campaignData, isLoading } = useQuery<CampaignDetailResponse>({
    queryKey: ["brand", brandId, "campaigns", campaignId],
    enabled: matched && campaignId.length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/brand/campaigns/${campaignId}`);
      return res.json() as Promise<CampaignDetailResponse>;
    },
  });

  const { data: statsData } = useQuery<CampaignStatsResponse>({
    queryKey: ["brand", brandId, "campaigns", campaignId, "stats"],
    enabled: matched && campaignId.length > 0,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/brand/campaigns/${campaignId}/stats`);
      return res.json() as Promise<CampaignStatsResponse>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "paused" | "active") => {
      const res = await apiRequest("PATCH", `/api/brand/campaigns/${campaignId}/status`, { status });
      return res.json() as Promise<{ campaign: Campaign }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId, "stats"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not update campaign status";
      toast({ title: "Status update failed", description: message, variant: "destructive" });
    },
  });

  if (!matched) return null;

  if (isLoading || !campaignData?.campaign) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto w-full max-w-6xl text-sm text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  const campaign = campaignData.campaign;
  const uiStatus = toUiStatus(campaign.status);
  const budgetPaise = campaign.base_earning_cents * Math.max(campaign.slots_total, 1);
  const briefUrl = findBriefUrl(campaign);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{campaign.title}</h1>
              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", statusBadgeClass(uiStatus))}>
                {uiStatus}
              </span>
              <div className="text-sm text-muted-foreground">Budget: {fmtMoney(budgetPaise)}</div>
              <div className="text-sm text-muted-foreground">Deadline: {deadlineLabel(campaign.apply_deadline)}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uiStatus !== "draft"}
                data-testid="btn-edit-campaign"
              >
                Edit
              </Button>

              {uiStatus === "active" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => statusMutation.mutate("paused")}
                  disabled={statusMutation.isPending}
                  data-testid="btn-pause-campaign"
                >
                  Pause
                </Button>
              )}

              {uiStatus === "paused" && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => statusMutation.mutate("active")}
                  disabled={statusMutation.isPending}
                  data-testid="btn-reactivate-campaign"
                >
                  Reactivate
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(`${brandBasePath}/campaigns`)}
                data-testid="btn-back-campaigns"
              >
                Back to campaigns
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Applications" value={statsData?.totalApplications ?? 0} testId="stat-total-applications" />
          <StatCard title="Pending Review" value={statsData?.pendingReview ?? 0} testId="stat-pending-review" />
          <StatCard title="Approved" value={statsData?.approved ?? 0} testId="stat-approved" />
          <StatCard title="Rejected" value={statsData?.rejected ?? 0} testId="stat-rejected" />
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-semibold">Brief</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{campaign.description}</p>

          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Platforms</div>
            <div className="flex flex-wrap gap-2">
              {campaign.platforms.map((platform) => (
                <span key={platform} className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">
                  {platform}
                </span>
              ))}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Deliverable type: <span className="font-medium text-foreground">{campaign.deliverables[0]?.kind ?? "N/A"}</span>
          </div>

          {briefUrl && (
            <a
              href={briefUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary underline"
              data-testid="link-brief-url"
            >
              Open brief URL
            </a>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Applicants</h2>
            <Link
              href={`${brandBasePath}/campaigns/${campaign.id}/applications`}
              className="text-sm font-medium text-primary underline"
              data-testid="link-view-all-applicants"
            >
              View All
            </Link>
          </div>

          {campaignData.applicants.length === 0 ? (
            <div className="text-sm text-muted-foreground">No applicants yet.</div>
          ) : (
            <div className="space-y-3">
              {campaignData.applicants.map((applicant) => (
                <div
                  key={applicant.applicationId}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  data-testid={`applicant-row-${applicant.applicationId}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={applicant.creator.avatar_url || ""}
                      alt=""
                      className="h-10 w-10 rounded-full bg-muted object-cover"
                    />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{applicant.creator.display_name}</div>
                      <div className="text-xs text-muted-foreground">{fmtCompact(applicant.creator.follower_count)} followers</div>
                    </div>
                  </div>

                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize">
                    {applicant.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ title, value, testId }: { title: string; value: number; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" data-testid={testId}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
