import { FlatList, Linking, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../components/screen-header";

const LINKS = [
  { label: "Terms of Service", url: "https://creatorx.app/terms", testID: "link-tos" },
  { label: "Privacy Policy", url: "https://creatorx.app/privacy", testID: "link-privacy" },
  { label: "Contact Support", url: "mailto:support@creatorx.app", testID: "link-support" },
] as const;

export default function LegalSettingsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Legal" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={LINKS}
          keyExtractor={(item) => item.testID}
          contentContainerClassName="p-5"
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={item.testID}
              onPress={() => void Linking.openURL(item.url)}
              className="mb-3 flex-row items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-4"
            >
              <Text className="text-base font-black text-zinc-950">{item.label}</Text>
              <Ionicons name="open-outline" size={20} color="#71717a" />
            </TouchableOpacity>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
