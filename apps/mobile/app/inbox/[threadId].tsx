import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message, Thread } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { createMobileApiClient } from "../../lib/queryClient";
import { relativeTime } from "../../lib/format";

type ThreadMessagesData = { thread: Thread; messages: Message[] };

function MessageBubble({ message }: { message: Message }) {
  const isCreator = message.senderRole === "creator";
  return (
    <View className={`mb-4 ${isCreator ? "items-end" : "items-start"}`}>
      <View className={`max-w-[82%] rounded-2xl px-4 py-3 ${isCreator ? "bg-indigo-600" : "bg-zinc-200"}`}>
        <Text testID={`message-${message.id}`} className={`text-base ${isCreator ? "text-white" : "text-zinc-900"}`}>
          {message.body}
        </Text>
      </View>
      <Text className="mt-1 text-xs font-semibold text-zinc-400">{relativeTime(message.createdAt)}</Text>
    </View>
  );
}

export default function CreatorThreadScreen() {
  const params = useLocalSearchParams<{ threadId?: string }>();
  const threadId = typeof params.threadId === "string" ? params.threadId : "";
  const api = useMemo(() => createMobileApiClient(), []);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const messagesQuery = useQuery<ThreadMessagesData>({
    queryKey: ["creator", "threads", threadId, "messages"],
    queryFn: () => api.creator.getThreadMessages(threadId),
    enabled: threadId.length > 0,
    refetchInterval: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (messageBody: string) => api.creator.sendMessage(threadId, messageBody),
    onMutate: async (messageBody) => {
      await queryClient.cancelQueries({ queryKey: ["creator", "threads", threadId, "messages"] });
      const previous = queryClient.getQueryData<ThreadMessagesData>(["creator", "threads", threadId, "messages"]);
      const optimistic: Message = {
        id: `optimistic-${Date.now()}`,
        threadId,
        senderId: "me",
        senderRole: "creator",
        body: messageBody,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      if (previous) {
        queryClient.setQueryData<ThreadMessagesData>(["creator", "threads", threadId, "messages"], {
          ...previous,
          messages: [...previous.messages, optimistic],
        });
      }
      setBody("");
      return { previous };
    },
    onError: (_error, _body, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["creator", "threads", threadId, "messages"], context.previous);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["creator", "threads"] }),
        queryClient.invalidateQueries({ queryKey: ["creator", "threads", threadId, "messages"] }),
      ]);
    },
  });

  const messages = messagesQuery.data?.messages ?? [];
  const invertedMessages = [...messages].reverse();
  const thread = messagesQuery.data?.thread;
  const title = thread?.brand?.name ?? "Messages";
  const subtitle = thread?.campaign?.title;

  function send() {
    const trimmed = body.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed.slice(0, 2000));
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <ScreenHeader title={title} showBack />
      {subtitle ? <Text className="px-5 pb-2 text-sm font-bold text-zinc-500">{subtitle}</Text> : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        {messagesQuery.isLoading ? (
          <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>
        ) : (
          <FlatList
            inverted
            data={invertedMessages}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            contentContainerClassName="px-5 py-4"
          />
        )}
        <View className="border-t border-zinc-200 bg-white px-4 py-3">
          <View className="flex-row items-end gap-3">
            <TextInput
              testID="input-message"
              value={body}
              onChangeText={(text) => setBody(text.slice(0, 2000))}
              placeholder="Write a message"
              placeholderTextColor="#a1a1aa"
              multiline
              className="max-h-32 flex-1 rounded-2xl border border-zinc-200 px-4 py-3 text-base text-zinc-950"
            />
            <TouchableOpacity
              testID="btn-send"
              onPress={send}
              disabled={sendMutation.isPending || body.trim().length === 0}
              className={`rounded-2xl px-5 py-3 ${sendMutation.isPending || body.trim().length === 0 ? "bg-zinc-300" : "bg-indigo-600"}`}
            >
              <Text className="font-black text-white">{sendMutation.isPending ? "..." : "Send"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
