import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useMutation } from "@tanstack/react-query";
import { ScreenHeader } from "../../components/screen-header";
import { useAuth } from "../../lib/auth";
import { createMobileApiClient } from "../../lib/queryClient";

const ACCESS_TOKEN_KEY = "crx_access_token";
const REFRESH_TOKEN_KEY = "crx_refresh_token";

export default function SecuritySettingsScreen() {
  const api = useMemo(() => createMobileApiClient(), []);
  const { logout } = useAuth();
  const [newEmail, setNewEmail] = useState("");

  const logoutAllMutation = useMutation({
    mutationFn: () => api.creator.logoutAll(),
    onSuccess: async () => {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      ]);
      await logout();
      router.replace("/(auth)/login");
    },
    onError: (error) => Alert.alert("Could not log out devices", error instanceof Error ? error.message : "Please try again."),
  });

  const changeEmailMutation = useMutation({
    mutationFn: () => api.creator.changeEmail(newEmail.trim()),
    onSuccess: () => Alert.alert("Check your inbox", "We sent an OTP to your new email."),
    onError: (error) => Alert.alert("Could not change email", error instanceof Error ? error.message : "Please try again."),
  });

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title="Security" showBack />
      <View className="flex-1 bg-zinc-50">
        <FlatList
          data={[]}
          keyExtractor={(_, index) => String(index)}
          renderItem={() => null}
          contentContainerClassName="px-5 pb-8 pt-5"
          ListHeaderComponent={
            <View>
              <View className="rounded-lg border border-zinc-200 bg-white p-4">
                <TouchableOpacity
                  testID="btn-logout-all-devices"
                  disabled={logoutAllMutation.isPending}
                  onPress={() => logoutAllMutation.mutate()}
                  className="h-12 items-center justify-center rounded-lg bg-red-600"
                >
                  {logoutAllMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-black text-white">Log out all devices</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Change email</Text>
                <TextInput
                  testID="input-new-email"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="new@email.com"
                  placeholderTextColor="#a1a1aa"
                  className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
                />
                <TouchableOpacity
                  testID="btn-change-email"
                  disabled={changeEmailMutation.isPending || newEmail.trim().length === 0}
                  onPress={() => changeEmailMutation.mutate()}
                  className={`mt-4 h-12 items-center justify-center rounded-lg ${
                    newEmail.trim().length > 0 ? "bg-indigo-600" : "bg-zinc-300"
                  }`}
                >
                  {changeEmailMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-sm font-black text-white">Change email</Text>
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
