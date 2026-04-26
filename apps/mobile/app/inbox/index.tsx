
import { ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { Thread } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { apiClient } from "../../lib/queryClient";
import { initials, relativeTime } from "../../lib/format";

function ThreadRow({ thread }: { thread: Thread }) {
  const brandName = thread.brand?.name ?? "CreatorX Brand";
  const preview = thread.lastMessagePreview.length > 60
    ? `${thread.lastMessagePreview.slice(0, 57)}...`
    : thread.lastMessagePreview;

  return (
    <TouchableOpacity
      testID={`thread-row-${thread.id}`}
      onPress={() => router.push(`/inbox/${thread.id}`)}
      className="mb-3 flex-row rounded-2xl border border-zinc-200 bg-white p-4"
    >
      {thread.brand?.logoUrl ? (
        <Image source={{ uri: thread.brand.logoUrl }} className="h-12 w-12 rounded-full bg-zinc-200" />
      ) : (
        <View className="h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
          <Text className="text-sm font-black text-indigo-700">{initials(brandName)}</Text>
        </View>
      )}
      <View className="ml-3 flex-1">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-base font-black text-zinc-950" numberOfLines={1}>{brandName}</Text>
            {thread.campaign ? (
              <Text className="mt-0.5 text-xs font-bold text-zinc-500" numberOfLines={1}>{thread.campaign.title}</Text>
            ) : null}
          </View>
          <Text className="text-xs font-bold text-zinc-400">{relativeTime(thread.lastMessageAt)}</Text>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="flex-1 text-sm font-semibold text-zinc-500" numberOfLines={1}>
            {preview || "No messages yet"}
          </Text>
          {thread.unreadCount > 0 ? (
            <View className="ml-3 min-w-6 items-center rounded-full bg-indigo-600 px-2 py-1">
              <Text className="text-xs font-black text-white">{thread.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CreatorInboxScreen() {
  const api = apiClient;
  const threadsQuery = useQuery<Thread[]>({
    queryKey: ["creator", "threads"],
    queryFn: () => api.creator.getThreads(),
  });

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <ScreenHeader title="Inbox" showBack />
      <FlatList
        data={threadsQuery.data ?? []}
        keyExtractor={(thread) => thread.id}
        renderItem={({ item }) => <ThreadRow thread={item} />}
        refreshControl={<RefreshControl refreshing={threadsQuery.isRefetching} onRefresh={() => void threadsQuery.refetch()} />}
        contentContainerClassName="px-5 pb-8 pt-4"
        ListEmptyComponent={
          threadsQuery.isLoading ? (
            <View className="items-center py-16"><ActivityIndicator /></View>
          ) : (
            <View testID="empty-state-inbox" className="items-center py-16">
              <Text className="text-center text-base font-bold text-zinc-500">No messages yet.</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}
