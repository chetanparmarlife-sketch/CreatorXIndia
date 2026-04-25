import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Campaign, HomeStats, Notification } from "@creatorx/api-client";
import { CreatorShell } from "../../components/creator-shell";
import { useAuth } from "../../lib/auth";
import { createMobileApiClient } from "../../lib/queryClient";
import { formatINR, formatShortDate, greetingForNow, initials, relativeTime } from "../../lib/format";

function StatCard({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View testID={testID} className="flex-1 rounded-lg border border-zinc-200 bg-white p-3">
      <Text className="text-xs font-bold uppercase text-zinc-500">{label}</Text>
      <Text className="mt-2 text-lg font-black text-zinc-950">{value}</Text>
    </View>
  );
}

function FeaturedCampaignCard({ campaign }: { campaign: Campaign }) {
  return (
    <TouchableOpacity
      testID={`featured-campaign-${campaign.id}`}
      onPress={() => router.push(`/campaigns/${campaign.id}`)}
      className="mr-3 w-72 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <Text className="text-lg font-black text-zinc-950" numberOfLines={2}>
        {campaign.title}
      </Text>
      <Text className="mt-2 text-sm font-semibold text-zinc-500" numberOfLines={1}>
        {campaign.brandName ?? "CreatorX Brand"}
      </Text>
      <View className="mt-4 flex-row items-center justify-between">
        <Text className="text-base font-black text-indigo-600">{formatINR(campaign.budgetPaise)}</Text>
        <Text className="text-xs font-bold text-zinc-500">{formatShortDate(campaign.applicationDeadline)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function NotificationPreview({ notification }: { notification: Notification }) {
  return (
    <TouchableOpacity
      testID={`notification-row-${notification.id}`}
      onPress={() => router.push("/(tabs)/notifications")}
      className="mb-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <View className="flex-row items-start justify-between">
        <Text className="flex-1 pr-3 text-sm font-black text-zinc-950" numberOfLines={1}>
          {notification.title}
        </Text>
        <Text className="text-xs font-semibold text-zinc-400">{relativeTime(notification.createdAt)}</Text>
      </View>
      <Text className="mt-1 text-sm leading-5 text-zinc-600" numberOfLines={2}>
        {notification.body}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const api = useMemo(() => createMobileApiClient(), []);

  const profileQuery = useQuery({
    queryKey: ["creator", "profile"],
    queryFn: () => api.creator.getProfile(),
  });
  const statsQuery = useQuery<HomeStats>({
    queryKey: ["creator", "home-stats"],
    queryFn: () => api.creator.getHomeStats(),
  });
  const campaignsQuery = useQuery<Campaign[]>({
    queryKey: ["creator", "campaigns", "featured"],
    queryFn: () => api.creator.getCampaigns("active", 5),
  });
  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ["creator", "notifications", "recent"],
    queryFn: () => api.creator.getNotifications(3),
  });

  const profile = profileQuery.data;
  const displayName = profile?.displayName ?? user?.email.split("@")[0] ?? "Creator";
  const stats = statsQuery.data;
  const campaigns = campaignsQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];
  const isRefreshing =
    profileQuery.isRefetching ||
    statsQuery.isRefetching ||
    campaignsQuery.isRefetching ||
    notificationsQuery.isRefetching;

  function refresh() {
    void Promise.all([
      profileQuery.refetch(),
      statsQuery.refetch(),
      campaignsQuery.refetch(),
      notificationsQuery.refetch(),
    ]);
  }

  return (
    <CreatorShell title="Home">
      <FlatList
        data={[]}
        keyExtractor={(_, index) => String(index)}
        renderItem={() => null}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
        contentContainerClassName="px-5 pb-8"
        ListHeaderComponent={
          <View>
            <View className="mt-5 rounded-lg bg-indigo-500 p-5">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-bold uppercase text-indigo-100">{greetingForNow()}</Text>
                  <Text className="mt-2 text-2xl font-black text-white" numberOfLines={2}>
                    {displayName}
                  </Text>
                </View>
                {profile?.avatarUrl ? (
                  <Image
                    testID="home-avatar"
                    source={{ uri: profile.avatarUrl }}
                    className="h-16 w-16 rounded-full bg-indigo-200"
                  />
                ) : (
                  <View
                    testID="home-avatar"
                    className="h-16 w-16 items-center justify-center rounded-full bg-white"
                  >
                    <Text className="text-lg font-black text-indigo-600">{initials(displayName)}</Text>
                  </View>
                )}
              </View>
            </View>

            <View className="mt-5 flex-row gap-3">
              <StatCard
                testID="stat-active-applications"
                label="Active Applications"
                value={String(stats?.activeApplications ?? 0)}
              />
              <StatCard
                testID="stat-pending-deliverables"
                label="Pending Deliverables"
                value={String(stats?.pendingDeliverables ?? 0)}
              />
              <StatCard
                testID="stat-available-balance"
                label="Available Balance"
                value={formatINR(stats?.availableForWithdrawalPaise ?? 0)}
              />
            </View>

            <View className="mt-8">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xl font-black text-zinc-950">Featured campaigns</Text>
                {campaignsQuery.isLoading ? <ActivityIndicator /> : null}
              </View>
              <FlatList
                horizontal
                data={campaigns}
                keyExtractor={(campaign) => campaign.id}
                renderItem={({ item }) => <FeaturedCampaignCard campaign={item} />}
                showsHorizontalScrollIndicator={false}
              />
            </View>

            <View className="mt-8">
              <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-xl font-black text-zinc-950">Recent notifications</Text>
                <TouchableOpacity
                  testID="link-see-all-notifications"
                  onPress={() => router.push("/(tabs)/notifications")}
                  className="rounded-full px-3 py-2"
                >
                  <Text className="text-sm font-black text-indigo-600">See all</Text>
                </TouchableOpacity>
              </View>
              {notifications.map((notification) => (
                <NotificationPreview key={notification.id} notification={notification} />
              ))}
            </View>
          </View>
        }
      />
    </CreatorShell>
  );
}
