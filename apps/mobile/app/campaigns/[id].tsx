import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CampaignDetail } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { pickAndUploadImage } from "../../lib/image-upload";
import { createMobileApiClient } from "../../lib/queryClient";
import { formatINR, formatShortDate, platformIcon } from "../../lib/format";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

function isApprovedStatus(status: string): boolean {
  return status === "approved" || status === "accepted";
}

function StatusBadge({ status }: { status: string }) {
  const classes = isApprovedStatus(status)
    ? "bg-emerald-50 text-emerald-700"
    : status === "rejected"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-700";

  return (
    <View className={`rounded-full px-3 py-1 ${classes}`}>
      <Text className="text-xs font-black capitalize">{status === "accepted" ? "approved" : status}</Text>
    </View>
  );
}

export default function CampaignDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const campaignId = typeof params.id === "string" ? params.id : "";
  const api = useMemo(() => createMobileApiClient(), []);
  const queryClient = useQueryClient();
  const [isApplyOpen, setApplyOpen] = useState(false);
  const [isDeliverableOpen, setDeliverableOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [deliverableNotes, setDeliverableNotes] = useState("");
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);

  const detailQuery = useQuery<CampaignDetail>({
    queryKey: ["creator", "campaigns", campaignId],
    queryFn: () => api.creator.getCampaignDetail(campaignId),
    enabled: campaignId.length > 0,
  });

  const invalidateDetail = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["creator", "campaigns", campaignId] }),
      queryClient.invalidateQueries({ queryKey: ["creator", "my-campaigns"] }),
    ]);
  };

  const applyMutation = useMutation({
    mutationFn: () => api.creator.applyToCampaign(campaignId, coverNote.trim() || undefined),
    onSuccess: async () => {
      await invalidateDetail();
      setApplyOpen(false);
      setCoverNote("");
      showToast("Application submitted!");
    },
    onError: (error) => Alert.alert("Could not apply", error instanceof Error ? error.message : "Please try again."),
  });

  const deliverableMutation = useMutation({
    mutationFn: () => api.creator.submitDeliverable(campaignId, {
      contentUrl: contentUrl.trim(),
      notes: deliverableNotes.trim() || undefined,
    }),
    onSuccess: async () => {
      await invalidateDetail();
      setDeliverableOpen(false);
      setContentUrl("");
      setDeliverableNotes("");
      showToast("Deliverable submitted!");
    },
    onError: (error) => Alert.alert("Could not submit", error instanceof Error ? error.message : "Please try again."),
  });

  const mediaUploadMutation = useMutation({
    mutationFn: async () => {
      setMediaUploadProgress(0);
      return pickAndUploadImage({
        type: "deliverable",
        campaignId,
        onProgress: setMediaUploadProgress,
      });
    },
    onSuccess: (publicUrl) => {
      if (!publicUrl) return;
      setContentUrl(publicUrl);
      showToast("Media uploaded!");
    },
    onError: (error) => Alert.alert("Could not upload media", error instanceof Error ? error.message : "Please try again."),
    onSettled: () => setMediaUploadProgress(null),
  });

  const inviteMutation = useMutation({
    mutationFn: (accept: boolean) => api.creator.respondToInvite(campaignId, accept),
    onSuccess: invalidateDetail,
    onError: (error) => Alert.alert("Could not update invite", error instanceof Error ? error.message : "Please try again."),
  });

  const detail = detailQuery.data;
  const campaign = detail?.campaign;
  const application = detail?.application;
  const brandName = detail?.brand?.name ?? campaign?.brandName ?? "CreatorX Brand";

  function submitDeliverable() {
    try {
      new URL(contentUrl.trim());
    } catch {
      Alert.alert("Valid URL required", "Add a full https:// content URL before submitting.");
      return;
    }
    deliverableMutation.mutate();
  }

  if (detailQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50">
        <ScreenHeader title="Campaign" showBack />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!campaign) {
    return (
      <SafeAreaView className="flex-1 bg-zinc-50">
        <ScreenHeader title="Campaign" showBack />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-base font-bold text-zinc-500">Campaign not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-50">
      <ScreenHeader title="Campaign" showBack />
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-32 pt-4">
        <View className="rounded-2xl border border-zinc-200 bg-white p-5">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text testID="campaign-title" className="text-2xl font-black text-zinc-950">
                {campaign.title}
              </Text>
              <View className="mt-4 flex-row items-center">
                {detail.brand?.logoUrl ? (
                  <Image source={{ uri: detail.brand.logoUrl }} className="h-10 w-10 rounded-full bg-zinc-200" />
                ) : (
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                    <Text className="text-sm font-black text-indigo-700">{brandName.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text testID="campaign-brand" className="ml-3 text-base font-black text-zinc-700">
                  {brandName}
                </Text>
              </View>
            </View>
            <StatusBadge status={campaign.status} />
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[45%] flex-1 rounded-xl bg-zinc-50 p-4">
              <Text className="text-xs font-bold uppercase text-zinc-500">Budget</Text>
              <Text testID="campaign-budget" className="mt-1 text-lg font-black text-zinc-950">
                {formatINR(campaign.budgetPaise)}
              </Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-xl bg-zinc-50 p-4">
              <Text className="text-xs font-bold uppercase text-zinc-500">Deadline</Text>
              <Text testID="campaign-deadline" className="mt-1 text-lg font-black text-zinc-950">
                {formatShortDate(campaign.applicationDeadline)}
              </Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-xl bg-zinc-50 p-4">
              <Text className="text-xs font-bold uppercase text-zinc-500">Max creators</Text>
              <Text testID="campaign-max-creators" className="mt-1 text-lg font-black text-zinc-950">
                {campaign.maxCreators}
              </Text>
            </View>
            <View className="min-w-[45%] flex-1 rounded-xl bg-zinc-50 p-4">
              <Text className="text-xs font-bold uppercase text-zinc-500">Platforms</Text>
              <View className="mt-2 flex-row gap-2">
                {campaign.platforms.map((platform) => (
                  <Ionicons key={platform} name={platformIcon(platform)} size={20} color="#4f46e5" />
                ))}
              </View>
            </View>
          </View>
        </View>

        <View className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
          <Text className="text-lg font-black text-zinc-950">Description</Text>
          <Text testID="campaign-description" className="mt-3 text-base leading-7 text-zinc-700">
            {campaign.description}
          </Text>
          <View className="mt-4 flex-row flex-wrap gap-2">
            <View className="rounded-full bg-indigo-50 px-3 py-1">
              <Text className="text-xs font-black text-indigo-700">{campaign.deliverableType}</Text>
            </View>
            <View className="rounded-full bg-zinc-100 px-3 py-1">
              <Text className="text-xs font-black text-zinc-700">{campaign.niche}</Text>
            </View>
          </View>
          {campaign.briefUrl ? (
            <TouchableOpacity testID="link-brief-url" onPress={() => void Linking.openURL(campaign.briefUrl ?? "")} className="mt-4 flex-row items-center">
              <Ionicons name="link" size={18} color="#4f46e5" />
              <Text className="ml-2 text-sm font-black text-indigo-600">Open brief</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-zinc-200 bg-white px-5 pb-8 pt-4">
        {!application ? (
          <TouchableOpacity testID="btn-apply" onPress={() => setApplyOpen(true)} className="rounded-xl bg-indigo-600 py-4">
            <Text className="text-center text-base font-black text-white">Apply Now</Text>
          </TouchableOpacity>
        ) : application.status === "pending" ? (
          <TouchableOpacity testID="btn-application-pending" disabled className="rounded-xl bg-amber-100 py-4">
            <Text className="text-center text-base font-black text-amber-700">Application Pending</Text>
          </TouchableOpacity>
        ) : isApprovedStatus(application.status) ? (
          <TouchableOpacity testID="btn-submit-deliverable" onPress={() => setDeliverableOpen(true)} className="rounded-xl bg-emerald-600 py-4">
            <Text className="text-center text-base font-black text-white">Submit Deliverable</Text>
          </TouchableOpacity>
        ) : application.status === "rejected" ? (
          <Text testID="text-application-rejected" className="rounded-xl bg-red-50 py-4 text-center text-base font-black text-red-700">
            Application Rejected
          </Text>
        ) : application.status === "invited" ? (
          <View className="flex-row gap-3">
            <TouchableOpacity testID="btn-accept-invite" onPress={() => inviteMutation.mutate(true)} className="flex-1 rounded-xl bg-indigo-600 py-4">
              <Text className="text-center text-base font-black text-white">Accept Invite</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-decline-invite" onPress={() => inviteMutation.mutate(false)} className="flex-1 rounded-xl border border-zinc-300 py-4">
              <Text className="text-center text-base font-black text-zinc-700">Decline</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Modal transparent visible={isApplyOpen} animationType="slide" onRequestClose={() => setApplyOpen(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-3xl bg-white p-5 pb-8">
            <Text className="text-xl font-black text-zinc-950">Apply to campaign</Text>
            <TextInput
              testID="input-cover-note"
              value={coverNote}
              onChangeText={(text) => setCoverNote(text.slice(0, 500))}
              placeholder="Add a short cover note"
              placeholderTextColor="#a1a1aa"
              multiline
              className="mt-4 min-h-28 rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-950"
            />
            <TouchableOpacity
              testID="btn-submit-application"
              onPress={() => applyMutation.mutate()}
              disabled={applyMutation.isPending}
              className="mt-4 rounded-xl bg-indigo-600 py-4"
            >
              <Text className="text-center text-base font-black text-white">
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-close-apply-modal" onPress={() => setApplyOpen(false)} className="mt-3 py-3">
              <Text className="text-center text-sm font-bold text-zinc-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={isDeliverableOpen} animationType="slide" onRequestClose={() => setDeliverableOpen(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <View className="rounded-t-3xl bg-white p-5 pb-8">
            <Text className="text-xl font-black text-zinc-950">Submit deliverable</Text>
            <TextInput
              testID="input-content-url"
              value={contentUrl}
              onChangeText={setContentUrl}
              placeholder="https://..."
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
              keyboardType="url"
              className="mt-4 rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-950"
            />
            <TouchableOpacity
              testID="btn-upload-media"
              onPress={() => mediaUploadMutation.mutate()}
              disabled={mediaUploadMutation.isPending}
              className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 py-3"
            >
              <Text className="text-center text-sm font-black text-indigo-700">
                {mediaUploadMutation.isPending
                  ? `Uploading ${mediaUploadProgress ?? 0}%`
                  : "Upload Media"}
              </Text>
            </TouchableOpacity>
            <TextInput
              testID="input-deliverable-notes"
              value={deliverableNotes}
              onChangeText={setDeliverableNotes}
              placeholder="Notes for the brand"
              placeholderTextColor="#a1a1aa"
              multiline
              className="mt-3 min-h-24 rounded-xl border border-zinc-200 px-4 py-3 text-base text-zinc-950"
            />
            <TouchableOpacity
              testID="btn-submit-deliverable-confirm"
              onPress={submitDeliverable}
              disabled={deliverableMutation.isPending}
              className="mt-4 rounded-xl bg-emerald-600 py-4"
            >
              <Text className="text-center text-base font-black text-white">
                {deliverableMutation.isPending ? "Submitting..." : "Submit"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-close-deliverable-modal" onPress={() => setDeliverableOpen(false)} className="mt-3 py-3">
              <Text className="text-center text-sm font-bold text-zinc-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
