import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { fmtMoney, fmtCompact, fmtDate } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Profile, SocialAccount, Application } from "@creatorx/schema";

type Detail = {
  creator: Profile;
  socials: SocialAccount[];
  applications: Application[];
  earnings_cents: number;
};

export default function AdminCreatorDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data } = useQuery<Detail>({ queryKey: ["/api/admin/creators", params.id] });

  const verifyMut = useMutation({
    mutationFn: async (verified: boolean) => {
      const res = await apiRequest("POST", `/api/admin/creators/${params.id}/verify`, { verified });
      return await res.json();
    },
    onSuccess: (_d, verified) => {
      toast({ title: verified ? "Creator verified" : "Verification removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: async (suspended: boolean) => {
      const res = await apiRequest("POST", `/api/admin/creators/${params.id}/suspend`, { suspended });
      return await res.json();
    },
    onSuccess: (_d, suspended) => {
      toast({ title: suspended ? "Creator suspended" : "Creator reinstated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] });
    },
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  if (!data) {
    return (
      <AdminShell title="Creator">
        <div className="h-96 flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </AdminShell>
    );
  }

  const c = data.creator;

  return (
    <AdminShell
      title={c.full_name}
      subtitle={`@${c.handle} · ${c.email}`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => verifyMut.mutate(!c.verified_pro)}
            disabled={verifyMut.isPending}
            className="h-9 px-4 rounded-lg bg-primary/10 text-primary text-sm font-bold hover-elevate disabled:opacity-50"
            data-testid="button-verify"
          >
            {c.verified_pro ? "Unverify" : "Verify"}
          </button>
          <button
            onClick={() => suspendMut.mutate(!c.suspended)}
            disabled={suspendMut.isPending}
            className={cn(
              "h-9 px-4 rounded-lg text-sm font-bold hover-elevate disabled:opacity-50",
              c.suspended ? "bg-green-500/15 text-green-400" : "bg-red-500/10 text-red-400"
            )}
            data-testid="button-suspend"
          >
            {c.suspended ? "Reinstate" : "Suspend"}
          </button>
          <button onClick={() => setLocation("/admin/creators")} className="h-9 px-4 rounded-lg bg-card border border-border text-sm font-semibold hover-elevate">
            Back
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-[280px_1fr] gap-6">
        {/* Profile card */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-col items-center text-center">
            <img src={c.avatar_url || ""} alt="" className="size-24 rounded-full object-cover border-4 border-primary/30" />
            <div className="font-extrabold text-lg mt-3 flex items-center gap-1">
              {c.full_name}
              {c.verified_pro && <Icon name="verified" filled className="text-primary text-[16px]" />}
            </div>
            <div className="text-sm text-muted-foreground">@{c.handle}</div>
            {c.city && <div className="text-xs text-muted-foreground mt-1">{c.city}</div>}
            {c.bio && <p className="text-xs text-muted-foreground mt-3">{c.bio}</p>}
          </div>
          <div className="border-t border-border mt-4 pt-4 space-y-2 text-sm">
            <KV label="Role" value={c.role} />
            <KV label="Joined" value={fmtDate(c.created_at)} />
            <KV label="Status" value={c.suspended ? "Suspended" : "Active"} />
          </div>
        </div>

        {/* Main */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total reach" value={fmtCompact(c.total_reach)} />
            <Stat label="Engagement" value={`${c.avg_engagement.toFixed(1)}%`} />
            <Stat label="Earned" value={fmtMoney(data.earnings_cents)} />
            <Stat label="Applications" value={String(data.applications.length)} />
          </div>

          {/* Niches */}
          {c.niches.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Niches</div>
              <div className="flex flex-wrap gap-1.5">
                {c.niches.map((n) => (
                  <span key={n} className="text-xs font-bold uppercase tracking-widest text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">{n}</span>
                ))}
              </div>
            </div>
          )}

          {/* Socials */}
          <section>
            <h2 className="text-sm font-extrabold mb-2">Connected accounts</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {data.socials.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No accounts connected</div>
              ) : data.socials.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
                  <div className="size-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center capitalize font-bold text-xs">
                    {s.platform.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm capitalize">{s.platform} · @{s.handle}</div>
                    <div className="text-xs text-muted-foreground">{fmtCompact(s.followers)} followers · {s.engagement_rate.toFixed(1)}% engagement</div>
                  </div>
                  {s.connected ? (
                    <Icon name="check_circle" filled className="text-green-400 text-[18px]" />
                  ) : (
                    <Icon name="link_off" className="text-muted-foreground text-[18px]" />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Applications */}
          <section>
            <h2 className="text-sm font-extrabold mb-2">Applications ({data.applications.length})</h2>
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              {data.applications.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No applications</div>
              ) : data.applications.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 text-sm">
                  <div className="flex-1 min-w-0 truncate">
                    <span className="font-semibold">Campaign</span> <span className="text-muted-foreground">#{a.campaign_id.slice(-6)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmtDate(a.applied_at)}</div>
                  <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground font-semibold">{label}</span>
      <span className="font-bold capitalize">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
    </div>
  );
}
