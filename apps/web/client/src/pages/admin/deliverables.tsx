import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Deliverable, DeliverableStatus, Profile, Campaign } from "@creatorx/schema";

type Enriched = Deliverable & { creator: Profile | null; campaign: Campaign | null };

const STATUS_OPTIONS: (DeliverableStatus | "all")[] = ["submitted", "all", "approved", "revision", "live", "rejected"];

export default function AdminDeliverablesPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<DeliverableStatus | "all">("submitted");
  const [feedback, setFeedback] = useState<{ id: string; mode: "revision" | "rejected" } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const { data } = useQuery<{ deliverables: Enriched[] }>({
    queryKey: ["/api/admin/deliverables", `?status=${status}`],
  });

  const decideMut = useMutation({
    mutationFn: async ({ id, status: s, feedback: fb }: { id: string; status: DeliverableStatus; feedback?: string }) =>
      apiRequest("POST", `/api/admin/deliverables/${id}/decide`, { decision: s, feedback: fb }),
    onSuccess: () => {
      toast({ title: "Decision saved" });
      setFeedback(null);
      setFeedbackText("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/deliverables"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/summary"] });
    },
  });

  const items = data?.deliverables || [];

  return (
    <AdminShell title="Deliverables" subtitle={`${items.length} in ${status}`}>
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

      <div className="grid grid-cols-2 gap-4">
        {items.length === 0 ? (
          <div className="col-span-2 bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground">
            Nothing in {status}
          </div>
        ) : items.map((d) => (
          <div key={d.id} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <img src={d.creator?.avatar_url || ""} alt="" className="size-10 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{d.creator?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.campaign?.title}</div>
              </div>
              <span className={cn(
                "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full",
                d.status === "submitted" ? "bg-amber-500/15 text-amber-400" :
                d.status === "approved" ? "bg-primary/15 text-primary" :
                d.status === "live" ? "bg-green-500/15 text-green-400" :
                d.status === "revision" ? "bg-orange-500/15 text-orange-400" :
                d.status === "rejected" ? "bg-red-500/15 text-red-400" :
                "bg-muted text-muted-foreground"
              )}>
                {d.status}
              </span>
            </div>

            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">{d.kind}</div>
            {d.asset_url && (
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black mb-3">
                <img src={d.asset_url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Icon name="play_circle" filled className="text-white text-[40px]" />
                </div>
              </div>
            )}
            {d.caption && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{d.caption}</p>}
            {d.feedback && (
              <div className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded-lg p-2 mb-3">
                <b>Feedback:</b> {d.feedback}
              </div>
            )}
            <div className="text-xs text-muted-foreground mb-3">
              Submitted {d.submitted_at ? timeAgo(d.submitted_at) : "—"}
            </div>

            {d.status === "submitted" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decideMut.mutate({ id: d.id, status: "approved" })}
                  className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover-elevate glow-primary"
                  data-testid={`button-approve-${d.id}`}
                >
                  Approve
                </button>
                <button
                  onClick={() => { setFeedback({ id: d.id, mode: "revision" }); setFeedbackText(""); }}
                  className="h-9 px-3 rounded-lg bg-orange-500/10 text-orange-400 text-xs font-bold hover-elevate"
                  data-testid={`button-revise-${d.id}`}
                >
                  Revise
                </button>
                <button
                  onClick={() => { setFeedback({ id: d.id, mode: "rejected" }); setFeedbackText(""); }}
                  className="h-9 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover-elevate"
                  data-testid={`button-reject-${d.id}`}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={feedback !== null} onOpenChange={(o) => !o && setFeedback(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{feedback?.mode === "revision" ? "Request revisions" : "Reject deliverable"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share specific feedback with the creator..."
            rows={5}
            className="bg-background border-border resize-none"
          />
          <Button
            onClick={() => feedback && decideMut.mutate({ id: feedback.id, status: feedback.mode, feedback: feedbackText })}
            disabled={decideMut.isPending || feedbackText.length < 10}
            className="h-11 rounded-lg font-bold glow-primary"
            data-testid="button-confirm-feedback"
          >
            {decideMut.isPending ? "Sending..." : "Send feedback"}
          </Button>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
