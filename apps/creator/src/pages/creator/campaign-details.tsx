import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney, fmtDate } from "@/lib/format";
import { cn, getErrorMessage } from "@/lib/utils";
import type { Campaign, Brand, Application, Deliverable } from "@creatorx/schema";

type CampaignWithBrand = Campaign & { brand: Brand };

export default function CampaignDetailsPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [applyOpen, setApplyOpen] = useState(false);
  const [pitch, setPitch] = useState("");
  const [submitFor, setSubmitFor] = useState<Deliverable | null>(null);
  const [liveFor, setLiveFor] = useState<Deliverable | null>(null);
  const [assetUrl, setAssetUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [liveUrl, setLiveUrl] = useState("");

  const { data, isLoading } = useQuery<{ campaign: CampaignWithBrand; myApplication: Application | null; myDeliverables: Deliverable[] }>({
    queryKey: ["/api/campaigns", params.id],
  });

  const { data: eligibility } = useQuery<{ eligible: boolean; reasons: string[] }>({
    queryKey: ["/api/campaigns", params.id, "eligibility"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${params.id}/eligibility`);
      return res.json();
    },
  });

  const submitDraftMut = useMutation({
    mutationFn: async ({ id, asset_url, caption }: { id: string; asset_url: string; caption: string }) => {
      const r = await apiRequest("POST", `/api/my/deliverables/${id}/submit`, { asset_url, caption });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Draft submitted", description: "The brand will review it shortly." });
      setSubmitFor(null);
      setAssetUrl("");
      setCaption("");
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/campaigns"] });
    },
    onError: (e: unknown) => toast({ title: "Submit failed", description: getErrorMessage(e), variant: "destructive" }),
  });

  const markLiveMut = useMutation({
    mutationFn: async ({ id, live_url }: { id: string; live_url: string }) => {
      const r = await apiRequest("POST", `/api/my/deliverables/${id}/live`, { live_url });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Marked live", description: "Your post is now trackable for payout." });
      setLiveFor(null);
      setLiveUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
    },
    onError: (e: unknown) => toast({ title: "Couldn't mark live", description: getErrorMessage(e), variant: "destructive" }),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${params.id}/apply`, { pitch });
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Application sent", description: "We'll notify you the moment the brand decides." });
      setApplyOpen(false);
      setPitch("");
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/campaigns"] });
    },
    onError: (e: unknown) => {
      toast({ title: "Couldn't apply", description: getErrorMessage(e) || "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading || !data) {
    return (
      <CreatorShell>
        <div className="h-[60vh] flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </CreatorShell>
    );
  }

  const { campaign: c, myApplication, myDeliverables } = data;
  const applied = !!myApplication;
  const statusLabel = myApplication?.status;
  const showDeliverables = myApplication?.status === "accepted" && myDeliverables.length > 0;

  return (
    <CreatorShell>
      {/* Hero */}
      <div className="relative h-[320px] -mb-10">
        {c.cover_image_url ? (
          <img src={c.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-[#050505]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute top-0 left-0 right-0 px-5 pt-6 flex items-center justify-between">
          <button
            onClick={() => setLocation("/discover")}
            className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover-elevate"
            data-testid="button-back"
          >
            <Icon name="arrow_back" className="text-[20px] text-white" />
          </button>
          <button className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover-elevate">
            <Icon name="bookmark_border" className="text-[20px] text-white" />
          </button>
        </div>
        {c.high_ticket && (
          <div className="absolute top-20 left-5">
            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary text-primary-foreground glow-primary">
              High Ticket
            </span>
          </div>
        )}
      </div>

      {/* Main body */}
      <div className="relative px-5 pb-40 space-y-6">
        {/* Brand + title */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            {c.brand.logo_url && (
              <img src={c.brand.logo_url} alt={c.brand.name} className="size-10 rounded-full bg-white" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                {c.brand.name}
                {c.brand.verified && <Icon name="verified" className="text-[14px] text-primary" filled />}
              </div>
              <div className="text-xs text-muted-foreground">{c.brand.industry}</div>
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight leading-tight">{c.title}</h1>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {c.tags.map((t) => (
              <span key={t} className="text-xs font-semibold text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Earnings tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Base earning" value={fmtMoney(c.base_earning_cents)} accent />
          <Tile label="Commission" value={`${c.commission_pct}%`} />
          <Tile label="Apply by" value={fmtDate(c.apply_deadline)} />
          <Tile
            label="Slots"
            value={`${c.slots_filled} / ${c.slots_total}`}
            progress={c.slots_filled / c.slots_total}
          />
        </div>

        {/* Deliverables */}
        <section>
          <h2 className="text-lg font-extrabold mb-3">Deliverables</h2>
          <div className="space-y-2">
            {c.deliverables.map((d, i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl">
                <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <Icon name="videocam" className="text-[18px]" filled />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{d.qty}× {d.kind}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{d.spec}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Description */}
        <section>
          <h2 className="text-lg font-extrabold mb-2">The brief</h2>
          <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{c.description}</p>
        </section>

        {/* Do & Don't */}
        <section className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-card border border-border rounded-2xl">
            <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-2">
              <Icon name="check_circle" filled className="text-[18px]" />
              Do
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {c.dos.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          </div>
          <div className="p-4 bg-card border border-border rounded-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm mb-2">
              <Icon name="cancel" filled className="text-[18px]" />
              Don't
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {c.donts.map((d, i) => <li key={i}>• {d}</li>)}
            </ul>
          </div>
        </section>

        {/* Timeline */}
        <section>
          <h2 className="text-lg font-extrabold mb-3">Timeline</h2>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <TimelineRow icon="how_to_reg" label="Apply by" value={fmtDate(c.apply_deadline)} />
            <TimelineRow icon="edit_note" label="Draft due" value={fmtDate(c.draft_deadline)} />
            <TimelineRow icon="celebration" label="Go live" value={fmtDate(c.live_date)} last />
          </div>
        </section>

        {showDeliverables && (
          <section>
            <h2 className="text-lg font-extrabold mb-3">Your deliverables</h2>
            <div className="space-y-2">
              {myDeliverables.map((d) => (
                <div key={d.id} className="p-4 bg-card border border-border rounded-2xl">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                      <Icon name="movie" filled className="text-[18px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{d.kind}</div>
                      <div className="text-xs text-muted-foreground capitalize">{d.status.replace("_", " ")}</div>
                    </div>
                    <DeliverableBadge status={d.status} />
                  </div>
                  {d.feedback && d.status === "revision" && (
                    <div className="text-xs bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded-lg p-2 mb-2">
                      <b>Brand feedback:</b> {d.feedback}
                    </div>
                  )}
                  {(d.status === "pending" || d.status === "revision" || d.status === "rejected") && (
                    <button
                      onClick={() => { setSubmitFor(d); setAssetUrl(d.asset_url || ""); setCaption(d.caption || ""); }}
                      className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover-elevate glow-primary"
                      data-testid={`button-submit-${d.id}`}
                    >
                      {d.status === "revision" ? "Resubmit draft" : "Submit draft"}
                    </button>
                  )}
                  {d.status === "submitted" && (
                    <div className="text-xs text-center text-muted-foreground py-2">
                      In review by the brand
                    </div>
                  )}
                  {d.status === "approved" && (
                    <button
                      onClick={() => { setLiveFor(d); setLiveUrl(d.live_url || ""); }}
                      className="w-full h-10 rounded-lg bg-green-500/15 text-green-300 text-xs font-bold uppercase tracking-widest hover-elevate"
                      data-testid={`button-live-${d.id}`}
                    >
                      Post live — add link
                    </button>
                  )}
                  {d.status === "live" && (
                    <div className="text-xs text-green-300 flex items-center justify-center gap-1 py-2">
                      <Icon name="check_circle" filled className="text-[14px]" />
                      Live — earnings credited
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-[480px] w-full px-5 py-4 bg-background/90 backdrop-blur-xl border-t border-border">
        {applied ? (
          <div className={cn(
            "w-full h-14 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest",
            statusLabel === "accepted" ? "bg-green-500/20 text-green-300" :
            statusLabel === "rejected" ? "bg-red-500/20 text-red-300" :
            "bg-amber-500/20 text-amber-300"
          )}>
            <Icon name={
              statusLabel === "accepted" ? "check_circle" :
              statusLabel === "rejected" ? "cancel" :
              "schedule"
            } filled className="text-[20px]" />
            {statusLabel === "accepted" ? "Accepted" : statusLabel === "rejected" ? "Not selected" : "Application pending"}
          </div>
        ) : eligibility && !eligibility.eligible ? (
          <div className="w-full space-y-2" data-testid="panel-locked">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs">
              <div className="font-bold text-red-400 uppercase tracking-widest text-[10px] mb-1 flex items-center gap-1"><Icon name="lock" filled className="text-[14px]" /> Not eligible yet</div>
              <ul className="text-muted-foreground list-disc pl-4 space-y-0.5">
                {eligibility.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <Button disabled className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest opacity-50" data-testid="button-apply-locked">
              Locked
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => setApplyOpen(true)}
            className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest glow-primary"
            data-testid="button-apply"
          >
            Apply · Earn {fmtMoney(c.base_earning_cents)}
          </Button>
        )}
      </div>

      <Dialog open={submitFor !== null} onOpenChange={(o) => !o && setSubmitFor(null)}>
        <DialogContent className="bg-card border-border max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Submit draft — {submitFor?.kind}</DialogTitle>
            <DialogDescription>
              Drop a link to your video/image file. The brand will approve or request revisions.
            </DialogDescription>
          </DialogHeader>
          <input
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            placeholder="https://drive.google.com/... or Dropbox link"
            className="h-12 px-4 rounded-xl bg-background border border-border text-sm"
            data-testid="input-asset-url"
          />
          <Textarea
            placeholder="Caption or notes for the brand (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="min-h-[90px] bg-background border-border resize-none"
            data-testid="input-caption"
          />
          <Button
            onClick={() => submitFor && submitDraftMut.mutate({ id: submitFor.id, asset_url: assetUrl, caption })}
            disabled={submitDraftMut.isPending || assetUrl.trim().length < 5}
            className="h-12 rounded-xl font-bold glow-primary"
            data-testid="button-confirm-submit"
          >
            {submitDraftMut.isPending ? "Submitting…" : "Send for review"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={liveFor !== null} onOpenChange={(o) => !o && setLiveFor(null)}>
        <DialogContent className="bg-card border-border max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Mark as live — {liveFor?.kind}</DialogTitle>
            <DialogDescription>
              Paste the public URL of your post. This confirms delivery and may unlock performance bonuses.
            </DialogDescription>
          </DialogHeader>
          <input
            value={liveUrl}
            onChange={(e) => setLiveUrl(e.target.value)}
            placeholder="https://instagram.com/p/..."
            className="h-12 px-4 rounded-xl bg-background border border-border text-sm"
            data-testid="input-live-url"
          />
          <Button
            onClick={() => liveFor && markLiveMut.mutate({ id: liveFor.id, live_url: liveUrl })}
            disabled={markLiveMut.isPending || !/^https?:\/\//.test(liveUrl)}
            className="h-12 rounded-xl font-bold glow-primary"
            data-testid="button-confirm-live"
          >
            {markLiveMut.isPending ? "Saving…" : "Confirm live"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="bg-card border-border max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Apply to {c.title}</DialogTitle>
            <DialogDescription>
              Tell the brand why you're the right match. A short authentic pitch goes a long way.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="I think this campaign fits my audience because..."
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            className="min-h-[120px] bg-background border-border resize-none"
            data-testid="input-pitch"
          />
          <Button
            onClick={() => applyMut.mutate()}
            disabled={applyMut.isPending || pitch.trim().length < 10}
            className="h-12 rounded-xl font-bold glow-primary"
            data-testid="button-submit-apply"
          >
            {applyMut.isPending ? "Submitting…" : "Send application"}
          </Button>
        </DialogContent>
      </Dialog>
    </CreatorShell>
  );
}

function DeliverableBadge({ status }: { status: Deliverable["status"] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Upload draft", cls: "bg-primary/15 text-primary" },
    submitted: { label: "In review", cls: "bg-amber-500/15 text-amber-300" },
    approved: { label: "Approved", cls: "bg-primary/15 text-primary" },
    revision: { label: "Revise", cls: "bg-orange-500/15 text-orange-300" },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300" },
    live: { label: "Live", cls: "bg-green-500/15 text-green-300" },
  };
  const cur = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full", cur.cls)}>
      {cur.label}
    </span>
  );
}

function Tile({ label, value, accent, progress }: { label: string; value: string; accent?: boolean; progress?: number }) {
  return (
    <div className="p-4 bg-card border border-border rounded-2xl">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-black mt-1", accent && "text-primary")} style={accent ? { color: "#6ea0ff" } : undefined}>{value}</div>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function TimelineRow({ icon, label, value, last }: { icon: string; label: string; value: string; last?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className="size-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Icon name={icon} filled className="text-[16px]" />
        </div>
        {!last && <div className="w-px flex-1 bg-border my-1" style={{ minHeight: 18 }} />}
      </div>
      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
        <div className="text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}
