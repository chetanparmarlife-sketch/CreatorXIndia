import type { UserRole } from "@creatorx/schema";
import { useAuth } from "@/lib/auth";

export type AdminRole = "admin_ops" | "admin_support" | "admin_finance" | "admin_readonly";

export function normalizeAdminRole(role: UserRole | null | undefined): AdminRole {
  if (role === "admin_support") return "admin_support";
  if (role === "admin_finance") return "admin_finance";
  if (role === "admin_readonly") return "admin_readonly";
  return "admin_ops";
}

export function canOverride(role: AdminRole): boolean {
  return role === "admin_ops" || role === "admin_support";
}

export function canApproveCampaigns(role: AdminRole): boolean {
  return role === "admin_ops";
}

export function isFinanceOnly(role: AdminRole): boolean {
  return role === "admin_finance";
}

export function isReadOnly(role: AdminRole): boolean {
  return role === "admin_readonly";
}

export function useAdminRole(): AdminRole {
  const { user } = useAuth();
  return normalizeAdminRole(user?.role);
}
