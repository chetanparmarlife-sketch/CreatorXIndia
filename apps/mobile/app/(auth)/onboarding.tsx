import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import { INDIAN_NICHES } from "@creatorx/schema";
import { useAuth } from "../../lib/auth";
import { apiClient } from "../../lib/queryClient";

export default function OnboardingScreen() {
  const { user, isLoading } = useAuth();
  const api = apiClient;
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileComplete = user?.profileComplete ?? user?.profile_complete;

  function toggleNiche(niche: string) {
    setSelectedNiches((current) =>
      current.includes(niche)
        ? current.filter((item) => item !== niche)
        : [...current, niche],
    );
  }

  async function completeProfile() {
    setIsSubmitting(true);
    setError(null);

    try {
      await api.creator.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        niches: selectedNiches,
        profileComplete: true,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete profile");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (profileComplete === true) return <Redirect href="/(tabs)" />;

  const canSubmit = displayName.trim().length > 0 && selectedNiches.length > 0 && !isSubmitting;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-12">
      <Text className="text-3xl font-black text-zinc-950">Complete profile</Text>
      <Text className="mt-3 text-base leading-6 text-zinc-600">
        Add the basics brands need before they invite you.
      </Text>

      <View className="mt-8">
        <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Display name</Text>
        <TextInput
          testID="input-display-name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your creator name"
          placeholderTextColor="#a1a1aa"
          className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
        />
      </View>

      <View className="mt-5">
        <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Bio</Text>
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
      </View>

      <View testID="select-niches" className="mt-6 flex-row flex-wrap gap-2">
        {INDIAN_NICHES.map((niche) => {
          const selected = selectedNiches.includes(niche);
          return (
            <TouchableOpacity
              key={niche}
              testID={`option-niche-${niche.toLowerCase()}`}
              onPress={() => toggleNiche(niche)}
              className={`rounded-lg border px-4 py-3 ${
                selected ? "border-zinc-950 bg-zinc-950" : "border-zinc-300 bg-white"
              }`}
            >
              <Text className={`text-sm font-bold ${selected ? "text-white" : "text-zinc-700"}`}>
                {niche}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? <Text className="mt-4 text-sm font-semibold text-red-600">{error}</Text> : null}

      <TouchableOpacity
        testID="btn-complete-profile"
        disabled={!canSubmit}
        onPress={completeProfile}
        className={`mt-8 h-14 items-center justify-center rounded-lg ${
          canSubmit ? "bg-zinc-950" : "bg-zinc-300"
        }`}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-base font-bold text-white">Complete Profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
