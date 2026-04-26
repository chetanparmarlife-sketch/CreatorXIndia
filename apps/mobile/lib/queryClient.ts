import * as SecureStore from "expo-secure-store";
import { QueryClient } from "@tanstack/react-query";
import { createApiClient } from "@creatorx/api-client";

const ACCESS_TOKEN_KEY = "crx_access_token";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
});

export function createMobileApiClient() {
  return createApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000",
    getToken: () => SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
  });
}

export const apiClient = createMobileApiClient();
