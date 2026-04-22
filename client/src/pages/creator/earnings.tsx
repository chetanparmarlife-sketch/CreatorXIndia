import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CreatorShell,
  CreatorHeader,
  HeaderAvatar,
  HeaderIconButton,
  SectionHeader,
} from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { fmtMoney, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Transaction, Withdrawal } from "@shared/schema";

export default function EarningsPage() {
  const { user } = useAuth();
  const { data } = useQuery<{
    balance_cents: number;
    transactions: Transaction[];
    withdrawals: Withdrawal[];
  }>({
    queryKey: ["/api/earnings"],
  });

  const transactions = data?.transactions || [];
  const withdrawals = data?.withdrawals || [];
  const balance = data?.balance_cents || 0;

  // last 6 months aggregated
  const monthlyData = aggregateMonthly(transactions);
  const maxCents = Math.max(1, ...monthlyData.map((d) => d.cents));

  const thisMonth = monthlyData[monthlyData.length - 1]?.cents || 0;
  const lastMonth = monthlyData[monthlyData.length - 2]?.cents || 0;
  const deltaPct = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  const { data: notifData } = useQuery<{ notifications: { read: boolean }[] }>({
    queryKey: ["/api/notifications"],
  });
  const unread = notifData?.notifications?.filter((n) => !n.read).length || 0;

  return (
    <CreatorShell>
      <CreatorHeader
        title="Earnings"
        subtitle="Track every rupee you earn"
        leading={<HeaderAvatar src={user?.avatar_url} />}
        trailing={
          <HeaderIconButton
            icon="notifications"
            href="/notifications"
            badge={unread > 0}
            label="Notifications"
            testId="link-notifications"
          />
        }
      />

      <div className="px-5 space-y-6 pb-4">
        {/* Balance hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#0a1f8a] p-6 text-white">
          <div
            className="absolute -top-16 -right-16 size-64 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
          />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/70">
              Available to withdraw
            </div>
            <div className="text-5xl font-black tracking-tight mt-1">{fmtMoney(balance)}</div>
            <div className="text-sm text-white/80 mt-1">
              Lifetime earned {fmtMoney(user?.total_earned_cents || 0)}
            </div>
            <div className="flex gap-3 mt-5">
              <Link
                href="/withdraw"
                className="flex-1 h-12 rounded-xl bg-white text-primary font-bold flex items-center justify-center gap-2 hover-elevate"
                data-testid="button-withdraw"
              >
                <Icon name="account_balance_wallet" filled className="text-[18px]" />
                Withdraw
              </Link>
              <button className="size-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center hover-elevate">
                <Icon name="file_download" className="text-[20px]" />
              </button>
            </div>
          </div>
        </div>

        {/* Monthly stats */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                This month
              </div>
              <div className="text-2xl font-black">{fmtMoney(thisMonth)}</div>
            </div>
            <div className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
              deltaPct >= 0 ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            )}>
              <Icon name={deltaPct >= 0 ? "arrow_upward" : "arrow_downward"} className="text-[14px]" />
              {Math.abs(deltaPct).toFixed(0)}%
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end" style={{ height: "100%" }}>
                    <div
                      className={cn(
                        "w-full rounded-lg transition-all",
                        i === monthlyData.length - 1 ? "bg-primary glow-primary" : "bg-muted"
                      )}
                      style={{ height: `${(m.cents / maxCents) * 100}%`, minHeight: m.cents > 0 ? 4 : 2 }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Withdrawals */}
        {withdrawals.length > 0 && (
          <section>
            <SectionHeader title="Withdrawals" />
            <div className="space-y-2">
              {withdrawals.slice(0, 5).map((w) => (
                <div key={w.id} className="p-3 bg-card border border-border rounded-2xl" data-testid={`withdrawal-${w.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center",
                      w.status === "paid" ? "bg-green-500/15 text-green-400" :
                      w.status === "rejected" ? "bg-red-500/15 text-red-400" :
                      "bg-amber-500/15 text-amber-300"
                    )}>
                      <Icon name={w.method === "upi" ? "send_money" : "account_balance"} filled className="text-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{w.method === "upi" ? "UPI" : "Bank transfer"} · {w.destination}</div>
                      <div className="text-xs text-muted-foreground">{timeAgo(w.requested_at)} · {w.status.toUpperCase()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{fmtMoney(w.net_cents)}</div>
                      <div className="text-[10px] text-muted-foreground">net</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pl-13">
                    <span>Gross: {fmtMoney(w.gross_cents)}</span>
                    {w.tds_cents > 0 && <span className="text-red-400">TDS −{fmtMoney(w.tds_cents)}</span>}
                    {w.gst_cents > 0 && <span className="text-green-400">GST +{fmtMoney(w.gst_cents)}</span>}
                    {w.utr && <span>UTR: {w.utr}</span>}
                    {w.invoice_number && <span>Inv: {w.invoice_number}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Transactions */}
        <section>
          <SectionHeader title="Recent activity" />
          {transactions.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="receipt_long" className="text-[40px] text-muted-foreground mb-2" />
              <div className="font-bold">No earnings yet</div>
              <p className="text-sm text-muted-foreground">Apply to a campaign to start earning.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 10).map((t) => <TransactionRow key={t.id} t={t} />)}
            </div>
          )}
        </section>
      </div>
    </CreatorShell>
  );
}

function TransactionRow({ t }: { t: Transaction }) {
  const iconMap: Record<string, string> = {
    earning: "payments",
    withdrawal: "account_balance",
    bonus: "stars",
    adjustment: "tune",
  };
  const isCredit = t.amount_cents > 0;
  return (
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
      <div className={cn(
        "size-10 rounded-xl flex items-center justify-center",
        isCredit ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      )}>
        <Icon name={iconMap[t.kind] || "receipt"} filled className="text-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate">{t.description}</div>
        <div className="text-xs text-muted-foreground">{timeAgo(t.created_at)}</div>
      </div>
      <div className="text-right">
        <div className={cn("font-bold", isCredit ? "text-green-400" : "text-foreground")}>
          {fmtMoney(t.amount_cents, { sign: true })}
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{t.status}</div>
      </div>
    </div>
  );
}

function aggregateMonthly(transactions: Transaction[]) {
  const now = new Date();
  const months: { label: string; cents: number; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    months.push({ label, cents: 0, key });
  }
  transactions
    .filter((t) => t.kind === "earning" && t.status === "completed")
    .forEach((t) => {
      const key = t.created_at.slice(0, 7);
      const m = months.find((m) => m.key === key);
      if (m) m.cents += t.amount_cents;
    });
  return months;
}
