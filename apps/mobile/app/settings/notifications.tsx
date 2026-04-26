import { useState } from "react";
import { Alert, FlatList, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { apiClient } from "../../lib/queryClient";

const OPTIONS = [
  { key: "campaign_invite", label: "New campaign invite", testID: "toggle-campaign-invite" },
  { key: "application_approved", label: "Application approved", testID: "toggle-application-approved" },
  { key: "deliverable_approved", label: "Deliverable approved", testID: "toggle-deliverable-approved" },
  { key: "message_received", label: "Message received", testID: "toggle-message-received" },
  { key: "payout_processed", label: "Payout processed", testID: "toggle-payout-processed" },
] as const;

type PreferenceKey = typeof OPTIONS[number]["key"];

const DEFAULT_PREFERENCES: Record<PreferenceKey, boolean> = {
  campaign_invite: true,
  application_approved: true,
  deliverable_approved: true,
  message_received: true,
  payout_processed: true,
};

export default function NotificationSettingsScreen() {
  const api = apiClient;
  const [preferences, setPreferences] = useState<Record<PreferenceKey, boolean>>(DEFAULT_PREFERENCES);

  const saveMutation = useMutation({
    mutationFn: (next: Record<PreferenceKey, boolean>) => api.creator.updateNotificationPreferences(next),
    onError: (error) => Alert.alert("Could not save preferences", error instanceof Error ? error.message : "Please try again."),
  });

  function toggle(key: PreferenceKey) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    saveMutation.mutate(next);
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Notifications" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={OPTIONS}
          keyExtractor={(item) => item.key}
          contentContainerClassName="p-5"
          renderItem={({ item }) => (
            <View className="mb-3 flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-4">
              <Text className="flex-1 pr-4 text-base font-black text-zinc-950">{item.label}</Text>
              <Switch
                testID={item.testID}
                value={preferences[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: "#d4d4d8", true: "#c7d2fe" }}
                thumbColor={preferences[item.key] ? "#6366f1" : "#ffffff"}
              />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
