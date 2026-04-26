import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney } from "@/lib/format";
import type { CommunityItem } from "@creatorx/schema";

export default function EventDetailsPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data } = useQuery<{ items: CommunityItem[] }>({
    queryKey: ["/api/community"],
  });

  const item = data?.items?.find((i) => i.id === params.id);

  const rsvpMut = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/community/${params.id}/rsvp`),
    onSuccess: () => {
      toast({ title: "You're in", description: "We'll send details to your inbox." });
      queryClient.invalidateQueries({ queryKey: ["/api/community"] });
    },
  });

  if (!item) {
    return (
      <CreatorShell>
        <div className="h-[60vh] flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </CreatorShell>
    );
  }

  const isFull = item.capacity && item.registered >= item.capacity;
  const spotsLeft = item.capacity ? item.capacity - item.registered : null;

  return (
    <CreatorShell>
      {/* Hero */}
      <div className="relative h-[300px] -mb-10">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary to-[#0a1f8a]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute top-0 left-0 right-0 px-5 pt-6 flex items-center justify-between">
          <button
            onClick={() => setLocation("/community")}
            className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover-elevate"
            data-testid="button-back"
          >
            <Icon name="arrow_back" className="text-[20px] text-white" />
          </button>
          <button className="size-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center hover-elevate">
            <Icon name="ios_share" className="text-[20px] text-white" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative px-5 pb-40 space-y-6">
        {item.starts_at && (
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary bg-primary/15 rounded-full px-3 py-1.5">
            <Icon name="event" filled className="text-[14px]" />
            {new Date(item.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
        )}

        <h1 className="text-3xl font-black tracking-tight leading-tight">{item.title}</h1>

        <p className="text-base text-muted-foreground whitespace-pre-line leading-relaxed">{item.description}</p>

        {/* Detail rows */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          {item.starts_at && (
            <DetailRow
              icon="schedule"
              label="When"
              value={new Date(item.starts_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
              sub={item.ends_at ? `Ends ${new Date(item.ends_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : null}
            />
          )}
          {item.location_name && (
            <DetailRow icon="place" label="Where" value={item.location_name} sub={item.location_address || item.city} />
          )}
          {item.capacity !== null && (
            <DetailRow
              icon="groups"
              label="Capacity"
              value={`${item.registered} / ${item.capacity} registered`}
              sub={isFull ? "Sold out — join the waitlist" : `${spotsLeft} spots left`}
            />
          )}
          <DetailRow icon="paid" label="Price" value={item.price_cents > 0 ? fmtMoney(item.price_cents) : "Free"} />
        </div>
      </div>

      {/* Sticky RSVP */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-[480px] w-full px-5 py-4 bg-background/90 backdrop-blur-xl border-t border-border">
        <Button
          onClick={() => rsvpMut.mutate()}
          disabled={rsvpMut.isPending || !!isFull}
          className="w-full h-14 rounded-2xl font-bold uppercase tracking-widest glow-primary disabled:opacity-40"
          data-testid="button-rsvp"
        >
          {isFull ? "Join waitlist" : rsvpMut.isPending ? "Saving…" : item.price_cents > 0 ? `RSVP · ${fmtMoney(item.price_cents)}` : "RSVP · Free"}
        </Button>
      </div>
    </CreatorShell>
  );
}

function DetailRow({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <Icon name={icon} filled className="text-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
        <div className="font-bold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}
