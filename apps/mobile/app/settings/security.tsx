import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Switch,
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
import {
  BIOMETRIC_ENABLED_KEY,
  authenticateWithBiometric,
  getBiometricType,
  isBiometricAvailable,
} from "../../lib/biometric";
import { apiClient } from "../../lib/queryClient";

const ACCESS_TOKEN_KEY = "crx_access_token";
const REFRESH_TOKEN_KEY = "crx_refresh_token";

export default function SecuritySettingsScreen() {
  const api = apiClient;
  const { logout } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeOtp, setEmailChangeOtp] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState<"face" | "fingerprint" | "none">("none");
  const [biometricLoading, setBiometricLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadBiometricPreference() {
      setBiometricLoading(true);
      const [available, type, stored] = await Promise.all([
        isBiometricAvailable(),
        getBiometricType(),
        SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
      ]);

      if (cancelled) return;
      setBiometricAvailable(available);
      setBiometricType(type);
      setBiometricEnabled(available && stored === "true");
      setBiometricLoading(false);
    }

    void loadBiometricPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  async function setBiometricPreference(enabled: boolean): Promise<void> {
    if (!biometricAvailable || biometricLoading) return;

    try {
      if (enabled) {
        const authenticated = await authenticateWithBiometric();
        if (!authenticated) return;
      }

      setBiometricEnabled(enabled);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
    } catch (error) {
      setBiometricEnabled(!enabled);
      Alert.alert("Could not update biometric lock", error instanceof Error ? error.message : "Please try again.");
    }
  }

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
    onSuccess: () => Alert.alert("Check your new email", "We sent an OTP to your new email address. Enter it below to confirm the change."),
    onError: (error) => Alert.alert("Could not change email", error instanceof Error ? error.message : "Please try again."),
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: () => api.creator.verifyEmailChange(emailChangeOtp.trim()),
    onSuccess: () => {
      Alert.alert("Email updated", "Your email has been changed successfully.");
      setNewEmail("");
      setEmailChangeOtp("");
    },
    onError: (error) => Alert.alert("Could not verify OTP", error instanceof Error ? error.message : "Please try again."),
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
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text className="text-base font-black text-zinc-950">
                      {biometricType === "face"
                        ? "FaceID Lock"
                        : biometricType === "fingerprint"
                          ? "Fingerprint Lock"
                          : "Biometric Lock"}
                    </Text>
                    {!biometricAvailable && !biometricLoading ? (
                      <Text testID="text-biometric-unavailable" className="mt-1 text-sm font-bold text-zinc-500">
                        Not available on this device
                      </Text>
                    ) : null}
                  </View>
                  <Switch
                    testID="toggle-biometric"
                    value={biometricEnabled}
                    disabled={!biometricAvailable || biometricLoading}
                    onValueChange={(value) => {
                      void setBiometricPreference(value);
                    }}
                    trackColor={{ false: "#d4d4d8", true: "#a5b4fc" }}
                    thumbColor={biometricEnabled ? "#4f46e5" : "#f4f4f5"}
                  />
                </View>
              </View>

              <View className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
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
                    <Text className="text-sm font-black text-white">Send verification code</Text>
                  )}
                </TouchableOpacity>

                {changeEmailMutation.isSuccess ? (
                  <View className="mt-4">
                    <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Verification code</Text>
                    <TextInput
                      testID="input-email-change-otp"
                      value={emailChangeOtp}
                      onChangeText={(value) => setEmailChangeOtp(value.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="123456"
                      placeholderTextColor="#a1a1aa"
                      className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-center text-xl font-bold tracking-widest text-zinc-950"
                    />
                    <TouchableOpacity
                      testID="btn-verify-email-change"
                      disabled={verifyEmailChangeMutation.isPending || emailChangeOtp.length !== 6}
                      onPress={() => verifyEmailChangeMutation.mutate()}
                      className={`mt-4 h-12 items-center justify-center rounded-lg ${
                        emailChangeOtp.length === 6 ? "bg-emerald-600" : "bg-zinc-300"
                      }`}
                    >
                      {verifyEmailChangeMutation.isPending ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text className="text-sm font-black text-white">Verify and update email</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}
