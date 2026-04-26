import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { apiClient } from "../../lib/queryClient";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

export default function SocialAccountsSettingsScreen() {
  const api = apiClient;
  const queryClient = useQueryClient();
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");

  const saveMutation = useMutation({
    mutationFn: () => api.creator.updateSocialAccounts({
      instagram,
      youtube,
      twitter,
      linkedin,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creator", "profile"] });
      showToast("Social accounts updated!");
    },
    onError: (error) => Alert.alert("Could not save socials", error instanceof Error ? error.message : "Please try again."),
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Social Accounts" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={[]}
          keyExtractor={(_, index) => String(index)}
          renderItem={() => null}
          contentContainerClassName="px-5 pb-8 pt-5"
          ListHeaderComponent={
            <View className="rounded-lg border border-zinc-200 bg-white p-4">
              <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Instagram handle</Text>
              <TextInput
                testID="input-instagram"
                value={instagram}
                onChangeText={setInstagram}
                autoCapitalize="none"
                placeholder="@creator"
                placeholderTextColor="#a1a1aa"
                className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
              />

              <Text className="mb-2 mt-5 text-xs font-bold uppercase text-zinc-500">YouTube handle</Text>
              <TextInput
                testID="input-youtube"
                value={youtube}
                onChangeText={setYoutube}
                autoCapitalize="none"
                placeholder="@creator"
                placeholderTextColor="#a1a1aa"
                className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
              />

              <Text className="mb-2 mt-5 text-xs font-bold uppercase text-zinc-500">Twitter handle</Text>
              <TextInput
                testID="input-twitter"
                value={twitter}
                onChangeText={setTwitter}
                autoCapitalize="none"
                placeholder="@creator"
                placeholderTextColor="#a1a1aa"
                className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
              />

              <Text className="mb-2 mt-5 text-xs font-bold uppercase text-zinc-500">LinkedIn handle</Text>
              <TextInput
                testID="input-linkedin"
                value={linkedin}
                onChangeText={setLinkedin}
                autoCapitalize="none"
                placeholder="creator"
                placeholderTextColor="#a1a1aa"
                className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
              />

              <TouchableOpacity
                testID="btn-save-socials"
                disabled={saveMutation.isPending}
                onPress={() => saveMutation.mutate()}
                className="mt-6 h-14 items-center justify-center rounded-lg bg-indigo-600"
              >
                {saveMutation.isPending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-base font-black text-white">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
