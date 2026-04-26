import { useState } from "react";
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
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EarningsSummary } from "@creatorx/api-client";
import { ScreenHeader } from "../components/screen-header";
import { apiClient } from "../lib/queryClient";
import { formatINR } from "../lib/format";

const MIN_WITHDRAWAL_PAISE = 50_000;

function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
}

function rupeesToPaise(value: string): number {
  const rupees = Number.parseFloat(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

export default function WithdrawScreen() {
  const api = apiClient;
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");

  const earningsQuery = useQuery<EarningsSummary>({
    queryKey: ["creator", "earnings"],
    queryFn: () => api.creator.getEarnings(),
  });

  const earnings = earningsQuery.data;
  const amountPaise = rupeesToPaise(amount);
  const availablePaise = earnings?.availableForWithdrawalPaise ?? 0;
  const hasPaymentMethod = Boolean(earnings?.upiId || earnings?.bankAccount);
  const belowMinimum = amount.length > 0 && amountPaise < MIN_WITHDRAWAL_PAISE;
  const insufficientBalance = amount.length > 0 && amountPaise > availablePaise;
  const canSubmit =
    amountPaise >= MIN_WITHDRAWAL_PAISE &&
    amountPaise <= availablePaise &&
    hasPaymentMethod &&
    !earningsQuery.isLoading;

  const withdrawalMutation = useMutation({
    mutationFn: () => api.creator.requestWithdrawal(amountPaise),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["creator", "earnings"] });
      showToast("Withdrawal requested!");
      router.replace("/(tabs)/earnings");
    },
    onError: (error) => Alert.alert("Could not request withdrawal", error instanceof Error ? error.message : "Please try again."),
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Withdraw Earnings" showBack />
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
              <View className="rounded-lg bg-zinc-950 p-5">
                <Text className="text-xs font-bold uppercase text-zinc-400">Available for withdrawal</Text>
                <Text testID="withdraw-available-balance" className="mt-2 text-3xl font-black text-white">
                  {formatINR(availablePaise)}
                </Text>
                <Text testID="withdraw-minimum-note" className="mt-3 text-sm font-bold text-zinc-300">
                  Minimum withdrawal: ₹500
                </Text>
              </View>

              <View className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Amount (₹)</Text>
                <TextInput
                  testID="input-withdraw-amount"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                  placeholder="500"
                  placeholderTextColor="#a1a1aa"
                  className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                {belowMinimum ? (
                  <Text testID="error-withdraw-amount" className="mt-2 text-sm font-semibold text-red-600">
                    Enter at least ₹500.
                  </Text>
                ) : null}
                {insufficientBalance ? (
                  <Text testID="error-insufficient-balance" className="mt-2 text-sm font-semibold text-red-600">
                    Amount is higher than your available balance.
                  </Text>
                ) : null}
              </View>

              <View className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="text-xs font-bold uppercase text-zinc-500">Payment method</Text>
                {hasPaymentMethod ? (
                  <Text testID="withdraw-payment-method" className="mt-2 text-base font-black text-zinc-950">
                    {earnings?.upiId ?? earnings?.bankAccount}
                  </Text>
                ) : (
                  <TouchableOpacity
                    testID="link-add-payment-method"
                    onPress={() => router.push("/settings/payment-methods")}
                    className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3"
                  >
                    <Text className="text-center text-sm font-black text-indigo-700">Add payment method</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                testID="btn-request-withdrawal"
                disabled={!canSubmit || withdrawalMutation.isPending}
                onPress={() => withdrawalMutation.mutate()}
                className={`mt-6 h-14 items-center justify-center rounded-lg ${
                  canSubmit ? "bg-indigo-600" : "bg-zinc-300"
                }`}
              >
                {withdrawalMutation.isPending ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-base font-black text-white">Request Withdrawal</Text>
                )}
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
