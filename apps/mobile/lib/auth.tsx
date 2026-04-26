import {
  createContext,
  useCallback,
  useContext,
  useEffect,

  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { apiClient, createMobileApiClient, queryClient } from "./queryClient";

const ACCESS_TOKEN_KEY = "crx_access_token";
const REFRESH_TOKEN_KEY = "crx_refresh_token";

export interface AuthUser {
  id: string;
  role: string;
  email: string;
  profileComplete?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  requestOtp: (email: string) => Promise<void>;
  login: (email: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

type MobileApiClient = ReturnType<typeof createMobileApiClient>;

const AuthContext = createContext<AuthContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringProp(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function booleanProp(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function decodeBase64Url(input: string): string | null {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let buffer = 0;
  let bits = 0;
  let output = "";

  for (const char of base64) {
    if (char === "=") break;
    const value = alphabet.indexOf(char);
    if (value < 0) return null;

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  try {
    return decodeURIComponent(
      output
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
  } catch {
    return output;
  }
}

function decodeAccessToken(token: string, fallbackEmail = ""): AuthUser | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;

  try {
    const parsed: unknown = JSON.parse(decoded);
    if (!isRecord(parsed)) return null;

    const id = stringProp(parsed, "sub") ?? stringProp(parsed, "userId") ?? stringProp(parsed, "id");
    const role = stringProp(parsed, "role");
    if (!id || !role) return null;

    const profileComplete = booleanProp(parsed, "profileComplete");
    const profileCompleteSnake = booleanProp(parsed, "profile_complete");

    return {
      id,
      role,
      email: stringProp(parsed, "email") ?? fallbackEmail,
      profileComplete: profileComplete ?? profileCompleteSnake ?? undefined,
    };
  } catch {
    return null;
  }
}

async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

async function hydrateUser(api: MobileApiClient, accessToken: string, fallbackEmail = ""): Promise<AuthUser | null> {
  const decoded = decodeAccessToken(accessToken, fallbackEmail);
  if (!decoded) return null;
  if (decoded.email.length > 0 && decoded.profileComplete !== undefined) return decoded;

  try {
    if (decoded.role === "creator") {
      const profile = await api.creator.getProfile();
      return {
        ...decoded,
        email: profile.email,
        profileComplete: profile.profileComplete,
      };
    }

    if (decoded.role === "brand") {
      const profile = await api.brand.getProfile();
      return {
        ...decoded,
        email: profile.email,
      };
    }
  } catch {
    return decoded;
  }

  return decoded;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = apiClient;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const requestOtp = useCallback(async (email: string) => {
    await api.auth.requestOtp(email);
  }, [api]);

  const login = useCallback(async (email: string, otp: string) => {
    const response = await api.auth.verifyOtp(email, otp);
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, response.accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken),
    ]);

    const nextUser = await hydrateUser(api, response.accessToken, response.user.email);
    setUser(nextUser ?? response.user);
    await queryClient.invalidateQueries();
  }, [api]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Logout should complete locally even if the network request fails.
    } finally {
      await clearStoredTokens();
      setUser(null);
      queryClient.clear();
    }
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSession() {
      setIsLoading(true);

      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          if (!cancelled) setUser(null);
          return;
        }

        const result = await api.auth.refresh(refreshToken);
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, result.accessToken);
        if (result.refreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
        }
        const nextUser = await hydrateUser(api, result.accessToken);
        if (!nextUser) throw new Error("Invalid access token");
        if (!cancelled) setUser(nextUser);
      } catch {
        await clearStoredTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void refreshSession();

    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <AuthContext.Provider value={{ user, isLoading, requestOtp, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
