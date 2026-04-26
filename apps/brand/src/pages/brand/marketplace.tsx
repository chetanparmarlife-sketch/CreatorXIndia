import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { INDIAN_NICHES, type SocialPlatform } from "@creatorx/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Icon } from "@/components/brand";
import { useBrandContext } from "@/hooks/useBrandContext";

type MarketplaceCreator = {
  id: string;
  display_name: string;
  handle: string;
  bio: string | null;
  avatar_url: string | null;
  follower_count: number;
  niches: string[];
  platforms: SocialPlatform[];
  profile_complete: boolean;
};

type MarketplaceResponse = {
  creators: MarketplaceCreator[];
  nextCursor: string | null;
};

type MarketplaceFilters = {
  search: string;
  niches: string[];
  platforms: SocialPlatform[];
  minFollowers: string;
  maxFollowers: string;
};

const PLATFORM_OPTIONS: SocialPlatform[] = ["instagram", "youtube", "twitter", "linkedin"];

function formatFollowerCount(value: number): string {
  if (value >= 1_000_000) {
    const scaled = value / 1_000_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const scaled = value / 1_000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}K`;
  }
  return `${value}`;
}

function platformIcon(platform: SocialPlatform): string {
  if (platform === "instagram") return "photo_camera";
  if (platform === "youtube") return "smart_display";
  if (platform === "twitter") return "alternate_email";
  return "work";
}

export default function MarketplacePage() {
  const [, navigate] = useLocation();
  const { brandId } = useBrandContext();

  const [draftFilters, setDraftFilters] = useState<MarketplaceFilters>({
    search: "",
    niches: [],
    platforms: [],
    minFollowers: "",
    maxFollowers: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MarketplaceFilters>({
    search: "",
    niches: [],
    platforms: [],
    minFollowers: "",
    maxFollowers: "",
  });

  const marketplaceQuery = useInfiniteQuery({
    queryKey: ["brand", brandId, "marketplace", appliedFilters],
    initialPageParam: "" as string,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (appliedFilters.search.trim()) params.set("search", appliedFilters.search.trim());
      if (appliedFilters.niches.length > 0) params.set("niches", appliedFilters.niches.join(","));
      if (appliedFilters.platforms.length > 0) params.set("platforms", appliedFilters.platforms.join(","));
      if (appliedFilters.minFollowers.trim()) params.set("minFollowers", appliedFilters.minFollowers.trim());
      if (appliedFilters.maxFollowers.trim()) params.set("maxFollowers", appliedFilters.maxFollowers.trim());
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "20");

      const url = `/api/brand/marketplace?${params.toString()}`;
      const res = await apiRequest("GET", url);
      return (await res.json()) as MarketplaceResponse;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const creators = useMemo(
    () => marketplaceQuery.data?.pages.flatMap((page) => page.creators) ?? [],
    [marketplaceQuery.data],
  );

  function toggleNiche(niche: string) {
    setDraftFilters((current) => {
      const exists = current.niches.includes(niche);
      return {
        ...current,
        niches: exists ? current.niches.filter((item) => item !== niche) : [...current.niches, niche],
      };
    });
  }

  function togglePlatform(platform: SocialPlatform) {
    setDraftFilters((current) => {
      const exists = current.platforms.includes(platform);
      return {
        ...current,
        platforms: exists ? current.platforms.filter((item) => item !== platform) : [...current.platforms, platform],
      };
    });
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <h1 className="text-3xl font-bold">Creator Marketplace</h1>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Search by name, handle, bio"
              value={draftFilters.search}
              onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
              data-testid="input-search-creators"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={0}
                placeholder="Min followers"
                value={draftFilters.minFollowers}
                onChange={(event) => setDraftFilters((current) => ({ ...current, minFollowers: event.target.value }))}
                data-testid="input-min-followers"
              />
              <Input
                type="number"
                min={0}
                placeholder="Max followers"
                value={draftFilters.maxFollowers}
                onChange={(event) => setDraftFilters((current) => ({ ...current, maxFollowers: event.target.value }))}
                data-testid="input-max-followers"
              />
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Niches</p>
            <div className="flex flex-wrap gap-2" data-testid="filter-niche">
              {INDIAN_NICHES.map((niche) => (
                <button
                  key={niche}
                  type="button"
                  onClick={() => toggleNiche(niche)}
                  data-testid={`filter-niche-${niche.toLowerCase().replace(/\s+/g, "-")}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    draftFilters.niches.includes(niche)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground",
                  )}
                >
                  {niche}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Platforms</p>
            <div className="flex flex-wrap gap-2" data-testid="filter-platform">
              {PLATFORM_OPTIONS.map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  data-testid={`filter-platform-${platform}`}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize",
                    draftFilters.platforms.includes(platform)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground",
                  )}
                >
                  {platform}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setAppliedFilters({ ...draftFilters })}
              data-testid="btn-search"
            >
              Search
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          {marketplaceQuery.isLoading && <p className="text-sm text-muted-foreground">Loading creators...</p>}
          {!marketplaceQuery.isLoading && creators.length === 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
              No creators found for the selected filters.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {creators.map((creator) => (
              <article
                key={creator.id}
                className="rounded-2xl border border-border bg-card p-4"
                data-testid={`creator-card-${creator.id}`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={creator.avatar_url || ""}
                    alt=""
                    className="h-12 w-12 rounded-full bg-muted object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{creator.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{creator.handle.startsWith("@") ? creator.handle : `@${creator.handle}`}</p>
                  </div>
                </div>

                <p className="mt-3 text-sm">{formatFollowerCount(creator.follower_count)} followers</p>

                <div className="mt-2 flex flex-wrap gap-1">
                  {creator.niches.slice(0, 3).map((niche) => (
                    <span key={niche} className="rounded-full bg-muted px-2 py-1 text-[11px]">
                      {niche}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {creator.platforms.map((platform) => (
                    <span key={platform} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted">
                      <Icon name={platformIcon(platform)} className="text-[16px]" />
                    </span>
                  ))}
                </div>

                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  onClick={() => navigate(`/creators/${creator.id}`)}
                  data-testid={`btn-view-creator-${creator.id}`}
                >
                  View Profile
                </Button>
              </article>
            ))}
          </div>

          {marketplaceQuery.hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                onClick={() => marketplaceQuery.fetchNextPage()}
                disabled={marketplaceQuery.isFetchingNextPage}
                data-testid="btn-load-more"
              >
                {marketplaceQuery.isFetchingNextPage ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
