import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CreatorShell, CreatorHeader } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommunityItem, EventKind } from "@creatorx/schema";

const TABS: { id: "all" | EventKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: "Events" },
  { id: "perk", label: "Perks" },
  { id: "news", label: "News" },
];

export default function CommunityPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");

  const { data } = useQuery<{ items: CommunityItem[] }>({
    queryKey: ["/api/community"],
  });

  const items = (data?.items || []).filter((i) => {
    if (tab === "all") return true;
    return i.kind === tab;
  });

  const featured = items.find((i) => i.kind === "event") || items[0];
  const rest = items.filter((i) => i.id !== featured?.id);

  return (
    <CreatorShell>
      <CreatorHeader
        title="Community"
        subtitle="Meetups, perks, and fresh news"
        trailing={
          <button className="size-10 rounded-full bg-card hover-elevate flex items-center justify-center">
            <Icon name="search" className="text-[20px]" />
          </button>
        }
      />

      <div className="px-5 pb-8 space-y-5">
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-4 h-9 rounded-full text-xs font-bold whitespace-nowrap border transition-colors hover-elevate",
                  on ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-foreground"
                )}
                data-testid={`tab-${t.id}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Featured */}
        {featured && tab === "all" && <FeaturedCard item={featured} />}

        {/* Rest */}
        <div className="space-y-3">
          {(tab === "all" ? rest : items).map((item) => <ItemCard key={item.id} item={item} />)}
          {items.length === 0 && (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Icon name="groups" className="text-[40px] text-muted-foreground mb-2" />
              <div className="font-bold">Nothing here yet</div>
              <p className="text-sm text-muted-foreground">New {tab === "all" ? "content" : TABS.find(t => t.id === tab)?.label.toLowerCase()} will show up soon.</p>
            </div>
          )}
        </div>
      </div>
    </CreatorShell>
  );
}

function FeaturedCard({ item }: { item: CommunityItem }) {
  const href = item.kind === "event" ? `/community/${item.id}` : item.url || "#";
  return (
    <Link href={href} className="block relative aspect-[4/5] max-h-[380px] w-full rounded-3xl overflow-hidden hover-elevate">
      {item.cover_image_url ? (
        <img src={item.cover_image_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-[#0a1f8a]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      <div className="absolute top-4 left-4">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-primary text-primary-foreground">
          Featured · {item.kind}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        {item.starts_at && (
          <div className="text-xs font-bold uppercase tracking-widest text-white/80">
            {new Date(item.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            {item.city && ` · ${item.city}`}
          </div>
        )}
        <h3 className="text-2xl font-black leading-tight mt-1">{item.title}</h3>
        <p className="text-sm text-white/80 line-clamp-2 mt-2">{item.description}</p>
        <div className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white text-primary font-bold text-sm">
          {item.kind === "event" ? "RSVP" : item.kind === "perk" ? "Unlock perk" : "Read more"}
          <Icon name="arrow_forward" className="text-[16px]" />
        </div>
      </div>
    </Link>
  );
}

function ItemCard({ item }: { item: CommunityItem }) {
  const href = item.kind === "event" ? `/community/${item.id}` : item.url || "#";
  const meta: Record<EventKind, { label: string; icon: string; color: string }> = {
    event: { label: "Meetup", icon: "event", color: "bg-primary/15 text-primary" },
    perk: { label: "Perk", icon: "redeem", color: "bg-amber-500/15 text-amber-400" },
    news: { label: "News", icon: "campaign", color: "bg-green-500/15 text-green-400" },
  };
  const m = meta[item.kind];

  return (
    <Link
      href={href}
      className="flex gap-3 p-3 bg-card border border-border rounded-2xl hover-elevate"
      data-testid={`card-community-${item.id}`}
    >
      <div className="size-20 rounded-xl bg-muted overflow-hidden shrink-0">
        {item.cover_image_url ? (
          <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name={m.icon} className="text-[28px] text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest", m.color)}>
          <Icon name={m.icon} className="text-[11px]" filled />
          {m.label}
        </div>
        <div className="font-extrabold text-sm leading-tight line-clamp-2 mt-1">{item.title}</div>
        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {item.starts_at
            ? new Date(item.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + (item.city ? ` · ${item.city}` : "")
            : item.description}
        </div>
        {item.kind === "event" && item.price_cents > 0 && (
          <div className="text-xs font-bold mt-1" style={{ color: "#6ea0ff" }}>{fmtMoney(item.price_cents)}</div>
        )}
      </div>
    </Link>
  );
}
