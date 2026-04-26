import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CreatorShell,
  CreatorHeader,
  HeaderAvatar,
  HeaderIconButton,
  SectionHeader,
} from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { fmtMoney, fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Campaign, Brand, Application, Deliverable } from "@creatorx/schema";

type CampaignWithBrand = Campaign & { brand: Brand };

type MyItem = {
  application: Application;
  campaign: CampaignWithBrand | null;
  deliverables: Deliverable[];
};

export default function HomePage() {
  const { user } = useAuth();

  const { data: earnings } = useQuery<{ balance_cents: number; transactions: unknown[] }>({
    queryKey: ["/api/earnings"],
  });

  const { data: myData } = useQuery<{ items: MyItem[] }>({
    queryKey: ["/api/my/campaigns"],
  });

  const { data: campaignsData } = useQuery<{ campaigns: CampaignWithBrand[] }>({
    queryKey: ["/api/campaigns"],
  });

  const { data: notifData } = useQuery<{ notifications: { read: boolean }[] }>({
    queryKey: ["/api/notifications"],
  });
  const unread = notifData?.notifications?.filter((n) => !n.read).length || 0;

  const activeCampaigns = (myData?.items || []).filter(
    (i) => i.application.status === "accepted" && i.deliverables.some((d) => d.status !== "live")
  );

  const newMatches = (campaignsData?.campaigns || [])
    .filter((c) => c.status === "open")
    .slice(0, 4);

  const firstName = user?.full_name?.split(" ")[0] || "Creator";

  return (
    <CreatorShell>
      <CreatorHeader
        title={`Hey ${firstName}`}
        subtitle="Let's turn content into cash today."
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

      <div className="px-5 space-y-6">
        {/* Earnings card */}
        <Link
          href="/earnings"
          className="block relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-[#0a1f8a] p-6 hover-elevate"
          data-testid="card-earnings"
        >
          <div
            className="absolute -top-10 -right-10 size-48 rounded-full opacity-30"
            style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
          />
          <div className="relative">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">
              Available balance
            </div>
            <div className="text-4xl font-black text-white tracking-tight">
              {fmtMoney(earnings?.balance_cents || 0)}
            </div>
            <div className="text-sm text-white/80 mt-1">
              Lifetime earned {fmtMoney(user?.total_earned_cents || 0)}
            </div>
            <div className="flex items-center gap-2 mt-5 text-sm font-semibold text-white">
              Withdraw
              <Icon name="arrow_forward" className="text-[18px]" />
            </div>
          </div>
        </Link>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon="explore" label="Discover" href="/discover" />
          <QuickAction icon="assignment" label="Campaigns" href="/campaigns" />
          <QuickAction icon="groups" label="Community" href="/community" />
        </div>

        {/* Active campaigns */}
        {activeCampaigns.length > 0 && (
          <section>
            <SectionHeader
              title="Active campaigns"
              action={<Link href="/campaigns">View all</Link>}
            />
            <div className="space-y-3">
              {activeCampaigns.slice(0, 3).map((i) => (
                <ActiveCampaignRow key={i.application.id} item={i} />
              ))}
            </div>
          </section>
        )}

        {/* New matches */}
        <section className="pb-4">
          <SectionHeader
            title="New matches for you"
            action={<Link href="/discover">See all</Link>}
          />
          <div className="grid grid-cols-2 gap-3">
            {newMatches.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="relative aspect-[4/5] rounded-2xl overflow-hidden hover-elevate"
                data-testid={`card-match-${c.id}`}
              >
                {c.cover_image_url ? (
                  <img src={c.cover_image_url} alt={c.title} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#4a4a4a] to-[#0a0a0a]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  <div className="text-[10px] uppercase tracking-widest text-white/70 font-semibold">
                    {c.brand.name}
                  </div>
                  <div className="text-sm font-extrabold leading-tight line-clamp-2 mt-0.5">{c.title}</div>
                  <div className="text-sm font-bold mt-1" style={{ color: "#6ea0ff" }}>
                    {fmtMoney(c.base_earning_cents)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </CreatorShell>
  );
}

function QuickAction({ icon, label, href }: { icon: string; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center gap-2 bg-card border border-border rounded-2xl py-4 hover-elevate"
      data-testid={`action-${label.toLowerCase()}`}
    >
      <Icon name={icon} className="text-[22px] text-primary" filled />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}

function ActiveCampaignRow({ item }: { item: MyItem }) {
  const next = item.deliverables.find((d) => d.status !== "live" && d.status !== "approved");
  const nextLabel =
    {
      pending: "Upload draft",
      submitted: "Awaiting review",
      revision: "Revise",
      approved: "Post live",
      rejected: "Rejected",
      live: "Live",
    }[next?.status || "pending"] || "In progress";
  const c = item.campaign;
  if (!c) return null;

  return (
    <Link
      href={`/campaigns/${c.id}`}
      className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl hover-elevate"
      data-testid={`row-active-${c.id}`}
    >
      <img
        src={c.cover_image_url || c.brand.logo_url || ""}
        alt=""
        className="size-14 rounded-xl object-cover shrink-0 bg-muted"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {c.brand.name}
        </div>
        <div className="text-sm font-extrabold leading-tight truncate">{c.title}</div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
              next?.status === "submitted"
                ? "bg-amber-500/15 text-amber-300"
                : next?.status === "revision"
                ? "bg-orange-500/15 text-orange-300"
                : "bg-primary/15 text-primary"
            )}
          >
            {nextLabel}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-base font-bold" style={{ color: "#6ea0ff" }}>
          {fmtMoney(c.base_earning_cents, { compact: true })}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {fmtCompact(c.slots_filled)}/{fmtCompact(c.slots_total)}
        </div>
      </div>
    </Link>
  );
}
