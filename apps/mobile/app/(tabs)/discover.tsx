import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { INDIAN_NICHES } from "@creatorx/schema";
import type { Campaign, PaginatedCampaigns } from "@creatorx/api-client";
import { CreatorShell } from "../../components/creator-shell";
import { createMobileApiClient } from "../../lib/queryClient";
import { formatINR, formatShortDate, platformIcon } from "../../lib/format";

function CampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <TouchableOpacity
      testID={`campaign-card-${campaign.id}`}
      onPress={() => router.push(`/campaigns/${campaign.id}`)}
      className="mb-4 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-black text-zinc-950" numberOfLines={2}>
            {campaign.title}
          </Text>
          <Text className="mt-1 text-sm font-semibold text-zinc-500" numberOfLines={1}>
            {campaign.brandName ?? "CreatorX Brand"}
          </Text>
        </View>
        <View className="rounded-full bg-indigo-50 px-3 py-1">
          <Text className="text-xs font-black text-indigo-600">{campaign.niche}</Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-base font-black text-zinc-950">{formatINR(campaign.budgetPaise)}</Text>
        <Text className="text-xs font-bold text-zinc-500">{formatShortDate(campaign.applicationDeadline)}</Text>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-xs font-bold text-zinc-500">
          {campaign.applicantCount ?? 0} applicants
        </Text>
        <View className="flex-row gap-2">
          {campaign.platforms.map((platform) => (
            <Ionicons key={platform} name={platformIcon(platform)} size={18} color="#71717a" />
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function DiscoverScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const campaignsQuery = useInfiniteQuery<PaginatedCampaigns>({
    queryKey: ["creator", "campaigns", "discover", debouncedSearch, selectedNiche],
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      api.creator.discoverCampaigns({
        search: debouncedSearch,
        niche: selectedNiche ?? undefined,
        cursor: typeof pageParam === "string" ? pageParam : undefined,
        limit: 20,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const campaigns = campaignsQuery.data?.pages.flatMap((page) => page.campaigns) ?? [];

  function refresh() {
    void campaignsQuery.refetch();
  }

  function loadMore() {
    if (campaignsQuery.hasNextPage && !campaignsQuery.isFetchingNextPage) {
      void campaignsQuery.fetchNextPage();
    }
  }

  return (
    <CreatorShell title="Discover">
      <FlatList
        data={campaigns}
        keyExtractor={(campaign) => campaign.id}
        renderItem={({ item }) => <CampaignCard campaign={item} />}
        refreshControl={<RefreshControl refreshing={campaignsQuery.isRefetching} onRefresh={refresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerClassName="px-5 pb-8"
        ListHeaderComponent={
          <View className="pb-5 pt-5">
            <View className="flex-row items-center rounded-lg border border-zinc-200 bg-white px-4">
              <Ionicons name="search" size={18} color="#71717a" />
              <TextInput
                testID="input-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search campaigns"
                placeholderTextColor="#a1a1aa"
                autoCapitalize="none"
                className="ml-3 h-12 flex-1 text-base text-zinc-950"
              />
            </View>

            <FlatList
              horizontal
              data={INDIAN_NICHES}
              keyExtractor={(niche) => niche}
              showsHorizontalScrollIndicator={false}
              className="mt-4"
              renderItem={({ item }) => {
                const isActive = selectedNiche === item;
                return (
                  <TouchableOpacity
                    testID={`chip-${item}`}
                    onPress={() => setSelectedNiche(isActive ? null : item)}
                    className={`mr-2 rounded-full border px-4 py-2 ${
                      isActive ? "border-indigo-500 bg-indigo-500" : "border-zinc-300 bg-white"
                    }`}
                  >
                    <Text className={`text-sm font-bold ${isActive ? "text-white" : "text-zinc-600"}`}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
        ListEmptyComponent={
          campaignsQuery.isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator />
            </View>
          ) : (
            <View testID="empty-state-discover" className="items-center py-16">
              <Ionicons name="search" size={32} color="#9ca3af" />
              <Text className="mt-3 text-base font-bold text-zinc-500">No campaigns found</Text>
            </View>
          )
        }
        ListFooterComponent={
          campaignsQuery.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator />
            </View>
          ) : null
        }
      />
    </CreatorShell>
  );
}
