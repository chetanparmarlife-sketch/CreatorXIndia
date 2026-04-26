import { useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { canApproveCampaigns, isFinanceOnly, isReadOnly, useAdminRole } from "@/hooks/useAdminRole";
import type { Campaign } from "@creatorx/schema";

type CampaignFilter = "all" | "draft" | "active" | "paused" | "completed";
type AdminCampaign = Campaign & {
  brand_name: string | null;
  brand: { id: string; name: string } | null;
};

const FILTER_TABS: Array<{ value: CampaignFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

function toUiStatus(status: Campaign["status"]): "draft" | "active" | "paused" | "completed" | "rejected" {
  if (status === "open") return "active";
  if (status === "closed") return "paused";
  if (status === "completed") return "completed";
  if (status === "rejected") return "rejected";
  return "draft";
}

function budgetForCampaign(campaign: Campaign): number {
  return campaign.base_earning_cents * Math.max(campaign.slots_total, 1);
}

export default function AdminCampaignsPage() {
  const role = useAdminRole();
  const [filter, setFilter] = useState<CampaignFilter>("all");
  const canChangeCampaigns = canApproveCampaigns(role) && !isReadOnly(role) && !isFinanceOnly(role);

  const { data, isLoading } = useQuery<{ campaigns: AdminCampaign[] }>({
    queryKey: ["/api/admin/campaigns", filter],
    queryFn: async () => {
      const path = filter === "all" ? "/api/admin/campaigns" : `/api/admin/campaigns?status=${filter}`;
      const res = await apiRequest("GET", path);
      return res.json() as Promise<{ campaigns: AdminCampaign[] }>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "rejected" | "paused" | "completed" }) => {
      const res = await apiRequest("PATCH", `/api/admin/campaigns/${id}/status`, { status });
      return res.json() as Promise<{ campaign: Campaign }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
    },
  });

  const campaigns = data?.campaigns ?? [];

  return (
    <AdminShell title="Campaigns" subtitle={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}>
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            className={cn(
              "h-9 rounded-lg px-4 text-xs font-bold uppercase tracking-widest hover-elevate",
              filter === tab.value ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground",
            )}
            data-testid={`tab-${tab.value}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading campaigns...</td></tr>
            )}
            {!isLoading && campaigns.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No campaigns found.</td></tr>
            )}
            {campaigns.map((campaign) => {
              const uiStatus = toUiStatus(campaign.status);
              return (
                <tr key={campaign.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-4 font-semibold">{campaign.title}</td>
                  <td className="px-4 py-4 text-muted-foreground">{campaign.brand_name ?? campaign.brand?.name ?? "Unknown"}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{uiStatus}</span></td>
                  <td className="px-4 py-4 font-semibold">{fmtMoney(budgetForCampaign(campaign))}</td>
                  <td className="px-4 py-4 text-muted-foreground">{fmtDate(campaign.created_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      {canChangeCampaigns && uiStatus === "draft" && (
                        <>
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: campaign.id, status: "active" })} data-testid={`btn-approve-campaign-${campaign.id}`}>Approve</Button>
                          <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate({ id: campaign.id, status: "rejected" })} data-testid={`btn-reject-campaign-${campaign.id}`}>Reject</Button>
                        </>
                      )}
                      {canChangeCampaigns && uiStatus === "active" && (
                        <Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: campaign.id, status: "paused" })} data-testid={`btn-pause-campaign-${campaign.id}`}>Pause</Button>
                      )}
                      <Link href={`/brands/${campaign.brand_id}/campaigns/${campaign.id}`}>
                        <Button size="sm" variant="outline" data-testid={`btn-view-campaign-${campaign.id}`}>View</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
