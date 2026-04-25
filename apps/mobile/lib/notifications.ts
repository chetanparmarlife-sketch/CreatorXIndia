import { Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { createMobileApiClient } from "./queryClient";

type NotificationData = Record<string, unknown>;

type PushPlatform = "ios" | "android" | "web";

function mobilePlatform(): PushPlatform {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

function stringValue(data: NotificationData, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function registerForPushNotifications(): Promise<string | null> {
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;

  const result = await Notifications.getExpoPushTokenAsync();
  const token = result.data;
  await createMobileApiClient().registerPushToken(token, mobilePlatform());
  return token;
}

export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data as NotificationData;
  const type = stringValue(data, "type");
  const campaignId = stringValue(data, "campaignId") ?? stringValue(data, "campaign_id");
  const threadId = stringValue(data, "threadId") ?? stringValue(data, "thread_id");

  if ((type === "campaign_invite" || type === "application_approved" || type === "deliverable_approved") && campaignId) {
    router.push(`/campaigns/${campaignId}`);
    return;
  }

  if (type === "message_received" && threadId) {
    router.push(`/inbox/${threadId}`);
    return;
  }

  if (type === "payout_processed") {
    router.push("/(tabs)/earnings");
    return;
  }

  router.push("/(tabs)/notifications");
}
