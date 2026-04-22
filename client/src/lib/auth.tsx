import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest, setCurrentUserId, getCurrentUserId, queryClient } from "./queryClient";
import type { Profile } from "@shared/schema";

interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  login: (email: string) => Promise<Profile>;
  signup: (data: { email: string; full_name: string; handle: string }) => Promise<Profile>;
  loginAsDemo: (userId: string) => Promise<Profile | null>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const uid = getCurrentUserId();
    if (!uid) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setUser(data.profile);
    } catch {
      setCurrentUserId(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function login(email: string) {
    const res = await apiRequest("POST", "/api/auth/login", { email });
    const data = await res.json();
    setCurrentUserId(data.profile.id);
    setUser(data.profile);
    queryClient.invalidateQueries();
    return data.profile as Profile;
  }

  async function signup(data: { email: string; full_name: string; handle: string }) {
    const res = await apiRequest("POST", "/api/auth/signup", data);
    const json = await res.json();
    setCurrentUserId(json.profile.id);
    setUser(json.profile);
    queryClient.invalidateQueries();
    return json.profile as Profile;
  }

  async function loginAsDemo(userId: string) {
    setCurrentUserId(userId);
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setUser(data.profile);
      queryClient.invalidateQueries();
      return data.profile as Profile;
    } catch {
      setCurrentUserId(null);
      setUser(null);
      return null;
    }
  }

  function logout() {
    setCurrentUserId(null);
    setUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginAsDemo, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
