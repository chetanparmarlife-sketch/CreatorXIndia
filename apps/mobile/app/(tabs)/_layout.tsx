import { type ComponentProps } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import type { Notification } from "@creatorx/api-client";
import { useAuth } from "../../lib/auth";
import { apiClient } from "../../lib/queryClient";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const ACTIVE_COLOR = "#6366f1";
const INACTIVE_COLOR = "#9ca3af";

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}

function NotificationsIcon({ color, size, unreadCount }: { color: string; size: number; unreadCount: number }) {
  return (
    <View className="h-8 w-8 items-center justify-center">
      <Ionicons name="notifications" color={color} size={size} />
      {unreadCount > 0 ? (
        <View
          testID="tab-notifications-badge"
          className="absolute -right-1 -top-1 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1"
        >
          <Text className="text-[10px] font-black text-white">{Math.min(unreadCount, 99)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { user, isLoading } = useAuth();
  const profileComplete = user?.profileComplete ?? user?.profile_complete;
  const api = apiClient;

  const notificationsQuery = useQuery<Notification[]>({
    queryKey: ["creator", "notifications"],
    queryFn: () => api.creator.getNotifications(),
    enabled: Boolean(user && user.role === "creator"),
  });

  const unreadCount = (notificationsQuery.data ?? []).filter((notification) => !notification.readAt).length;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.role !== "creator") return <Redirect href="/(auth)/login" />;
  if (profileComplete === false) return <Redirect href="/(auth)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#e5e7eb",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <TabIcon name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <TabIcon name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="campaigns"
        options={{
          title: "My Campaigns",
          tabBarIcon: ({ color, size }) => <TabIcon name="briefcase" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => <TabIcon name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <NotificationsIcon color={color} size={size} unreadCount={unreadCount} />
          ),
        }}
      />
    </Tabs>
  );
}
