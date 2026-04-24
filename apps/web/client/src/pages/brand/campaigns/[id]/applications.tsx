import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type ApplicationFilter = "all" | "pending" | "approved" | "rejected";

type CampaignApplicationsResponse = {
  campaign: {
    id: string;
    title: string;
  };
  applications: Array<{
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
  }>;
};

const FILTER_TABS: Array<{ value: ApplicationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function formatFollowerCount(count: number): string {
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}K`;
  }
  return `${count}`;
}

function statusClass(status: "pending" | "approved" | "rejected"): string {
  if (status === "pending") return "bg-amber-500/15 text-amber-500";
  if (status === "approved") return "bg-emerald-500/15 text-emerald-500";
  return "bg-red-500/15 text-red-500";
}

export default function CampaignApplicationsPage() {
  const [matched, params] = useRoute<{ id: string }>("/brand/campaigns/:id/applications");
  const campaignId = params?.id ?? "";
  const [activeFilter, setActiveFilter] = useState<ApplicationFilter>("all");

  const { data, isLoading } = useQuery<CampaignApplicationsResponse>({
    queryKey: ["brand", "campaigns", campaignId, "applications", activeFilter],
    enabled: matched && campaignId.length > 0,
    queryFn: async () => {
      const path =
        activeFilter === "all"
          ? `/api/brand/campaigns/${campaignId}/applications`
          : `/api/brand/campaigns/${campaignId}/applications?status=${activeFilter}`;
      const res = await apiRequest("GET", path);
      return res.json() as Promise<CampaignApplicationsResponse>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { applicationId: string; status: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/brand/applications/${payload.applicationId}/status`, {
        status: payload.status,
      });
      return res.json() as Promise<{ application: { id: string } }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", "campaigns", campaignId, "applications"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", "campaigns", campaignId, "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", "campaigns", campaignId] }),
      ]);
    },
  });

  if (!matched) return null;

  const campaignTitle = data?.campaign.title || "Campaign";
  const applications = data?.applications ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Link
          href={`/brand/campaigns/${campaignId}`}
          className="inline-flex items-center text-sm font-medium text-primary underline"
          data-testid="link-back-to-campaign"
        >
          Back to campaign
        </Link>

        <h1 className="text-3xl font-bold">{campaignTitle} - Applications</h1>

        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                activeFilter === tab.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
              data-testid={`tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {isLoading && <div className="text-sm text-muted-foreground">Loading applications...</div>}

          {!isLoading && applications.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No applications found for this filter.
            </div>
          )}

          {applications.map((application) => {
            const handle = application.handle.startsWith("@") ? application.handle : `@${application.handle}`;

            return (
              <div
                key={application.id}
                className="rounded-2xl border border-border bg-card p-5"
                data-testid={`application-row-${application.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <img
                      src={application.avatar_url || ""}
                      alt=""
                      className="h-12 w-12 rounded-full bg-muted object-cover"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="font-semibold truncate">{application.display_name}</div>
                      <div className="text-sm text-muted-foreground truncate">{handle}</div>
                      <div className="text-sm text-muted-foreground">{formatFollowerCount(application.follower_count)} followers</div>
                      <div className="flex flex-wrap gap-2">
                        {application.niches.slice(0, 3).map((niche) => (
                          <span key={niche} className="rounded-full bg-muted px-2 py-1 text-xs">
                            {niche}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground">Applied {timeAgo(application.applied_at)}</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", statusClass(application.status))}>
                      {application.status}
                    </span>

                    <Link
                      href={`/brand/creators/${application.creator_id}`}
                      className="text-sm font-medium text-primary underline"
                      data-testid={`link-profile-${application.id}`}
                    >
                      View Profile
                    </Link>

                    {application.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => statusMutation.mutate({ applicationId: application.id, status: "rejected" })}
                          disabled={statusMutation.isPending}
                          data-testid={`btn-reject-${application.id}`}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          onClick={() => statusMutation.mutate({ applicationId: application.id, status: "approved" })}
                          disabled={statusMutation.isPending}
                          data-testid={`btn-approve-${application.id}`}
                        >
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
