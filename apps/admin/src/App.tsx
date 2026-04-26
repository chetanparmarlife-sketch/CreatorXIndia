import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { AuthProvider, NotAuthorizedPage, RequireAuth, RequireRole, queryClient } from "@creatorx/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import AdminLoginPage from "@/pages/auth/login";
import DashboardPage from "@/pages/admin/dashboard";
import BrandsPage from "@/pages/admin/brands";
import CampaignsPage from "@/pages/admin/campaigns";
import ApplicationsPage from "@/pages/admin/applications";
import DeliverablesPage from "@/pages/admin/deliverables";
import CreatorsPage from "@/pages/admin/creators";
import CreatorDetailPage from "@/pages/admin/creator-detail";
import KycPage from "@/pages/admin/kyc";
import PayoutsPage from "@/pages/admin/payouts";
import AuditPage from "@/pages/admin/audit";
import NotFound from "@/pages/not-found";

const ADMIN_ROLES = ["admin", "admin_ops", "admin_support", "admin_finance", "admin_readonly"] as const;

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={[...ADMIN_ROLES]}>{children}</RequireRole>
    </RequireAuth>
  );
}

function BrandScopePlaceholder() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-extrabold">Brand workspace moved</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use the brand portal for brand-specific campaign, wallet, team, and inbox views.</p>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/auth/login" component={AdminLoginPage} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard"><AdminRoute><DashboardPage /></AdminRoute></Route>
      <Route path="/brands/:brandId/:rest*"><AdminRoute><BrandScopePlaceholder /></AdminRoute></Route>
      <Route path="/brands"><AdminRoute><BrandsPage /></AdminRoute></Route>
      <Route path="/campaigns"><AdminRoute><CampaignsPage /></AdminRoute></Route>
      <Route path="/applications"><AdminRoute><ApplicationsPage /></AdminRoute></Route>
      <Route path="/deliverables"><AdminRoute><DeliverablesPage /></AdminRoute></Route>
      <Route path="/creators/:id"><AdminRoute><CreatorDetailPage /></AdminRoute></Route>
      <Route path="/creators"><AdminRoute><CreatorsPage /></AdminRoute></Route>
      <Route path="/kyc"><AdminRoute><KycPage /></AdminRoute></Route>
      <Route path="/payouts"><AdminRoute><PayoutsPage /></AdminRoute></Route>
      <Route path="/audit"><AdminRoute><AuditPage /></AdminRoute></Route>
      <Route path="/not-authorized" component={NotAuthorizedPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
