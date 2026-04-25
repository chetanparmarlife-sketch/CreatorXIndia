import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack, useSegments } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const isOnboarding = segments[segments.length - 1] === "onboarding";

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (user && !isOnboarding) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
