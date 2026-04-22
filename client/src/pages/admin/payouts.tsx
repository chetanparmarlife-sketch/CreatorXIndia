import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Withdrawal, WithdrawalStatus, Profile } from "@shared/schema";

type Enriched = Withdrawal & { creator: Profile | null };
const STATUS_OPTIONS: (WithdrawalStatus | "all")[] = ["requested", "approved", "paid", "rejected", "all"];

export default function AdminPayoutsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WithdrawalStatus | "all">("requested");

  const { data } = useQuery<{ payouts: Enriched[] }>({
    queryKey: ["/api/admin/payouts", status !== "all" ? `?status=${status}` : ""],
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, status: s, utr }: { id: string; status: WithdrawalStatus; utr?: string }) =>
      apiRequest("POST", `/api/admin/payouts/${id}/decide`, { decision: s, utr }),
    onSuccess: () => {
      toast({ title: "Payout updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
    },
  });

  const payouts = data?.payouts || [];
  const netTotal = payouts.reduce((a, p) => a + p.net_cents, 0);
  const grossTotal = payouts.reduce((a, p) => a + p.gross_cents, 0);
  const tdsTotal = payouts.reduce((a, p) => a + p.tds_cents, 0);

  function promptAndPay(id: string) {
    const utr = prompt("Enter UTR reference (12-char IMPS/NEFT UTR or UPI txn ID):") || "";
    if (!utr.trim()) return;
    decideMut.mutate({ id, status: "paid", utr: utr.trim() });
  }

  return (
    <AdminShell
      title="Payouts"
      subtitle={`${payouts.length} · Gross ${fmtMoney(grossTotal)} · TDS ${fmtMoney(tdsTotal)} · Net ${fmtMoney(netTotal)}`}
    >
      <div className="flex gap-2 mb-5">
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn("h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-widest capitalize hover-elevate", status === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground")} data-testid={`filter-${s}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px_1fr_160px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
          <div>Creator</div>
          <div>Gross / TDS / Net</div>
          <div>Method</div>
          <div>Destination</div>
          <div>Status</div>
          <div>UTR / Invoice</div>
          <div className="text-right">Actions</div>
        </div>
        {payouts.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No payouts {status !== "all" && `in ${status}`}</div>
        ) : (
          payouts.map((p) => (
            <div key={p.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px_1fr_160px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0" data-testid={`row-payout-${p.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <img src={p.creator?.avatar_url || ""} alt="" className="size-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{p.creator?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{p.creator?.handle} · {timeAgo(p.requested_at)}</div>
                </div>
              </div>
              <div className="text-xs">
                <div className="font-bold text-sm">{fmtMoney(p.net_cents)}</div>
                <div className="text-muted-foreground">G {fmtMoney(p.gross_cents)}{p.tds_cents > 0 && <span className="text-red-400"> · TDS {fmtMoney(p.tds_cents)}</span>}{p.gst_cents > 0 && <span className="text-green-400"> · GST {fmtMoney(p.gst_cents)}</span>}</div>
              </div>
              <div className="text-xs uppercase tracking-widest font-bold">{p.method}</div>
              <div className="text-xs font-mono truncate">{p.destination}</div>
              <div>
                <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                  p.status === "requested" ? "bg-amber-500/15 text-amber-400" :
                  p.status === "approved" ? "bg-primary/15 text-primary" :
                  p.status === "paid" ? "bg-green-500/15 text-green-400" :
                  "bg-red-500/15 text-red-400")}>
                  {p.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {p.utr && <div>UTR: {p.utr}</div>}
                {p.invoice_number && <div>{p.invoice_number}</div>}
                {!p.utr && !p.invoice_number && <span>—</span>}
              </div>
              <div className="flex items-center justify-end gap-1">
                {p.status === "requested" && (
                  <>
                    <button onClick={() => decideMut.mutate({ id: p.id, status: "rejected" })} className="h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover-elevate" data-testid={`button-reject-${p.id}`}>Reject</button>
                    <button onClick={() => decideMut.mutate({ id: p.id, status: "approved" })} className="h-8 px-3 rounded-lg bg-primary/15 text-primary text-xs font-bold hover-elevate" data-testid={`button-approve-${p.id}`}>Approve</button>
                  </>
                )}
                {p.status === "approved" && (
                  <button onClick={() => promptAndPay(p.id)} className="h-8 px-3 rounded-lg bg-green-500/15 text-green-400 text-xs font-bold hover-elevate" data-testid={`button-pay-${p.id}`}>
                    Mark paid + UTR
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
