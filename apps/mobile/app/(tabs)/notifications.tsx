import { useMemo } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Notification } from "@creatorx/api-client";
import { CreatorShell } from "../../components/creator-shell";
import { createMobileApiClient, queryClient } from "../../lib/queryClient";
import { relativeTime } from "../../lib/format";

function destinationForNotification(notification: Notification): string | null {
  const type = notification.data?.type ?? notification.type;
  const campaignId = notification.data?.campaignId;
  const threadId = notification.data?.threadId;

  if ((type === "campaign_invite" || type === "application_approved" || type === "deliverable_approved") && campaignId) {
    return `/campaigns/${campaignId}`;
  }
  if (type === "message_received" && threadId) return `/inbox/${threadId}`;
  if (type === "payout_processed") return "/(tabs)/earnings";
  return null;
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: (notification: Notification) => void;
}) {
  const unread = !notification.readAt;
  return (
    <TouchableOpacity
      testID={`notification-${notification.id}`}
      onPress={() => onPress(notification)}
      className={`mb-3 rounded-lg border p-4 ${
        unread ? "border-indigo-100 bg-indigo-50" : "border-zinc-200 bg-white"
      }`}
    >
      <View className="flex-row items-start">
        {unread ? <View className="mr-3 mt-1.5 h-2.5 w-2.5 rounded-full bg-indigo-500" /> : null}
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 pr-3 text-base font-black text-zinc-950" numberOfLines={1}>
              {notification.title}
            </Text>
            <Text className="text-xs font-semibold text-zinc-400">{relativeTime(notification.createdAt)}</Text>
          </View>
          <Text className="mt-1 text-sm leading-5 text-zinc-600" numberOfLines={3}>
            {notification.body}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ["creator", "notifications"],
    queryFn: () => api.creator.getNotifications(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.creator.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["creator", "notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["creator", "notifications", "recent"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.creator.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["creator", "notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["creator", "notifications", "recent"] });
    },
  });

  function refresh() {
    void notificationsQuery.refetch();
  }

  async function openNotification(notification: Notification) {
    if (!notification.readAt) {
      await markReadMutation.mutateAsync(notification.id);
    }

    const destination = destinationForNotification(notification);
    if (destination) router.push(destination);
  }

  return (
    <CreatorShell
      title="Notifications"
      rightElement={
        <TouchableOpacity
          testID="btn-mark-all-read"
          onPress={() => markAllMutation.mutate()}
          className="rounded-full bg-zinc-100 px-3 py-2"
        >
          <Text className="text-xs font-black text-zinc-700">Mark all</Text>
        </TouchableOpacity>
      }
    >
      <FlatList
        data={notificationsQuery.data ?? []}
        keyExtractor={(notification) => notification.id}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={(notification) => void openNotification(notification)} />
        )}
        refreshControl={<RefreshControl refreshing={notificationsQuery.isRefetching} onRefresh={refresh} />}
        contentContainerClassName="px-5 pb-8 pt-5"
        ListEmptyComponent={
          <View testID="empty-state-notifications" className="items-center py-16">
            <Text className="text-base font-bold text-zinc-500">You're all caught up!</Text>
          </View>
        }
      />
    </CreatorShell>
  );
}
