import "../global.css";

import { useCallback, useEffect, useRef } from "react";
import { Stack, router } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { AppState, Linking, type AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../lib/auth";
import { BIOMETRIC_ENABLED_KEY, authenticateWithBiometric } from "../lib/biometric";
import { queryClient } from "../lib/queryClient";
import {
  handleNotificationAction,
  registerForPushNotifications,
  setNotificationCategories,
} from "../lib/notifications";

void SplashScreen.preventAutoHideAsync();

const UNIVERSAL_LINK_HOST = "app.creatorx.app";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function pathFromDeepLink(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && parsed.hostname === UNIVERSAL_LINK_HOST) {
      return parsed.pathname.replace(/^\/+/, "");
    }

    if (parsed.protocol === "creatorx:") {
      const host = parsed.hostname;
      const path = parsed.pathname.replace(/^\/+/, "");
      return [host, path].filter(Boolean).join("/");
    }
  } catch {
    return null;
  }

  return null;
}

function routeDeepLink(url: string): boolean {
  const path = pathFromDeepLink(url);
  if (!path) return false;

  const [section, id] = path.split("/").map(safeDecode);
  if (section === "campaigns" && id) {
    router.push(`/campaigns/${id}`);
    return true;
  }

  if (section === "inbox" && id) {
    router.push(`/inbox/${id}`);
    return true;
  }

  if (section === "deliverables" && id) {
    router.push(`/campaigns/${id}`);
    return true;
  }

  if (section === "earnings") {
    router.push("/(tabs)/earnings");
    return true;
  }

  return false;
}

function AppShell() {
  const { user, isLoading, logout } = useAuth();
  const handledInitialUrlRef = useRef(false);
  const handledInitialNotificationRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const biometricInFlightRef = useRef(false);
  const biometricColdStartUserRef = useRef<string | null>(null);

  const runBiometricGate = useCallback(async () => {
    if (isLoading || !user || biometricInFlightRef.current) return;

    try {
      const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      if (enabled !== "true") return;

      biometricInFlightRef.current = true;
      const authenticated = await authenticateWithBiometric();
      if (!authenticated) {
        await logout();
        router.replace("/(auth)/login");
      }
    } catch (error) {
      console.warn("[biometric] Could not run biometric gate.", error);
    } finally {
      biometricInFlightRef.current = false;
    }
  }, [isLoading, logout, user?.id]);

  useEffect(() => {
    if (isLoading || !user) return undefined;

    void setNotificationCategories().catch((error: unknown) => {
      console.warn("[notifications] Could not set categories.", error);
    });
    void registerForPushNotifications().catch((error: unknown) => {
      console.warn("[notifications] Could not register for push notifications.", error);
    });

    if (!handledInitialNotificationRef.current) {
      handledInitialNotificationRef.current = true;
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            void handleNotificationAction(response);
            void Notifications.clearLastNotificationResponseAsync();
          }
        })
        .catch((error: unknown) => {
          console.warn("[notifications] Could not read initial notification response.", error);
        });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationAction(response);
    });
    return () => subscription.remove();
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (isLoading || !user || handledInitialUrlRef.current) return;
    handledInitialUrlRef.current = true;

    void Linking.getInitialURL()
      .then((url) => {
        if (url) routeDeepLink(url);
      })
      .catch((error: unknown) => {
        console.warn("[links] Could not read initial URL.", error);
      });
  }, [isLoading, user?.id]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (!isLoading && user) routeDeepLink(url);
    });

    return () => subscription.remove();
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (isLoading || !user || biometricColdStartUserRef.current === user.id) return;
    biometricColdStartUserRef.current = user.id;
    void runBiometricGate();
  }, [isLoading, runBiometricGate, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        nextState === "active" &&
        (previousState === "background" || previousState === "inactive")
      ) {
        void runBiometricGate();
      }
    });

    return () => subscription.remove();
  }, [runBiometricGate]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}
