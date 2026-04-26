import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KycRecord } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { createMobileApiClient } from "../../lib/queryClient";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

function documentUrlFromUpload(uploadUrl: string): string {
  return uploadUrl.split("?")[0] ?? uploadUrl;
}

export default function KycSettingsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const queryClient = useQueryClient();
  const [panUrl, setPanUrl] = useState<string | null>(null);
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(null);

  const kycQuery = useQuery<KycRecord>({
    queryKey: ["creator", "kyc"],
    queryFn: () => api.creator.getKyc(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (type: "pan" | "aadhaar") => {
      const filename = `${type}-${Date.now()}.jpg`;
      const upload = await api.creator.presignUpload({ type: "kyc", filename });
      await api.uploadToPresignedUrl(upload.uploadUrl);
      return { type, url: documentUrlFromUpload(upload.uploadUrl) };
    },
    onSuccess: ({ type, url }) => {
      if (type === "pan") setPanUrl(url);
      if (type === "aadhaar") setAadhaarUrl(url);
      showToast("Document uploaded!");
    },
    onError: (error) => Alert.alert("Could not upload document", error instanceof Error ? error.message : "Please try again."),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.creator.submitKyc({
      panUrl: panUrl ?? "",
      aadhaarUrl: aadhaarUrl ?? "",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creator", "kyc"] });
      showToast("KYC submitted!");
    },
    onError: (error) => Alert.alert("Could not submit KYC", error instanceof Error ? error.message : "Please try again."),
  });

  const status = kycQuery.data?.status ?? "not_submitted";
  const canUpload = status !== "approved";
  const canSubmit = Boolean(panUrl && aadhaarUrl) && !submitMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="KYC" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={[]}
          keyExtractor={(_, index) => String(index)}
          renderItem={() => null}
          refreshControl={<RefreshControl refreshing={kycQuery.isRefetching} onRefresh={() => void kycQuery.refetch()} />}
          contentContainerClassName="px-5 pb-8 pt-5"
          ListHeaderComponent={
            <View>
              <View className="rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="text-xs font-bold uppercase text-zinc-500">Current status</Text>
                <View testID="kyc-status" className="mt-3 self-start rounded-full bg-indigo-50 px-3 py-1">
                  <Text className="text-xs font-black capitalize text-indigo-700">{status.replace("_", " ")}</Text>
                </View>
                {status === "rejected" ? (
                  <Text testID="kyc-rejection-reason" className="mt-3 text-sm font-semibold text-red-600">
                    {kycQuery.data?.rejectionReason ?? "Please upload clear documents and try again."}
                  </Text>
                ) : null}
              </View>

              {canUpload ? (
                <View className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                  <TouchableOpacity
                    testID="btn-upload-pan"
                    disabled={uploadMutation.isPending}
                    onPress={() => uploadMutation.mutate("pan")}
                    className="h-12 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50"
                  >
                    <Text className="text-sm font-black text-indigo-700">{panUrl ? "PAN uploaded" : "Upload PAN card"}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="btn-upload-aadhaar"
                    disabled={uploadMutation.isPending}
                    onPress={() => uploadMutation.mutate("aadhaar")}
                    className="mt-3 h-12 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50"
                  >
                    <Text className="text-sm font-black text-indigo-700">
                      {aadhaarUrl ? "Aadhaar uploaded" : "Upload Aadhaar"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID="btn-submit-kyc"
                    disabled={!canSubmit}
                    onPress={() => submitMutation.mutate()}
                    className={`mt-5 h-14 items-center justify-center rounded-lg ${
                      canSubmit ? "bg-indigo-600" : "bg-zinc-300"
                    }`}
                  >
                    {submitMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text className="text-base font-black text-white">Submit KYC</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
