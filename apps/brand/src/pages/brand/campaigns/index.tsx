import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Campaign } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBrandContext } from "@/hooks/useBrandContext";

type CampaignFilter = "all" | "draft" | "active" | "paused" | "completed";

type BrandCampaignListItem = Campaign & {
  applicant_count: number;
};

const FILTER_TABS: Array<{ value: CampaignFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

function toUiStatus(status: Campaign["status"]): "draft" | "active" | "paused" | "completed" {
  if (status === "open") return "active";
  if (status === "closed") return "paused";
  if (status === "completed") return "completed";
  return "draft";
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CampaignListPage() {
  const [, navigate] = useLocation();
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/brands/${brandId}` : "";
  const [filter, setFilter] = useState<CampaignFilter>("all");

  const { data, isLoading } = useQuery<{ campaigns: BrandCampaignListItem[] }>({
    queryKey: ["brand", brandId, "campaigns", filter],
    queryFn: async () => {
      const path = filter === "all" ? "/api/brand/campaigns" : `/api/brand/campaigns?status=${filter}`;
      const res = await apiRequest("GET", path);
      return res.json() as Promise<{ campaigns: BrandCampaignListItem[] }>;
    },
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <Button onClick={() => navigate(`${brandBasePath}/campaigns/new`)} data-testid="btn-create-campaign">
            Create Campaign
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={cn(
                "h-10 rounded-full border px-4 text-sm font-semibold transition-colors",
                filter === tab.value
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
          {isLoading && <div className="text-sm text-muted-foreground">Loading campaigns...</div>}

          {!isLoading && campaigns.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No campaigns found for this filter.
            </div>
          )}

          {campaigns.map((campaign) => {
            const uiStatus = toUiStatus(campaign.status);
            const budgetPaise = campaign.base_earning_cents * Math.max(campaign.slots_total, 1);

            return (
              <div
                key={campaign.id}
                className="rounded-2xl border border-border bg-card p-5"
                data-testid={`campaign-card-${campaign.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{campaign.title}</h2>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                        uiStatus === "active" && "bg-emerald-500/15 text-emerald-500",
                        uiStatus === "paused" && "bg-amber-500/15 text-amber-500",
                        uiStatus === "draft" && "bg-slate-500/15 text-slate-500",
                        uiStatus === "completed" && "bg-blue-500/15 text-blue-500",
                      )}
                    >
                      {uiStatus}
                    </span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => navigate(`${brandBasePath}/campaigns/${campaign.id}`)}
                    data-testid={`btn-view-campaign-${campaign.id}`}
                  >
                    View
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide">Budget</div>
                    <div className="text-base font-semibold text-foreground">{fmtMoney(budgetPaise)}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide">Application Deadline</div>
                    <div className="text-base font-semibold text-foreground">{formatDeadline(campaign.apply_deadline)}</div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide">Applicants</div>
                    <div className="text-base font-semibold text-foreground">{campaign.applicant_count}</div>
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
