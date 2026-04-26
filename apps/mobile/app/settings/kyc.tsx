import { useState } from "react";
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
import { pickAndUploadImage } from "../../lib/image-upload";
import { apiClient } from "../../lib/queryClient";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

function fileNameFromKey(uploadKey: string): string {
  return uploadKey.split("/").pop() ?? uploadKey;
}

export default function KycSettingsScreen() {
  const api = apiClient;
  const queryClient = useQueryClient();
  const [panUploadKey, setPanUploadKey] = useState<string | null>(null);
  const [aadhaarUploadKey, setAadhaarUploadKey] = useState<string | null>(null);

  const kycQuery = useQuery<KycRecord>({
    queryKey: ["creator", "kyc"],
    queryFn: () => api.creator.getKyc(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (type: "pan" | "aadhaar") => {
      const uploadKey = await pickAndUploadImage({ type: "kyc" });
      return { type, uploadKey };
    },
    onSuccess: ({ type, uploadKey }) => {
      if (!uploadKey) return;
      if (type === "pan") setPanUploadKey(uploadKey);
      if (type === "aadhaar") setAadhaarUploadKey(uploadKey);
      showToast("Document uploaded!");
    },
    onError: (error) => Alert.alert("Could not upload document", error instanceof Error ? error.message : "Please try again."),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.creator.submitKyc({
      panUrl: panUploadKey ?? "",
      aadhaarUrl: aadhaarUploadKey ?? "",
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creator", "kyc"] });
      showToast("KYC submitted!");
    },
    onError: (error) => Alert.alert("Could not submit KYC", error instanceof Error ? error.message : "Please try again."),
  });

  const status = kycQuery.data?.status ?? "not_submitted";
  const canUpload = status !== "approved";
  const canSubmit = Boolean(panUploadKey && aadhaarUploadKey) && !submitMutation.isPending;

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
                    <Text className="text-sm font-black text-indigo-700">
                      {panUploadKey ? "PAN uploaded" : "Upload PAN card"}
                    </Text>
                  </TouchableOpacity>
                  {panUploadKey ? (
                    <Text testID="kyc-pan-filename" className="mt-2 text-xs font-bold text-zinc-500">
                      {fileNameFromKey(panUploadKey)}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    testID="btn-upload-aadhaar"
                    disabled={uploadMutation.isPending}
                    onPress={() => uploadMutation.mutate("aadhaar")}
                    className="mt-3 h-12 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50"
                  >
                    <Text className="text-sm font-black text-indigo-700">
                      {aadhaarUploadKey ? "Aadhaar uploaded" : "Upload Aadhaar"}
                    </Text>
                  </TouchableOpacity>
                  {aadhaarUploadKey ? (
                    <Text testID="kyc-aadhaar-filename" className="mt-2 text-xs font-bold text-zinc-500">
                      {fileNameFromKey(aadhaarUploadKey)}
                    </Text>
                  ) : null}

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
