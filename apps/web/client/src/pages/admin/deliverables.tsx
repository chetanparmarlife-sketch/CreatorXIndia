import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/format";
import { canOverride, isFinanceOnly, isReadOnly, useAdminRole } from "@/hooks/useAdminRole";
import type { Campaign, Deliverable, Profile } from "@creatorx/schema";

type AdminDeliverable = Deliverable & {
  creator: Profile | null;
  campaign: Campaign | null;
  brand: { id: string; name: string } | null;
};

export default function AdminDeliverablesPage() {
  const role = useAdminRole();
  const canShowOverrides = canOverride(role) && !isReadOnly(role) && !isFinanceOnly(role);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<{ deliverables: AdminDeliverable[] }>({
    queryKey: ["/api/admin/deliverables"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/deliverables");
      return res.json() as Promise<{ deliverables: AdminDeliverable[] }>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: "approved" | "rejected"; rejection_reason?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/deliverables/${id}/status`, { status, rejection_reason });
      return res.json() as Promise<{ deliverable: Deliverable }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/deliverables"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
    },
  });

  const deliverables = data?.deliverables ?? [];

  return (
    <AdminShell title="Deliverables" subtitle={`${deliverables.length} total`}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3 text-right">Overrides</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading deliverables...</td></tr>
            )}
            {!isLoading && deliverables.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No deliverables found.</td></tr>
            )}
            {deliverables.map((deliverable) => {
              const reason = rejectionReasons[deliverable.id] ?? "";
              return (
                <tr key={deliverable.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-4 font-semibold">{deliverable.creator?.full_name ?? "Unknown creator"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{deliverable.campaign?.title ?? "Unknown campaign"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{deliverable.brand?.name ?? "Unknown brand"}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{deliverable.status}</span></td>
                  <td className="px-4 py-4 text-muted-foreground">{deliverable.submitted_at ? fmtDate(deliverable.submitted_at) : "-"}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-end gap-2">
                      {canShowOverrides && deliverable.status !== "approved" && (
                        <Button size="sm" onClick={() => statusMutation.mutate({ id: deliverable.id, status: "approved" })} data-testid={`btn-override-approve-${deliverable.id}`}>Approve</Button>
                      )}
                      {canShowOverrides && deliverable.status !== "rejected" && (
                        <>
                          <Textarea
                            value={reason}
                            onChange={(event) => setRejectionReasons((current) => ({ ...current, [deliverable.id]: event.target.value }))}
                            placeholder="Rejection reason"
                            className="min-h-20 w-64 bg-background"
                            data-testid={`input-rejection-reason-${deliverable.id}`}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => statusMutation.mutate({ id: deliverable.id, status: "rejected", rejection_reason: reason })}
                            data-testid={`btn-override-reject-${deliverable.id}`}
                          >
                            Reject
                          </Button>
                        </>
                      )}
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
