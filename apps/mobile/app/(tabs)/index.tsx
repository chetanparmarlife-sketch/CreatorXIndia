import { Text, TouchableOpacity, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function TabsIndexScreen() {
  const { user, logout } = useAuth();
  const profileComplete = user?.profileComplete ?? user?.profile_complete;

  if (profileComplete === false) return <Redirect href="/(auth)/onboarding" />;

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="text-3xl font-black text-zinc-950">CreatorX</Text>
      <Text className="mt-3 text-base text-zinc-600">
        Signed in as {user?.email || user?.role || "CreatorX user"}.
      </Text>

      <TouchableOpacity
        testID="btn-logout"
        onPress={logout}
        className="mt-8 h-12 items-center justify-center rounded-lg bg-zinc-950"
      >
        <Text className="text-base font-bold text-white">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
