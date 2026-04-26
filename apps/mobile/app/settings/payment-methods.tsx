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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EarningsSummary } from "@creatorx/api-client";
import { ScreenHeader } from "../../components/screen-header";
import { createMobileApiClient } from "../../lib/queryClient";

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

export default function PaymentMethodsSettingsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const queryClient = useQueryClient();
  const [upiId, setUpiId] = useState("");
  const [savedUpiId, setSavedUpiId] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountName, setAccountName] = useState("");
  const [savedBankAccount, setSavedBankAccount] = useState<string | null>(null);

  const earningsQuery = useQuery<EarningsSummary>({
    queryKey: ["creator", "earnings"],
    queryFn: () => api.creator.getEarnings(),
  });

  useEffect(() => {
    if (!earningsQuery.data) return;
    setSavedUpiId(earningsQuery.data.upiId);
    setSavedBankAccount(earningsQuery.data.bankAccount);
  }, [earningsQuery.data]);

  const upiMutation = useMutation({
    mutationFn: () => api.creator.updateUpi(upiId.trim()),
    onSuccess: async (methods) => {
      setSavedUpiId(methods.upiId);
      await queryClient.invalidateQueries({ queryKey: ["creator", "earnings"] });
      showToast("UPI saved!");
    },
    onError: (error) => Alert.alert("Could not save UPI", error instanceof Error ? error.message : "Please try again."),
  });

  const bankMutation = useMutation({
    mutationFn: () => api.creator.updateBankAccount({
      accountNumber,
      ifsc,
      accountName,
    }),
    onSuccess: async (methods) => {
      setSavedBankAccount(methods.bankAccount);
      setAccountNumber("");
      await queryClient.invalidateQueries({ queryKey: ["creator", "earnings"] });
      showToast("Bank account saved!");
    },
    onError: (error) => Alert.alert("Could not save bank account", error instanceof Error ? error.message : "Please try again."),
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Payment Methods" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={[]}
          keyExtractor={(_, index) => String(index)}
          renderItem={() => null}
          refreshControl={
            <RefreshControl refreshing={earningsQuery.isRefetching} onRefresh={() => void earningsQuery.refetch()} />
          }
          contentContainerClassName="px-5 pb-8 pt-5"
          ListHeaderComponent={
            <View>
              <View className="rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="text-lg font-black text-zinc-950">UPI</Text>
                {savedUpiId ? <Text className="mt-1 text-sm font-bold text-zinc-500">{savedUpiId}</Text> : null}
                <TextInput
                  testID="input-upi-id"
                  value={upiId}
                  onChangeText={setUpiId}
                  autoCapitalize="none"
                  placeholder="name@bank"
                  placeholderTextColor="#a1a1aa"
                  className="mt-4 h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                <TouchableOpacity
                  testID="btn-save-upi"
                  disabled={upiMutation.isPending || upiId.trim().length === 0}
                  onPress={() => upiMutation.mutate()}
                  className={`mt-4 h-12 items-center justify-center rounded-lg ${
                    upiId.trim().length > 0 ? "bg-indigo-600" : "bg-zinc-300"
                  }`}
                >
                  {upiMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-black text-white">Save UPI</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="text-lg font-black text-zinc-950">Bank account</Text>
                {savedBankAccount ? <Text className="mt-1 text-sm font-bold text-zinc-500">{savedBankAccount}</Text> : null}
                <TextInput
                  testID="input-account-number"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  keyboardType="number-pad"
                  placeholder="Account number"
                  placeholderTextColor="#a1a1aa"
                  className="mt-4 h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                <TextInput
                  testID="input-ifsc"
                  value={ifsc}
                  onChangeText={setIfsc}
                  autoCapitalize="characters"
                  placeholder="IFSC code"
                  placeholderTextColor="#a1a1aa"
                  className="mt-3 h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                <TextInput
                  testID="input-account-name"
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Account name"
                  placeholderTextColor="#a1a1aa"
                  className="mt-3 h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                <TouchableOpacity
                  testID="btn-save-bank"
                  disabled={
                    bankMutation.isPending ||
                    accountNumber.trim().length === 0 ||
                    ifsc.trim().length === 0 ||
                    accountName.trim().length === 0
                  }
                  onPress={() => bankMutation.mutate()}
                  className={`mt-4 h-12 items-center justify-center rounded-lg ${
                    accountNumber.trim().length > 0 && ifsc.trim().length > 0 && accountName.trim().length > 0
                      ? "bg-indigo-600"
                      : "bg-zinc-300"
                  }`}
                >
                  {bankMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-black text-white">Save Bank Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
