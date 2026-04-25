import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { fmtCompact, fmtMoney } from "@/lib/format";
import { isFinanceOnly, isReadOnly, useAdminRole } from "@/hooks/useAdminRole";
import { apiRequest } from "@/lib/queryClient";

type AdminDashboardStats = {
  totalBrands: number;
  activeCampaigns: number;
  totalCreators: number;
  platformRevenuePaise: number;
  campaignSignups30d: Array<{ date: string; count: number }>;
  revenue30d: Array<{ date: string; amountPaise: number }>;
};

export default function AdminDashboardPage() {
  const role = useAdminRole();
  const financeOnly = isFinanceOnly(role);
  const readOnly = isReadOnly(role);
  const { data, isLoading } = useQuery<AdminDashboardStats>({
    queryKey: ["/api/admin/dashboard-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard-stats");
      return res.json() as Promise<AdminDashboardStats>;
    },
  });

  if (isLoading || !data) {
    return (
      <AdminShell title="Dashboard">
        <div className="flex h-96 items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Overview" subtitle="Platform-wide CreatorX health">
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Brands" value={fmtCompact(data.totalBrands)} testId="kpi-total-brands" href={financeOnly ? undefined : "/admin/brands"} />
        <KpiCard label="Active Campaigns" value={fmtCompact(data.activeCampaigns)} testId="kpi-active-campaigns" href={financeOnly ? undefined : "/admin/campaigns"} />
        <KpiCard label="Total Creators" value={fmtCompact(data.totalCreators)} testId="kpi-total-creators" href={financeOnly ? undefined : "/admin/creators"} />
        <KpiCard label="Platform Revenue" value={fmtMoney(data.platformRevenuePaise, { compact: true })} testId="kpi-platform-revenue" href="/admin/payouts" />
      </div>

      {!financeOnly && !readOnly && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Admin operations can manage campaign, application, and deliverable overrides from the queue pages.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5" data-testid="chart-campaign-signups">
          <div className="mb-4">
            <h2 className="font-bold">Campaign signups</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.campaignSignups30d}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5" data-testid="chart-revenue">
          <div className="mb-4">
            <h2 className="font-bold">Revenue</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenue30d}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(value: number) => fmtMoney(value, { compact: true })} />
                <Tooltip formatter={(value: number) => fmtMoney(value)} />
                <Bar dataKey="amountPaise" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function KpiCard({ label, value, testId, href }: { label: string; value: string; testId: string; href?: string }) {
  const content = (
    <div className="rounded-2xl border border-border bg-card p-5 hover-elevate" data-testid={testId}>
      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );

  if (!href) return content;
  return <Link href={href}>{content}</Link>;
}
