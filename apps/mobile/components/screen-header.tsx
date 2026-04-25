import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface ScreenHeaderProps {
  title: string;
  showBack?: boolean;
  rightElement?: ReactNode;
}

export function ScreenHeader({ title, showBack = false, rightElement }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
      <View className="flex-row flex-1 items-center">
        {showBack ? (
          <TouchableOpacity
            testID="btn-back"
            onPress={() => router.back()}
            className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <Ionicons name="chevron-back" size={22} color="#18181b" />
          </TouchableOpacity>
        ) : null}
        <Text className="flex-1 text-2xl font-black text-zinc-950" numberOfLines={1}>
          {title}
        </Text>
      </View>

      {rightElement ? <View className="ml-3">{rightElement}</View> : null}
    </View>
  );
}
