import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

// ---------------------------------------------------------------
// Current user id — held in memory, synced to the URL so refresh works
// in both preview (sandboxed iframe) and published modes.
// ---------------------------------------------------------------

let currentUserId: string | null = null;

export function readUidFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("uid");
  } catch {
    return null;
  }
}

function writeUidToUrl(uid: string | null) {
  try {
    const url = new URL(window.location.href);
    if (uid) url.searchParams.set("uid", uid);
    else url.searchParams.delete("uid");
    window.history.replaceState({}, "", url.toString());
  } catch {}
}

export function setCurrentUserId(uid: string | null) {
  currentUserId = uid;
  writeUidToUrl(uid);
}

export function getCurrentUserId(): string | null {
  return currentUserId || readUidFromUrl();
}

// Initialize from URL at module load
currentUserId = readUidFromUrl();

function authHeaders(): Record<string, string> {
  const uid = getCurrentUserId();
  return uid ? { "X-User-Id": uid } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.clone().json();
      message = data.error || data.message || message;
    } catch {
      message = (await res.text()) || res.statusText;
    }
    const err: any = new Error(`${res.status}: ${message}`);
    err.status = res.status;
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
