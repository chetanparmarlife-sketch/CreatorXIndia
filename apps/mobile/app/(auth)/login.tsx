import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../lib/auth";

type LoginStep = "email" | "otp";

export default function LoginScreen() {
  const { requestOtp, login } = useAuth();
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setIsRequestingOtp(true);
    setError(null);

    try {
      await requestOtp(email.trim());
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function verifyOtp() {
    setIsLoggingIn(true);
    setError(null);

    try {
      await login(email.trim(), otp);
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-6">
        <View className="mb-10">
          <Text className="text-4xl font-black text-zinc-950">CreatorX</Text>
          <Text className="mt-3 text-base leading-6 text-zinc-600">
            Sign in with your email and one-time passcode.
          </Text>
        </View>

        {step === "email" ? (
          <View>
            <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">Email</Text>
            <TextInput
              testID="input-email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@creatorx.app"
              placeholderTextColor="#a1a1aa"
              className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-950"
            />

            {error ? (
              <Text testID="text-otp-error" className="mt-3 text-sm font-semibold text-red-600">
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="btn-send-otp"
              disabled={email.trim().length === 0 || isRequestingOtp}
              onPress={sendOtp}
              className={`mt-6 h-14 items-center justify-center rounded-lg ${
                email.trim().length === 0 || isRequestingOtp ? "bg-zinc-300" : "bg-zinc-950"
              }`}
            >
              {isRequestingOtp ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-bold text-white">Send OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text className="mb-2 text-xs font-bold uppercase text-zinc-500">OTP</Text>
            <TextInput
              testID="input-otp"
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
              placeholderTextColor="#a1a1aa"
              className="h-14 rounded-lg border border-zinc-300 bg-white px-4 text-center text-xl font-bold tracking-widest text-zinc-950"
            />

            {error ? (
              <Text testID="text-otp-error" className="mt-3 text-sm font-semibold text-red-600">
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="btn-verify-otp"
              disabled={otp.length !== 6 || isLoggingIn}
              onPress={verifyOtp}
              className={`mt-6 h-14 items-center justify-center rounded-lg ${
                otp.length !== 6 || isLoggingIn ? "bg-zinc-300" : "bg-zinc-950"
              }`}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-bold text-white">Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="btn-resend-otp"
              disabled={isRequestingOtp}
              onPress={sendOtp}
              className="mt-5 h-10 items-center justify-center"
            >
              <Text className="text-sm font-bold text-zinc-950">
                {isRequestingOtp ? "Sending..." : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
