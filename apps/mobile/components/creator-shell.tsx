import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "./screen-header";

interface CreatorShellProps {
  title: string;
  rightElement?: ReactNode;
  children: ReactNode;
}

export function CreatorShell({ title, rightElement, children }: CreatorShellProps) {
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      <ScreenHeader title={title} rightElement={rightElement} />
      <View className="flex-1 bg-zinc-50">{children}</View>
    </SafeAreaView>
  );
}
