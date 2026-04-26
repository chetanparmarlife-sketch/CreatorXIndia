import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type UnauthorizedBehavior = "returnNull" | "throw";

type AuthBridge = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => Promise<void> | void;
};

type ActingBrandBridge = {
  getActingBrandId: () => string | null;
};

let authBridge: AuthBridge = {
  getAccessToken: () => null,
  refreshAccessToken: async () => null,
  logout: () => {},
};

export function getActingBrandIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const rawPath = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.pathname;
  const match = rawPath.match(/^\/(?:admin\/)?brands\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

let actingBrandBridge: ActingBrandBridge = {
  getActingBrandId: getActingBrandIdFromLocation,
};

export function setAuthBridge(next: Partial<AuthBridge>) {
  authBridge = { ...authBridge, ...next };
}

export function setActingBrandBridge(next: Partial<ActingBrandBridge>) {
  actingBrandBridge = { ...actingBrandBridge, ...next };
}

function authHeaders(accessTokenOverride?: string | null): Record<string, string> {
  const token = accessTokenOverride ?? authBridge.getAccessToken();
  const actingBrandId = actingBrandBridge.getActingBrandId();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (actingBrandId) headers["X-Acting-As-Brand"] = actingBrandId;
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.clone().json()) as { error?: string; message?: string };
      message = data.error || data.message || message;
    } catch {
      message = (await res.text()) || res.statusText;
    }
    throw new Error(`${res.status}: ${message}`);
  }
}

async function performFetch(
  method: string,
  url: string,
  data?: unknown,
  accessTokenOverride?: string | null,
): Promise<Response> {
  const requestUrl = /^https?:\/\//.test(url) ? url : `${API_BASE}${url}`;
  return fetch(requestUrl, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(accessTokenOverride),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function uploadToPresignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
}

export async function apiRequestWithoutRetry(
  method: string,
  url: string,
  data?: unknown,
  accessTokenOverride?: string | null,
): Promise<Response> {
  const res = await performFetch(method, url, data, accessTokenOverride);
  await throwIfResNotOk(res);
  return res;
}

async function requestWith401Retry(method: string, url: string, data?: unknown): Promise<Response> {
  const initial = await performFetch(method, url, data);
  if (initial.status !== 401) return initial;

  const refreshedToken = await authBridge.refreshAccessToken();
  if (!refreshedToken) {
    await authBridge.logout();
    return initial;
  }

  const retry = await performFetch(method, url, data, refreshedToken);
  if (retry.status === 401) {
    await authBridge.logout();
  }
  return retry;
}

export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const res = await requestWith401Retry(method, url, data);
  await throwIfResNotOk(res);
  return res;
}

export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;

  return async ({ queryKey }) => {
    const path = queryKey.map(String).join("/");
    const res = await requestWith401Retry("GET", path);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null as T;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
