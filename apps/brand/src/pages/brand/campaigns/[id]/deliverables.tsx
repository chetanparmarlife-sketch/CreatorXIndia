import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type DeliverableFilter = "all" | "pending" | "approved" | "rejected";

type CampaignDeliverablesResponse = {
  campaign: {
    id: string;
    title: string;
  };
  deliverables: Array<{
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
  }>;
};

const FILTER_TABS: Array<{ value: DeliverableFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function statusClass(status: "pending" | "approved" | "rejected"): string {
  if (status === "pending") return "bg-amber-500/15 text-amber-500";
  if (status === "approved") return "bg-emerald-500/15 text-emerald-500";
  return "bg-red-500/15 text-red-500";
}

export default function CampaignDeliverablesPage() {
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/brands/${brandId}` : "";
  const [brandMatched, brandParams] = useRoute<{ id: string }>("/campaigns/:id/deliverables");
  const [adminMatched, adminParams] = useRoute<{ brandId: string; id: string }>("/brands/:brandId/campaigns/:id/deliverables");
  const matched = brandMatched || adminMatched;
  const campaignId = brandParams?.id ?? adminParams?.id ?? "";
  const [activeFilter, setActiveFilter] = useState<DeliverableFilter>("all");
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const { data, isLoading } = useQuery<CampaignDeliverablesResponse>({
    queryKey: ["brand", brandId, "campaigns", campaignId, "deliverables", activeFilter],
    enabled: matched && campaignId.length > 0,
    queryFn: async () => {
      const path =
        activeFilter === "all"
          ? `/api/brand/campaigns/${campaignId}/deliverables`
          : `/api/brand/campaigns/${campaignId}/deliverables?status=${activeFilter}`;
      const res = await apiRequest("GET", path);
      return res.json() as Promise<CampaignDeliverablesResponse>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: {
      deliverableId: string;
      status: "approved" | "rejected";
      rejection_reason?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/brand/deliverables/${payload.deliverableId}/status`, {
        status: payload.status,
        rejection_reason: payload.rejection_reason,
      });
      return res.json() as Promise<{ deliverable: { id: string } }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId, "deliverables"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId, "stats"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "campaigns", campaignId] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not update deliverable status";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    },
  });

  if (!matched) return null;

  const campaignTitle = data?.campaign.title || "Campaign";
  const deliverables = data?.deliverables ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Link
          href={`${brandBasePath}/campaigns/${campaignId}`}
          className="inline-flex items-center text-sm font-medium text-primary underline"
          data-testid="link-back-to-campaign"
        >
          Back to campaign
        </Link>

        <h1 className="text-3xl font-bold">{campaignTitle} - Deliverables</h1>

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
          {isLoading && <div className="text-sm text-muted-foreground">Loading deliverables...</div>}

          {!isLoading && deliverables.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No deliverables found for this filter.
            </div>
          )}

          {deliverables.map((deliverable) => {
            const reasonValue = rejectionReasons[deliverable.id] ?? "";

            return (
              <div
                key={deliverable.id}
                className="rounded-2xl border border-border bg-card p-5"
                data-testid={`deliverable-row-${deliverable.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <img
                      src={deliverable.avatar_url || ""}
                      alt=""
                      className="h-12 w-12 rounded-full bg-muted object-cover"
                    />
                    <div className="min-w-0 space-y-2">
                      <div className="font-semibold truncate">{deliverable.display_name}</div>
                      <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                        {deliverable.deliverable_type}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {deliverable.submitted_at ? `Submitted ${timeAgo(deliverable.submitted_at)}` : "Not submitted yet"}
                      </div>

                      {deliverable.status === "pending" && (
                        <textarea
                          value={reasonValue}
                          onChange={(event) =>
                            setRejectionReasons((current) => ({
                              ...current,
                              [deliverable.id]: event.target.value,
                            }))
                          }
                          placeholder="Reason required if rejecting"
                          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          data-testid={`input-rejection-reason-${deliverable.id}`}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide", statusClass(deliverable.status))}>
                      {deliverable.status}
                    </span>

                    {deliverable.content_url ? (
                      <a
                        href={deliverable.content_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-primary underline"
                        data-testid={`link-preview-${deliverable.id}`}
                      >
                        Preview
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">No preview</span>
                    )}

                    {deliverable.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const reason = reasonValue.trim();
                            if (!reason) {
                              toast({ title: "Rejection reason required", variant: "destructive" });
                              return;
                            }
                            statusMutation.mutate({
                              deliverableId: deliverable.id,
                              status: "rejected",
                              rejection_reason: reason,
                            });
                          }}
                          disabled={statusMutation.isPending}
                          data-testid={`btn-reject-${deliverable.id}`}
                        >
                          Reject
                        </Button>

                        <Button
                          type="button"
                          onClick={() => statusMutation.mutate({ deliverableId: deliverable.id, status: "approved" })}
                          disabled={statusMutation.isPending}
                          data-testid={`btn-approve-${deliverable.id}`}
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
