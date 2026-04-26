import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { INDIAN_LANGUAGES, INDIAN_NICHES } from "@creatorx/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreatorProfile } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { pickAndUploadImage } from "../../lib/image-upload";
import { createMobileApiClient } from "../../lib/queryClient";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

function ToggleChip({
  label,
  selected,
  testID,
  onPress,
}: {
  label: string;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      className={`mb-2 mr-2 rounded-lg border px-4 py-3 ${
        selected ? "border-indigo-600 bg-indigo-600" : "border-zinc-300 bg-white"
      }`}
    >
      <Text className={`text-sm font-bold ${selected ? "text-white" : "text-zinc-700"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileSettingsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [niches, setNiches] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<number | null>(null);

  const profileQuery = useQuery<CreatorProfile>({
    queryKey: ["creator", "profile"],
    queryFn: () => api.creator.getProfile(),
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? "");
    setNiches(profile.niches);
    setLanguages(profile.languages);
  }, [profileQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => api.creator.updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      niches,
      languages,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creator", "profile"] });
      showToast("Profile updated!");
    },
    onError: (error) => Alert.alert("Could not save profile", error instanceof Error ? error.message : "Please try again."),
  });

  const avatarMutation = useMutation({
    mutationFn: async () => {
      setAvatarUploadProgress(0);
      const publicUrl = await pickAndUploadImage({
        type: "avatar",
        onProgress: setAvatarUploadProgress,
      });
      if (!publicUrl) return null;
      return api.creator.updateProfile({ avatarUrl: publicUrl });
    },
    onSuccess: async (profile) => {
      if (!profile) return;
      await queryClient.invalidateQueries({ queryKey: ["creator", "profile"] });
      showToast("Profile updated!");
    },
    onError: (error) => Alert.alert("Could not upload avatar", error instanceof Error ? error.message : "Please try again."),
    onSettled: () => setAvatarUploadProgress(null),
  });

  function toggleValue(value: string, selected: string[], setSelected: (next: string[]) => void) {
    setSelected(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Profile" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={[]}
          keyExtractor={(_, index) => String(index)}
          renderItem={() => null}
          refreshControl={
            <RefreshControl refreshing={profileQuery.isRefetching} onRefresh={() => void profileQuery.refetch()} />
          }
          contentContainerClassName="px-5 pb-8 pt-5"
          ListHeaderComponent={
            <View>
              <View className="rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Display name</Text>
                <TextInput
                  testID="input-display-name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Creator name"
                  placeholderTextColor="#a1a1aa"
                  className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />

                <Text className="mb-2 mt-5 text-xs font-bold uppercase text-zinc-500">Bio</Text>
                <TextInput
                  testID="input-bio"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  textAlignVertical="top"
                  placeholder="What do you create?"
                  placeholderTextColor="#a1a1aa"
                  className="min-h-28 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-950"
                />

                <TouchableOpacity
                  testID="btn-upload-avatar"
                  disabled={avatarMutation.isPending}
                  onPress={() => avatarMutation.mutate()}
                  className="mt-5 h-12 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50"
                >
                  {avatarMutation.isPending ? (
                    <ActivityIndicator color="#4f46e5" />
                  ) : (
                    <Text className="text-sm font-black text-indigo-700">Upload avatar</Text>
                  )}
                </TouchableOpacity>
                {avatarMutation.isPending && avatarUploadProgress !== null ? (
                  <View testID="upload-progress-avatar" className="mt-3 rounded-lg bg-indigo-50 px-3 py-2">
                    <Text className="text-xs font-black text-indigo-700">
                      Uploading {avatarUploadProgress}%
                    </Text>
                  </View>
                ) : null}
              </View>

              <View testID="select-niches" className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="mb-3 text-xs font-bold uppercase text-zinc-500">Niches</Text>
                <View className="flex-row flex-wrap">
                  {INDIAN_NICHES.map((niche) => (
                    <ToggleChip
                      key={niche}
                      testID={`option-niche-${niche.toLowerCase()}`}
                      label={niche}
                      selected={niches.includes(niche)}
                      onPress={() => toggleValue(niche, niches, setNiches)}
                    />
                  ))}
                </View>
              </View>

              <View testID="select-languages" className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="mb-3 text-xs font-bold uppercase text-zinc-500">Languages</Text>
                <View className="flex-row flex-wrap">
                  {INDIAN_LANGUAGES.map((language) => (
                    <ToggleChip
                      key={language}
                      testID={`option-language-${language.toLowerCase()}`}
                      label={language}
                      selected={languages.includes(language)}
                      onPress={() => toggleValue(language, languages, setLanguages)}
                    />
                  ))}
                </View>
              </View>

              <TouchableOpacity
                testID="btn-save-profile"
                disabled={saveMutation.isPending || displayName.trim().length === 0}
                onPress={() => saveMutation.mutate()}
                className={`mt-6 h-14 items-center justify-center rounded-lg ${
                  displayName.trim().length > 0 ? "bg-indigo-600" : "bg-zinc-300"
                }`}
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
