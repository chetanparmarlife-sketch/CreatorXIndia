import type { ReactNode } from "react";
import { Redirect } from "wouter";
import type { UserRole } from "@creatorx/schema";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="state-auth-loading">
      <Icon name="progress_activity" className="animate-spin text-[32px] text-primary" />
    </div>
  );
}

function isAdminRole(role: UserRole): boolean {
  return role === "admin_ops" || role === "admin_support" || role === "admin_finance" || role === "admin_readonly";
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/auth/login" />;
  return <>{children}</>;
}

export function RequireRole({ children, roles }: { children: ReactNode; roles: UserRole[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/auth/login" />;
  if (!roles.includes(user.role)) return <Redirect to="/not-authorized" />;

  return <>{children}</>;
}

export function RoleRedirect() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/auth/login" />;
  if (user.role === "creator") return <Redirect to="/creator/home" />;
  if (user.role === "brand") return <Redirect to="/brand/dashboard" />;
  if (isAdminRole(user.role)) return <Redirect to="/admin/dashboard" />;

  return <Redirect to="/not-authorized" />;
}
