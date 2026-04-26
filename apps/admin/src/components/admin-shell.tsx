import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CreatorXMark, Icon } from "./brand";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import ImpersonationBanner from "@/pages/admin/impersonation-banner";
import { isReadOnly, useAdminRole, type AdminRole } from "@/hooks/useAdminRole";

const NAV = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard" },
  { href: "/creators", icon: "groups", label: "Creators" },
  { href: "/brands", icon: "storefront", label: "Brands" },
  { href: "/campaigns", icon: "campaign", label: "Campaigns" },
  { href: "/applications", icon: "fact_check", label: "Applications" },
  { href: "/deliverables", icon: "movie", label: "Deliverables" },
  { href: "/kyc", icon: "fingerprint", label: "KYC queue" },
  { href: "/handles", icon: "verified_user", label: "Handles" },
  { href: "/payouts", icon: "payments", label: "Payouts" },
  { href: "/community", icon: "event", label: "Community" },
  { href: "/audit", icon: "history", label: "Audit log" },
];

function navForRole(role: AdminRole) {
  const labelsByRole: Record<AdminRole, string[]> = {
    admin_readonly: ["Dashboard", "Brands", "Campaigns", "Creators", "Audit log"],
    admin_finance: ["Dashboard", "Payouts", "KYC queue", "Audit log"],
    admin_support: ["Dashboard", "Brands", "Campaigns", "Applications", "Deliverables", "Creators", "KYC queue", "Audit log"],
    admin_ops: NAV.map((item) => item.label),
  };
  const allowed = new Set(labelsByRole[role]);
  return NAV.filter((item) => allowed.has(item.label));
}

export function AdminShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const adminRole = useAdminRole();
  const navItems = navForRole(adminRole);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border bg-card min-h-screen sticky top-0 flex flex-col">
        <div className="px-5 py-6 border-b border-border">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover-elevate rounded-lg px-2 py-1.5 -mx-2">
            <CreatorXMark className="size-7" />
            <div>
              <div className="font-black tracking-tight text-sm">CreatorX</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Admin Console</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard" ? location === "/dashboard" : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors hover-elevate",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                )}
                data-testid={`link-admin-${item.label.toLowerCase()}`}
              >
                <Icon name={item.icon} filled={active} className="text-[20px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
              {user?.full_name?.[0] || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{user?.full_name}</div>
              <div className="text-[10px] text-muted-foreground truncate">Admin</div>
            </div>
            <button
              onClick={logout}
              className="size-8 rounded-lg hover-elevate flex items-center justify-center text-muted-foreground"
              data-testid="button-logout"
            >
              <Icon name="logout" className="text-[16px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {(title || actions) && (
          <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-8 py-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              {title && <h1 className="text-xl font-extrabold tracking-tight truncate">{title}</h1>}
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
            {isReadOnly(adminRole) && (
              <span
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted-foreground"
                data-testid="badge-readonly"
              >
                View Only
              </span>
            )}
          </header>
        )}
        <div className="px-8 py-6">
          <ImpersonationBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
