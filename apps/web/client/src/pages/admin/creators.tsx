import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney, fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Profile } from "@creatorx/schema";

export default function AdminCreatorsPage() {
  const [q, setQ] = useState("");
  const { data } = useQuery<{ creators: Profile[] }>({
    queryKey: ["/api/admin/creators", q ? `?q=${encodeURIComponent(q)}` : ""],
  });

  const verifyMut = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/creators/${id}/verify`, { verified });
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] }),
  });

  const suspendMut = useMutation({
    mutationFn: async ({ id, suspended }: { id: string; suspended: boolean }) => {
      const res = await apiRequest("POST", `/api/admin/creators/${id}/suspend`, { suspended });
      return await res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/creators"] }),
  });

  const creators = data?.creators || [];

  return (
    <AdminShell title="Creators" subtitle={`${creators.length} total`}>
      <div className="mb-5 max-w-md">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]" />
          <Input
            placeholder="Search by name, handle, email..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 pl-10 bg-card border-border rounded-xl"
            data-testid="input-search-creators"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_120px_140px_180px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
          <div>Creator</div>
          <div>Reach</div>
          <div>Engagement</div>
          <div>Earned</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>
        {creators.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No creators found</div>
        ) : (
          creators.map((c) => (
            <div key={c.id} className={cn(
              "grid grid-cols-[1fr_120px_120px_120px_140px_180px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0",
              c.suspended && "opacity-50"
            )}>
              <Link href={`/admin/creators/${c.id}`} className="flex items-center gap-3 min-w-0 hover-elevate -mx-2 px-2 py-1 rounded-lg">
                <img src={c.avatar_url || ""} alt="" className="size-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate flex items-center gap-1">
                    {c.full_name}
                    {c.verified_pro && <Icon name="verified" filled className="text-[13px] text-primary" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">@{c.handle}</div>
                </div>
              </Link>
              <div className="text-sm font-semibold">{fmtCompact(c.total_reach)}</div>
              <div className="text-sm font-semibold">{c.avg_engagement.toFixed(1)}%</div>
              <div className="text-sm font-semibold">{fmtMoney(c.total_earned_cents)}</div>
              <div>
                <span className={cn(
                  "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                  c.suspended ? "bg-red-500/15 text-red-400" :
                  c.verified_pro ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {c.suspended ? "Suspended" : c.verified_pro ? "Verified" : "Active"}
                </span>
              </div>
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => verifyMut.mutate({ id: c.id, verified: !c.verified_pro })}
                  className="h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-bold hover-elevate"
                  data-testid={`button-verify-${c.id}`}
                >
                  {c.verified_pro ? "Unverify" : "Verify"}
                </button>
                <button
                  onClick={() => suspendMut.mutate({ id: c.id, suspended: !c.suspended })}
                  className={cn(
                    "h-8 px-3 rounded-lg text-xs font-bold hover-elevate",
                    c.suspended ? "bg-green-500/15 text-green-400" : "bg-red-500/10 text-red-400"
                  )}
                  data-testid={`button-suspend-${c.id}`}
                >
                  {c.suspended ? "Reinstate" : "Suspend"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
