import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CreatorShell,
  CreatorHeader,
  HeaderAvatar,
  HeaderIconButton,
} from "@/components/creator-shell";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/brand";
import { fmtMoney, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, Brand, Application, Deliverable } from "@creatorx/schema";

type CampaignWithBrand = Campaign & { brand: Brand };
type MyItem = {
  application: Application;
  campaign: CampaignWithBrand | null;
  deliverables: Deliverable[];
};

const TABS = [
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
] as const;

type TabId = typeof TABS[number]["id"];

export default function MyCampaignsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabId>("active");
  const { data } = useQuery<{ items: MyItem[] }>({
    queryKey: ["/api/my/campaigns"],
  });
  const { data: notifData } = useQuery<{ notifications: { read: boolean }[] }>({
    queryKey: ["/api/notifications"],
  });
  const unread = notifData?.notifications?.filter((n) => !n.read).length || 0;

  const items = data?.items || [];

  const filtered = items.filter((i) => {
    if (tab === "pending") return i.application.status === "pending";
    if (tab === "completed") {
      return i.application.status === "accepted" &&
        i.deliverables.length > 0 &&
        i.deliverables.every((d) => d.status === "live");
    }
    // active
    return (
      i.application.status === "accepted" &&
      (i.deliverables.length === 0 || i.deliverables.some((d) => d.status !== "live"))
    );
  });

  return (
    <CreatorShell>
      <CreatorHeader
        title="My campaigns"
        subtitle="Drafts, reviews, and payouts"
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

      {/* Tabs */}
      <div className="sticky top-[72px] z-30 bg-background/90 backdrop-blur-md px-5 pb-3 pt-1">
        <div className="flex gap-2 p-1 bg-card rounded-2xl border border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 h-10 rounded-xl text-sm font-bold transition-colors",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover-elevate"
              )}
              data-testid={`tab-${t.id}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pt-3 pb-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          filtered.map((i) => <MyCampaignCard key={i.application.id} item={i} />)
        )}
      </div>
    </CreatorShell>
  );
}

function EmptyState({ tab }: { tab: TabId }) {
  const msg = {
    active: { title: "No active campaigns", body: "Apply to new opportunities on Discover.", cta: "Discover campaigns" },
    pending: { title: "No pending applications", body: "Apply to campaigns and track responses here.", cta: "Browse campaigns" },
    completed: { title: "No completed campaigns yet", body: "Your finished campaigns will appear here.", cta: "Discover campaigns" },
  }[tab];
  return (
    <div className="bg-card border border-border rounded-2xl p-10 text-center mt-8">
      <Icon name="inventory_2" className="text-[40px] text-muted-foreground mb-2" />
      <div className="font-bold mb-1">{msg.title}</div>
      <p className="text-sm text-muted-foreground mb-4">{msg.body}</p>
      <Link href="/discover" className="inline-block h-11 px-5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center glow-primary">
        {msg.cta}
      </Link>
    </div>
  );
}

function MyCampaignCard({ item }: { item: MyItem }) {
  const c = item.campaign;
  if (!c) return null;
  const status = item.application.status;
  const allLive = item.deliverables.length > 0 && item.deliverables.every((d) => d.status === "live");
  const next = item.deliverables.find((d) => d.status !== "live");

  const progress = item.deliverables.length > 0
    ? item.deliverables.filter((d) => d.status === "live").length / item.deliverables.length
    : 0;

  return (
    <Link
      href={`/campaigns/${c.id}`}
      className="block p-4 bg-card border border-border rounded-3xl hover-elevate"
      data-testid={`card-my-campaign-${c.id}`}
    >
      <div className="flex items-start gap-3">
        <img
          src={c.cover_image_url || c.brand.logo_url || ""}
          alt=""
          className="size-16 rounded-2xl object-cover shrink-0 bg-muted"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            {c.brand.name}
          </div>
          <div className="font-extrabold leading-tight line-clamp-2">{c.title}</div>
          <div className="flex items-center gap-2 mt-2 text-sm">
            <span className="font-bold" style={{ color: "#6ea0ff" }}>
              {fmtMoney(c.base_earning_cents)}
            </span>
            <StatusBadge status={status} allLive={allLive} next={next?.status} />
          </div>
        </div>
      </div>

      {status === "accepted" && item.deliverables.length > 0 && !allLive && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">
              Progress · {item.deliverables.filter((d) => d.status === "live").length}/{item.deliverables.length} live
            </span>
            <span className="text-muted-foreground">Due {fmtDate(c.live_date)}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
      )}
    </Link>
  );
}

function StatusBadge({ status, allLive, next }: { status: string; allLive: boolean; next?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending review", cls: "bg-amber-500/15 text-amber-300" },
    rejected: { label: "Not selected", cls: "bg-red-500/15 text-red-300" },
    withdrawn: { label: "Withdrawn", cls: "bg-muted text-muted-foreground" },
  };
  if (status === "accepted") {
    if (allLive) map.accepted = { label: "Completed", cls: "bg-green-500/15 text-green-300" };
    else if (next === "submitted") map.accepted = { label: "In review", cls: "bg-amber-500/15 text-amber-300" };
    else if (next === "revision") map.accepted = { label: "Needs revision", cls: "bg-orange-500/15 text-orange-300" };
    else if (next === "approved") map.accepted = { label: "Post live", cls: "bg-primary/15 text-primary" };
    else map.accepted = { label: "Upload draft", cls: "bg-primary/15 text-primary" };
  }
  const cur = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest", cur.cls)}>
      {cur.label}
    </span>
  );
}
