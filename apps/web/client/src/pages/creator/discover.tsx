import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import type { Campaign, Brand } from "@creatorx/schema";
import { apiRequest } from "@/lib/queryClient";

type CampaignWithBrand = Campaign & { brand: Brand };

const CATEGORIES = ["All", "Fashion", "Beauty", "Fitness", "Food", "Tech", "Finance", "Travel", "Lifestyle", "Gaming"];

type Eligibility = { eligible: boolean; reasons: string[] };

function useEligibility(campaignId: string) {
  return useQuery<Eligibility>({
    queryKey: ["/api/campaigns", campaignId, "eligibility"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/eligibility`);
      return res.json();
    },
  });
}

function EligibilityBadge({ campaignId }: { campaignId: string }) {
  const { data } = useEligibility(campaignId);
  if (!data) return null;
  if (data.eligible) {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-green-500/80 text-white px-2 py-0.5 rounded-full backdrop-blur-sm" data-testid={`badge-eligible-${campaignId}`}>
        <Icon name="check_circle" filled className="text-[10px]" /> Eligible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-black/70 text-white px-2 py-0.5 rounded-full backdrop-blur-sm" data-testid={`badge-locked-${campaignId}`} title={data.reasons.join("; ")}>
      <Icon name="lock" filled className="text-[10px]" /> Locked
    </span>
  );
}

export default function DiscoverPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");

  const { data } = useQuery<{ campaigns: CampaignWithBrand[] }>({
    queryKey: ["/api/campaigns", category !== "All" ? `?category=${category}` : ""],
  });

  const { data: notifData } = useQuery<{ notifications: { read: boolean }[] }>({
    queryKey: ["/api/notifications"],
  });
  const unread = notifData?.notifications?.filter((n) => !n.read).length || 0;

  const campaigns = (data?.campaigns || []).filter((c) => {
    if (c.status !== "open") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.brand?.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const featured = campaigns.filter((c) => c.featured);
  const forYou = campaigns.filter((c) => !c.featured);

  return (
    <CreatorShell>
      <CreatorHeader
        title="Discover"
        subtitle="Find campaigns that fit you"
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

      <div className="px-5 space-y-5">
        {/* Search */}
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]" />
          <Input
            placeholder="Search campaigns, brands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-10 pr-12 bg-card border-border rounded-2xl"
            data-testid="input-search"
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg hover-elevate flex items-center justify-center">
            <Icon name="tune" className="text-[20px] text-muted-foreground" />
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
          {CATEGORIES.map((c) => {
            const on = c === category;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-semibold border whitespace-nowrap transition-colors hover-elevate",
                  on ? "bg-primary border-primary text-primary-foreground" : "bg-transparent border-border text-foreground"
                )}
                data-testid={`chip-category-${c.toLowerCase()}`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section>
            <SectionHeader title="Featured opportunities" />
            <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 snap-x snap-mandatory">
              {featured.map((c) => (
                <FeaturedCard key={c.id} campaign={c} />
              ))}
            </div>
          </section>
        )}

        {/* For You */}
        <section className="pb-4">
          <SectionHeader title="For you" />
          {forYou.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {forYou.map((c) => (
                <ForYouCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </section>
      </div>
    </CreatorShell>
  );
}

function FeaturedCard({ campaign }: { campaign: CampaignWithBrand }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="relative shrink-0 snap-center w-[280px] aspect-[4/5] rounded-3xl overflow-hidden group hover-elevate"
      data-testid={`card-featured-${campaign.id}`}
    >
      {/* Gradient hero */}
      <div className="absolute inset-0" style={{
        background: campaign.high_ticket
          ? "linear-gradient(135deg, #ff9a9e 0%, #fad0c4 25%, #fbc2eb 50%, #a18cd1 75%, #8ec5fc 100%)"
          : "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
      }} />
      {campaign.cover_image_url && (
        <img src={campaign.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Badge */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
        <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
          {campaign.high_ticket ? "High Ticket" : "Trending"}
        </span>
        <EligibilityBadge campaignId={campaign.id} />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
        <h3 className="text-xl font-extrabold leading-tight mb-2">{campaign.title}</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-primary font-bold text-base" style={{ color: "#6ea0ff" }}>
            {fmtMoney(campaign.base_earning_cents)}
          </span>
          <span className="text-white/70">•</span>
          <span className="text-white/80">{campaign.deliverables.reduce((a, d) => a + d.qty, 0)} {campaign.deliverables.length > 1 ? "Deliverables" : "Video"}</span>
        </div>
      </div>
    </Link>
  );
}

function ForYouCard({ campaign }: { campaign: CampaignWithBrand }) {
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="relative aspect-[4/5] rounded-2xl overflow-hidden group hover-elevate"
      data-testid={`card-campaign-${campaign.id}`}
    >
      <img
        src={campaign.cover_image_url || ""}
        alt={campaign.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      {/* Brand logo + eligibility badge */}
      {campaign.brand?.logo_url && (
        <div className="absolute top-2.5 left-2.5 size-8 rounded-full bg-white p-0.5 overflow-hidden">
          <img src={campaign.brand.logo_url} alt="" className="w-full h-full rounded-full object-cover" />
        </div>
      )}
      <div className="absolute top-2.5 right-2.5">
        <EligibilityBadge campaignId={campaign.id} />
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
        <h3 className="text-sm font-extrabold leading-tight mb-1 line-clamp-2">{campaign.title}</h3>
        <div className="flex items-center gap-1.5 text-sm">
          <span style={{ color: "#6ea0ff" }} className="font-bold">{fmtMoney(campaign.base_earning_cents)}</span>
          {campaign.product_bonus && <span className="text-white/70 text-xs">+Product</span>}
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-card border border-border rounded-2xl p-10 text-center">
      <Icon name="search_off" className="text-[40px] text-muted-foreground mb-2" />
      <div className="font-semibold mb-1">No campaigns match</div>
      <p className="text-sm text-muted-foreground">Try a different category or clear your search.</p>
    </div>
  );
}
