import { useMemo, useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { CreatorApplication } from "@creatorx/api-client";
import { CreatorShell } from "../../components/creator-shell";
import { createMobileApiClient } from "../../lib/queryClient";
import { formatINR } from "../../lib/format";

type CampaignFilter = "all" | "applied" | "active" | "completed";

const FILTERS: Array<{ label: string; value: CampaignFilter }> = [
  { label: "All", value: "all" },
  { label: "Applied", value: "applied" },
  { label: "Active", value: "active" },
  { label: "Completed", value: "completed" },
];

function statusClasses(status: string): string {
  if (status === "accepted" || status === "active" || status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function CampaignApplicationCard({ item }: { item: CreatorApplication }) {
  const applicationStatus = item.status === "accepted" ? "approved" : item.status;

  return (
    <TouchableOpacity
      testID={`my-campaign-card-${item.applicationId}`}
      onPress={() => router.push(`/campaigns/${item.campaign.id}`)}
      className="mb-4 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <Text className="text-lg font-black text-zinc-950" numberOfLines={2}>
        {item.campaign.title}
      </Text>
      <Text className="mt-1 text-sm font-semibold text-zinc-500" numberOfLines={1}>
        {item.brandName ?? item.campaign.brandName ?? "CreatorX Brand"}
      </Text>

      <View className="mt-4 flex-row flex-wrap gap-2">
        <View className={`rounded-full px-3 py-1 ${statusClasses(applicationStatus)}`}>
          <Text className="text-xs font-black capitalize">{applicationStatus}</Text>
        </View>
        {item.deliverableStatus ? (
          <View className={`rounded-full px-3 py-1 ${statusClasses(item.deliverableStatus)}`}>
            <Text className="text-xs font-black capitalize">{item.deliverableStatus}</Text>
          </View>
        ) : null}
      </View>

      <Text className="mt-4 text-base font-black text-indigo-600">{formatINR(item.campaign.budgetPaise)}</Text>
    </TouchableOpacity>
  );
}

export default function MyCampaignsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const [activeFilter, setActiveFilter] = useState<CampaignFilter>("all");
  const status = activeFilter === "all" ? undefined : activeFilter;

  const applicationsQuery = useQuery<CreatorApplication[]>({
    queryKey: ["creator", "my-campaigns", activeFilter],
    queryFn: () => api.creator.getMyApplications(status),
  });

  function refresh() {
    void applicationsQuery.refetch();
  }

  return (
    <CreatorShell title="My Campaigns">
      <FlatList
        data={applicationsQuery.data ?? []}
        keyExtractor={(item) => item.applicationId}
        renderItem={({ item }) => <CampaignApplicationCard item={item} />}
        refreshControl={<RefreshControl refreshing={applicationsQuery.isRefetching} onRefresh={refresh} />}
        contentContainerClassName="px-5 pb-8"
        ListHeaderComponent={
          <View className="flex-row gap-2 py-5">
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.value;
              return (
                <TouchableOpacity
                  key={filter.value}
                  testID={`tab-${filter.value}`}
                  onPress={() => setActiveFilter(filter.value)}
                  className={`rounded-full px-4 py-2 ${isActive ? "bg-indigo-500" : "border border-zinc-300 bg-white"}`}
                >
                  <Text className={`text-sm font-black ${isActive ? "text-white" : "text-zinc-600"}`}>
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        }
        ListEmptyComponent={
          <View testID="empty-state-campaigns" className="items-center py-16">
            <Text className="text-center text-base font-bold text-zinc-500">
              No campaigns yet. Discover campaigns to apply.
            </Text>
          </View>
        }
      />
    </CreatorShell>
  );
}
