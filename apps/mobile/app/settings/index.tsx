import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../components/screen-header";

const ROWS = [
  { label: "Profile", slug: "profile", href: "/settings/profile" },
  { label: "Social Accounts", slug: "social-accounts", href: "/settings/social-accounts" },
  { label: "Payment Methods", slug: "payment-methods", href: "/settings/payment-methods" },
  { label: "KYC", slug: "kyc", href: "/settings/kyc" },
  { label: "Notifications", slug: "notifications", href: "/settings/notifications" },
  { label: "Security", slug: "security", href: "/settings/security" },
  { label: "Legal", slug: "legal", href: "/settings/legal" },
] as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Settings" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={ROWS}
          keyExtractor={(item) => item.slug}
          contentContainerClassName="p-5"
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`settings-row-${item.slug}`}
              onPress={() => router.push(item.href)}
              className="mb-3 flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-4"
            >
              <Text className="text-base font-black text-zinc-950">{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color="#71717a" />
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
