import { Platform } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { apiClient } from "./queryClient";

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
  if (!Constants.isDevice) {
    console.warn("[notifications] Push registration skipped on simulator.");
    return null;
  }

  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return null;

  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    const token = result.data;
    await apiClient.registerPushToken(token, mobilePlatform());
    return token;
  } catch (error) {
    console.warn("[notifications] Push registration failed.", error);
    return null;
  }
}

export async function setNotificationCategories(): Promise<void> {
  await Promise.all([
    Notifications.setNotificationCategoryAsync("campaign_invite", [
      {
        identifier: "accept",
        buttonTitle: "Accept",
        options: { opensAppToForeground: true },
      },
      {
        identifier: "decline",
        buttonTitle: "Decline",
        options: { opensAppToForeground: false },
      },
    ]),
    Notifications.setNotificationCategoryAsync("message_received", [
      {
        identifier: "reply",
        buttonTitle: "Reply",
        options: { opensAppToForeground: true },
      },
    ]),
    Notifications.setNotificationCategoryAsync("application_approved", [
      {
        identifier: "view",
        buttonTitle: "View Campaign",
        options: { opensAppToForeground: true },
      },
    ]),
  ]);
}

function routeNotificationData(data: NotificationData): void {
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

export async function handleNotificationAction(response: Notifications.NotificationResponse): Promise<void> {
  const data = response.notification.request.content.data as NotificationData;
  const campaignId = stringValue(data, "campaignId") ?? stringValue(data, "campaign_id");
  const threadId = stringValue(data, "threadId") ?? stringValue(data, "thread_id");
  const api = apiClient;

  try {
    if (response.actionIdentifier === "accept" && campaignId) {
      await api.creator.respondToInvite(campaignId, true);
      router.push(`/campaigns/${campaignId}`);
      return;
    }

    if (response.actionIdentifier === "decline" && campaignId) {
      await api.creator.respondToInvite(campaignId, false);
      return;
    }

    if (response.actionIdentifier === "reply" && threadId) {
      router.push(`/inbox/${threadId}`);
      return;
    }

    if (response.actionIdentifier === "view" && campaignId) {
      router.push(`/campaigns/${campaignId}`);
      return;
    }
  } catch (error) {
    console.warn("[notifications] Could not handle notification action.", error);
  }

  routeNotificationData(data);
}

export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  void handleNotificationAction(response);
}
