import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Profile, KycStatus } from "@creatorx/schema";

const STATUS_TABS: KycStatus[] = ["pending", "verified", "rejected", "none"];

export default function AdminKycPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<KycStatus>("pending");

  const { data } = useQuery<{ creators: Profile[] }>({
    queryKey: ["/api/admin/kyc", `?status=${status}`],
  });

  const decideMut = useMutation({
    mutationFn: async ({ userId, decision, reason }: { userId: string; decision: "verified" | "rejected"; reason?: string }) =>
      apiRequest("POST", `/api/admin/kyc/${userId}/decide`, { decision, reason }),
    onSuccess: () => {
      toast({ title: "KYC updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/kyc"] });
    },
  });

  function approve(id: string) { decideMut.mutate({ userId: id, decision: "verified" }); }
  function reject(id: string) {
    const reason = prompt("Rejection reason (shown to creator):") || "";
    if (!reason.trim()) return;
    decideMut.mutate({ userId: id, decision: "rejected", reason: reason.trim() });
  }

  const rows = data?.creators || [];

  return (
    <AdminShell title="KYC verification queue" subtitle="Review PAN + GSTIN submissions (Sec 194R compliance)">
      <div className="flex gap-2 mb-5">
        {STATUS_TABS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={cn("h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-widest capitalize hover-elevate", status === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground")} data-testid={`filter-${s}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px_180px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
          <div>Creator</div>
          <div>PAN</div>
          <div>Name on PAN</div>
          <div>GSTIN / Aadhaar</div>
          <div>Submitted</div>
          <div className="text-right">Action</div>
        </div>
        {rows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No creators in {status}</div>
        ) : (
          rows.map((c) => (
            <div key={c.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_120px_180px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0" data-testid={`row-kyc-${c.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <img src={c.avatar_url || ""} alt="" className="size-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{c.handle} · {c.email}</div>
                </div>
              </div>
              <div className="font-mono text-xs tracking-wider">{c.pan_number || "—"}</div>
              <div className="text-xs truncate">{c.pan_name || "—"}</div>
              <div className="text-xs font-mono">
                {c.gstin && <div>GST: {c.gstin}</div>}
                {c.aadhaar_last4 && <div>Aadhaar ••••{c.aadhaar_last4}</div>}
                {!c.gstin && !c.aadhaar_last4 && <span className="text-muted-foreground">—</span>}
              </div>
              <div className="text-xs text-muted-foreground">{c.kyc_submitted_at ? fmtDate(c.kyc_submitted_at) : "—"}</div>
              <div className="flex items-center justify-end gap-1">
                {status === "pending" && (
                  <>
                    <button onClick={() => reject(c.id)} className="h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover-elevate" data-testid={`button-reject-${c.id}`}>Reject</button>
                    <button onClick={() => approve(c.id)} className="h-8 px-3 rounded-lg bg-primary/15 text-primary text-xs font-bold hover-elevate" data-testid={`button-approve-${c.id}`}>Verify</button>
                  </>
                )}
                {status === "rejected" && c.kyc_rejection_reason && (
                  <div className="text-[11px] text-red-400 max-w-[170px] truncate" title={c.kyc_rejection_reason}>{c.kyc_rejection_reason}</div>
                )}
                {status === "verified" && c.kyc_verified_at && (
                  <div className="text-[11px] text-green-400">Verified {fmtDate(c.kyc_verified_at)}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
