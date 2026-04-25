import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { fmtMoney, timeAgo } from "@/lib/format";
import { useBrandContext } from "@/hooks/useBrandContext";

interface BrandDashboardStats {
  activeCampaigns: number;
  totalSpentPaise: number;
  pendingApplications: number;
  approvedDeliverables: number;
}

export default function BrandDashboardPage() {
  const [, navigate] = useLocation();
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/admin/brands/${brandId}` : "/brand";

  const { data: stats } = useQuery<BrandDashboardStats>({
    queryKey: ["/api/brand/dashboard-stats", brandId],
  });

  const { data: activityData } = useQuery<{ activity: AuditLog[] }>({
    queryKey: ["/api/brand/activity", brandId],
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Brand dashboard</h1>
            <p className="text-muted-foreground mt-1">Track campaign performance and recent actions.</p>
          </div>
          <Button onClick={() => navigate(`${brandBasePath}/campaigns/new`)} data-testid="btn-create-campaign">
            Create Campaign
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Active Campaigns"
            value={stats?.activeCampaigns ?? 0}
            testId="kpi-active-campaigns"
          />
          <KpiCard
            title="Total Spent"
            value={fmtMoney(stats?.totalSpentPaise ?? 0)}
            testId="kpi-total-spent"
          />
          <KpiCard
            title="Pending Applications"
            value={stats?.pendingApplications ?? 0}
            testId="kpi-pending-applications"
          />
          <KpiCard
            title="Approved Deliverables"
            value={stats?.approvedDeliverables ?? 0}
            testId="kpi-approved-deliverables"
          />
        </div>

        <section className="rounded-2xl border border-border bg-card p-5" data-testid="activity-feed">
          <h2 className="text-xl font-semibold mb-4">Recent activity</h2>
          <div className="space-y-3">
            {(activityData?.activity ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              activityData?.activity.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="font-medium">{entry.action}</div>
                  <div className="text-muted-foreground">{entry.target_type}</div>
                  <div className="text-xs text-muted-foreground mt-1">{timeAgo(entry.created_at)}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiCard({ title, value, testId }: { title: string; value: string | number; testId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5" data-testid={testId}>
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
