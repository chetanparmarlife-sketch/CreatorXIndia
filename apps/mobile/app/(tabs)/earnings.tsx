import { useMemo } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { EarningTransaction, EarningsSummary } from "@creatorx/api-client";
import { CreatorShell } from "../../components/creator-shell";
import { createMobileApiClient } from "../../lib/queryClient";
import { formatINR, formatShortDate } from "../../lib/format";

function TransactionRow({ transaction }: { transaction: EarningTransaction }) {
  const isCredit = transaction.amountPaise >= 0;
  return (
    <View testID={`transaction-${transaction.id}`} className="mb-3 rounded-lg border border-zinc-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className={`rounded-full px-3 py-1 ${isCredit ? "bg-emerald-50" : "bg-zinc-100"}`}>
          <Text className={`text-xs font-black capitalize ${isCredit ? "text-emerald-700" : "text-zinc-600"}`}>
            {transaction.type}
          </Text>
        </View>
        <Text className={`text-base font-black ${isCredit ? "text-emerald-600" : "text-zinc-950"}`}>
          {formatINR(transaction.amountPaise)}
        </Text>
      </View>
      <Text className="mt-3 text-sm font-bold text-zinc-950">{transaction.description}</Text>
      <Text className="mt-1 text-xs font-semibold text-zinc-400">{formatShortDate(transaction.createdAt)}</Text>
    </View>
  );
}

export default function EarningsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const earningsQuery = useQuery<EarningsSummary>({
    queryKey: ["creator", "earnings"],
    queryFn: () => api.creator.getEarnings(),
  });
  const earnings = earningsQuery.data;

  function refresh() {
    void earningsQuery.refetch();
  }

  return (
    <CreatorShell title="Earnings">
      <FlatList
        data={earnings?.transactions ?? []}
        keyExtractor={(transaction) => transaction.id}
        renderItem={({ item }) => <TransactionRow transaction={item} />}
        refreshControl={<RefreshControl refreshing={earningsQuery.isRefetching} onRefresh={refresh} />}
        contentContainerClassName="px-5 pb-8"
        ListHeaderComponent={
          <View className="py-5">
            <View className="rounded-lg bg-zinc-950 p-5">
              <Text className="text-xs font-bold uppercase text-zinc-400">Available for withdrawal</Text>
              <Text testID="balance-available" className="mt-2 text-3xl font-black text-white">
                {formatINR(earnings?.availableForWithdrawalPaise ?? 0)}
              </Text>
              <View className="mt-5 flex-row gap-3">
                <View className="flex-1 rounded-lg bg-zinc-800 p-3">
                  <Text className="text-xs font-bold uppercase text-zinc-400">Pending</Text>
                  <Text testID="balance-pending" className="mt-2 text-lg font-black text-white">
                    {formatINR(earnings?.pendingPaise ?? 0)}
                  </Text>
                </View>
                <View className="flex-1 rounded-lg bg-zinc-800 p-3">
                  <Text className="text-xs font-bold uppercase text-zinc-400">Total earned</Text>
                  <Text testID="balance-total" className="mt-2 text-lg font-black text-white">
                    {formatINR(earnings?.totalEarnedPaise ?? 0)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                testID="btn-withdraw"
                onPress={() => router.push("/withdraw")}
                className="mt-5 h-12 items-center justify-center rounded-lg bg-indigo-500"
              >
                <Text className="text-base font-black text-white">Withdraw</Text>
              </TouchableOpacity>
            </View>

            <Text className="mt-8 text-xl font-black text-zinc-950">Transactions</Text>
          </View>
        }
      />
    </CreatorShell>
  );
}
