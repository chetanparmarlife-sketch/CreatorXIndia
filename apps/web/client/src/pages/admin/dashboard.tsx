import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { fmtMoney, fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

type Summary = {
  activeCampaigns: number;
  creators: number;
  verifiedCreators: number;
  gmvCents: number;
  pendingPayouts: number;
  pendingPayoutCents: number;
  pendingApplications: number;
  pendingDeliverables: number;
  daily: { date: string; cents: number }[];
};

export default function AdminDashboardPage() {
  const { data } = useQuery<Summary>({ queryKey: ["/api/admin/summary"] });

  if (!data) {
    return (
      <AdminShell title="Dashboard">
        <div className="h-96 flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.cents));
  const total30 = data.daily.reduce((a, d) => a + d.cents, 0);

  return (
    <AdminShell title="Overview" subtitle="What's happening across CreatorX right now">
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="paid"
          label="GMV lifetime"
          value={fmtMoney(data.gmvCents, { compact: true })}
          accent
          href="/admin/payouts"
        />
        <StatCard
          icon="campaign"
          label="Active campaigns"
          value={String(data.activeCampaigns)}
          href="/admin/campaigns"
        />
        <StatCard
          icon="groups"
          label="Creators"
          value={fmtCompact(data.creators)}
          sub={`${data.verifiedCreators} verified`}
          href="/admin/creators"
        />
        <StatCard
          icon="account_balance_wallet"
          label="Pending payouts"
          value={fmtMoney(data.pendingPayoutCents)}
          sub={`${data.pendingPayouts} requests`}
          href="/admin/payouts"
          warn={data.pendingPayouts > 0}
        />
      </div>

      {/* Queues */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <QueueCard
          label="Applications awaiting decision"
          count={data.pendingApplications}
          icon="fact_check"
          href="/admin/applications"
        />
        <QueueCard
          label="Deliverables in review"
          count={data.pendingDeliverables}
          icon="movie"
          href="/admin/deliverables"
        />
      </div>

      {/* Chart */}
      <section className="bg-card border border-border rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
              Earnings · last 30 days
            </div>
            <div className="text-3xl font-black mt-1">{fmtMoney(total30)}</div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-500/15 rounded-full px-2.5 py-1">
            <Icon name="trending_up" className="text-[14px]" />
            Trending
          </div>
        </div>
        <div className="flex items-end gap-1 h-40">
          {data.daily.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full relative" style={{ height: "100%" }}>
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 rounded transition-all",
                    i === data.daily.length - 1 ? "bg-primary" : "bg-primary/50"
                  )}
                  style={{ height: `${(d.cents / maxDaily) * 100}%`, minHeight: d.cents > 0 ? 2 : 1 }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-semibold mt-2">
          <span>{new Date(data.daily[0].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span>Today</span>
        </div>
      </section>
    </AdminShell>
  );
}

function StatCard({ icon, label, value, sub, accent, warn, href }: {
  icon: string; label: string; value: string; sub?: string; accent?: boolean; warn?: boolean; href?: string;
}) {
  const Wrapper: any = href ? Link : "div";
  return (
    <Wrapper
      href={href}
      className={cn(
        "block p-5 bg-card border border-border rounded-2xl hover-elevate transition-colors",
        warn && "border-amber-500/40",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "size-10 rounded-xl flex items-center justify-center",
          accent ? "bg-primary/15 text-primary" : warn ? "bg-amber-500/15 text-amber-400" : "bg-muted text-muted-foreground"
        )}>
          <Icon name={icon} filled className="text-[18px]" />
        </div>
        {href && <Icon name="arrow_forward" className="text-muted-foreground text-[16px]" />}
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Wrapper>
  );
}

function QueueCard({ label, count, icon, href }: { label: string; count: number; icon: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 p-5 bg-card border border-border rounded-2xl hover-elevate">
      <div className="size-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
        <Icon name={icon} filled className="text-[22px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground font-semibold">{label}</div>
        <div className="text-2xl font-black">{count}</div>
      </div>
      <Icon name="chevron_right" className="text-muted-foreground" />
    </Link>
  );
}
