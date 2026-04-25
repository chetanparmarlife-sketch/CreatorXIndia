import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Profile } from "@creatorx/schema";
import { apiRequest, apiRequestWithoutRetry, queryClient, setAuthBridge } from "./queryClient";

interface AuthContextValue {
  user: Profile | null;
  accessToken: string | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<void>;
  login: (email: string, otp: string) => Promise<Profile>;
  logout: () => Promise<void>;
  signup: (data: { email: string; full_name: string; handle: string }) => Promise<Profile>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeAccessToken(token: string): { userId: string; role: Profile["role"] } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

    const decoded = JSON.parse(window.atob(payload)) as { sub?: string; role?: Profile["role"] };
    if (typeof decoded.sub !== "string" || typeof decoded.role !== "string") return null;
    return { userId: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

async function fetchProfile(accessToken: string | null): Promise<Profile | null> {
  try {
    const res = await apiRequestWithoutRetry("GET", "/api/profile", undefined, accessToken);
    const data = (await res.json()) as { profile?: Profile | null };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);

  const clearAuthState = useCallback(() => {
    refreshTokenRef.current = null;
    userIdRef.current = null;
    setAccessToken(null);
    setUser(null);
  }, []);

  const silentRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    if (!refreshTokenRef.current) {
      return null;
    }

    const refreshPromise = (async () => {
      try {
        const res = await apiRequestWithoutRetry("POST", "/api/auth/refresh", {
          refreshToken: refreshTokenRef.current,
        });

        if (!res.ok) {
          clearAuthState();
          return null;
        }

        const data = (await res.json()) as { accessToken?: string };
        if (typeof data.accessToken !== "string" || !data.accessToken) {
          clearAuthState();
          return null;
        }

        setAccessToken(data.accessToken);

        if (!user) {
          const decoded = decodeAccessToken(data.accessToken);
          if (decoded) {
            userIdRef.current = decoded.userId;
            const profile = await fetchProfile(data.accessToken);
            if (profile) setUser(profile);
          }
        }

        return data.accessToken;
      } catch {
        clearAuthState();
        return null;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, [clearAuthState, user]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    userIdRef.current = user.id;
    const profile = await fetchProfile(accessToken);
    if (profile) setUser(profile);
  }, [accessToken, user]);

  const requestOtp = useCallback(async (email: string) => {
    await apiRequest("POST", "/api/auth/request-otp", { email });
  }, []);

  const login = useCallback(async (email: string, otp: string) => {
    const res = await apiRequest("POST", "/api/auth/verify-otp", { email, otp });
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken?: string;
      user: Profile;
    };

    setAccessToken(data.accessToken);
    refreshTokenRef.current = typeof data.refreshToken === "string" ? data.refreshToken : null;
    userIdRef.current = data.user.id;
    setUser(data.user);
    queryClient.invalidateQueries();
    return data.user;
  }, []);

  const signup = useCallback(async (data: { email: string; full_name: string; handle: string }) => {
    const res = await apiRequest("POST", "/api/auth/signup", data);
    const json = (await res.json()) as { profile: Profile; accessToken?: string; refreshToken?: string };
    setAccessToken(typeof json.accessToken === "string" ? json.accessToken : null);
    refreshTokenRef.current = typeof json.refreshToken === "string" ? json.refreshToken : null;
    userIdRef.current = json.profile.id;
    setUser(json.profile);
    queryClient.invalidateQueries();
    return json.profile;
  }, []);

  const logout = useCallback(async () => {
    const tokenForLogout = refreshTokenRef.current;

    try {
      await apiRequestWithoutRetry("POST", "/api/auth/logout", tokenForLogout ? { refreshToken: tokenForLogout } : {});
    } catch {
      // ignore network errors during logout
    } finally {
      clearAuthState();
      queryClient.clear();
    }
  }, [accessToken, clearAuthState]);

  useEffect(() => {
    setAuthBridge({
      getAccessToken: () => accessToken,
      refreshAccessToken: silentRefresh,
      logout,
    });
  }, [accessToken, logout, silentRefresh, user]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await silentRefresh();
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [silentRefresh]);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        requestOtp,
        login,
        logout,
        signup,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
