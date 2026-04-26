import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/format";
import { canOverride, isFinanceOnly, isReadOnly, useAdminRole } from "@/hooks/useAdminRole";
import type { Application, Campaign, Profile } from "@creatorx/schema";

type AdminApplication = Application & {
  creator: Profile | null;
  campaign: Campaign | null;
  brand: { id: string; name: string } | null;
};

function uiStatus(status: Application["status"]): "pending" | "approved" | "rejected" {
  if (status === "accepted") return "approved";
  if (status === "rejected" || status === "withdrawn") return "rejected";
  return "pending";
}

export default function AdminApplicationsPage() {
  const role = useAdminRole();
  const canShowOverrides = canOverride(role) && !isReadOnly(role) && !isFinanceOnly(role);

  const { data, isLoading } = useQuery<{ applications: AdminApplication[] }>({
    queryKey: ["/api/admin/applications"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/applications");
      return res.json() as Promise<{ applications: AdminApplication[] }>;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/admin/applications/${id}/status`, { status });
      return res.json() as Promise<{ application: Application }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
    },
  });

  const applications = data?.applications ?? [];

  return (
    <AdminShell title="Applications" subtitle={`${applications.length} total`}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Brand</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3 text-right">Overrides</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading applications...</td></tr>
            )}
            {!isLoading && applications.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No applications found.</td></tr>
            )}
            {applications.map((application) => {
              const status = uiStatus(application.status);
              return (
                <tr key={application.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-4 font-semibold">{application.creator?.full_name ?? "Unknown creator"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{application.campaign?.title ?? "Unknown campaign"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{application.brand?.name ?? "Unknown brand"}</td>
                  <td className="px-4 py-4"><span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{status}</span></td>
                  <td className="px-4 py-4 text-muted-foreground">{fmtDate(application.applied_at)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      {canShowOverrides && status !== "approved" && (
                        <Button size="sm" onClick={() => statusMutation.mutate({ id: application.id, status: "approved" })} data-testid={`btn-override-approve-${application.id}`}>Approve</Button>
                      )}
                      {canShowOverrides && status !== "rejected" && (
                        <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate({ id: application.id, status: "rejected" })} data-testid={`btn-override-reject-${application.id}`}>Reject</Button>
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
