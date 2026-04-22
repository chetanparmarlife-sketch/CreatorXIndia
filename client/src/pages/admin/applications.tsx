import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus, Profile, Campaign } from "@shared/schema";

type Enriched = Application & { creator: Profile | null; campaign: Campaign | null };

const STATUS_OPTIONS: (ApplicationStatus | "all")[] = ["all", "pending", "accepted", "rejected", "withdrawn"];

export default function AdminApplicationsPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ApplicationStatus | "all">("pending");

  const { data } = useQuery<{ applications: Enriched[] }>({
    queryKey: ["/api/admin/applications", status !== "all" ? `?status=${status}` : ""],
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, status: s }: { id: string; status: ApplicationStatus }) =>
      apiRequest("POST", `/api/admin/applications/${id}/decide`, { decision: s }),
    onSuccess: () => {
      toast({ title: "Decision saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
    },
  });

  const apps = data?.applications || [];

  return (
    <AdminShell title="Applications" subtitle={`${apps.length} total`}>
      <div className="flex gap-2 mb-5">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              "h-9 px-4 rounded-lg text-xs font-bold uppercase tracking-widest capitalize hover-elevate",
              status === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            )}
            data-testid={`filter-${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {apps.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground">
            No applications match
          </div>
        ) : (
          apps.map((a) => (
            <div key={a.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="grid grid-cols-[1fr_auto] gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {a.creator && (
                      <img src={a.creator.avatar_url || ""} alt="" className="size-10 rounded-full object-cover" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm flex items-center gap-1">
                        {a.creator?.full_name || "Unknown"}
                        {a.creator?.verified_pro && <Icon name="verified" filled className="text-primary text-[13px]" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        applied for <span className="font-semibold text-foreground">{a.campaign?.title || "unknown campaign"}</span>
                      </div>
                    </div>
                  </div>
                  {a.pitch && (
                    <p className="text-sm text-muted-foreground bg-background/50 border border-border rounded-xl p-3 mt-2 italic">
                      "{a.pitch}"
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Applied {timeAgo(a.applied_at)}</span>
                    {a.decided_at && <span>· decided {fmtDate(a.decided_at)}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={cn(
                    "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                    a.status === "pending" ? "bg-amber-500/15 text-amber-400" :
                    a.status === "accepted" ? "bg-green-500/15 text-green-400" :
                    a.status === "rejected" ? "bg-red-500/15 text-red-400" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {a.status}
                  </span>
                  {a.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => decideMut.mutate({ id: a.id, status: "rejected" })}
                        className="h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover-elevate"
                        data-testid={`button-reject-${a.id}`}
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => decideMut.mutate({ id: a.id, status: "accepted" })}
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover-elevate glow-primary"
                        data-testid={`button-accept-${a.id}`}
                      >
                        Accept
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
