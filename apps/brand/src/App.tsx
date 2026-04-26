import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { AuthProvider, NotAuthorizedPage, RequireAuth, RequireRole, queryClient } from "@creatorx/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import BrandLoginPage from "@/pages/auth/login";
import DashboardPage from "@/pages/brand/dashboard";
import OnboardingPage from "@/pages/brand/onboarding";
import CampaignsPage from "@/pages/brand/campaigns/index";
import NewCampaignPage from "@/pages/brand/campaigns/new";
import CampaignDetailPage from "@/pages/brand/campaigns/[id]";
import CampaignApplicationsPage from "@/pages/brand/campaigns/[id]/applications";
import CampaignDeliverablesPage from "@/pages/brand/campaigns/[id]/deliverables";
import MarketplacePage from "@/pages/brand/marketplace";
import CreatorProfilePage from "@/pages/brand/creators/[id]";
import InboxPage from "@/pages/brand/inbox";
import ThreadPage from "@/pages/brand/messages/[threadId]";
import WalletPage from "@/pages/brand/wallet";
import TeamPage from "@/pages/brand/team";
import SettingsPage from "@/pages/brand/settings";
import NotFound from "@/pages/not-found";

function BrandRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={["brand"]}>{children}</RequireRole>
    </RequireAuth>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/auth/login" component={BrandLoginPage} />
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard"><BrandRoute><DashboardPage /></BrandRoute></Route>
      <Route path="/onboarding"><BrandRoute><OnboardingPage /></BrandRoute></Route>
      <Route path="/campaigns/new"><BrandRoute><NewCampaignPage /></BrandRoute></Route>
      <Route path="/campaigns/:id/applications"><BrandRoute><CampaignApplicationsPage /></BrandRoute></Route>
      <Route path="/campaigns/:id/deliverables"><BrandRoute><CampaignDeliverablesPage /></BrandRoute></Route>
      <Route path="/campaigns/:id"><BrandRoute><CampaignDetailPage /></BrandRoute></Route>
      <Route path="/campaigns"><BrandRoute><CampaignsPage /></BrandRoute></Route>
      <Route path="/marketplace"><BrandRoute><MarketplacePage /></BrandRoute></Route>
      <Route path="/creators/:creatorId"><BrandRoute><CreatorProfilePage /></BrandRoute></Route>
      <Route path="/inbox"><BrandRoute><InboxPage /></BrandRoute></Route>
      <Route path="/messages/:threadId"><BrandRoute><ThreadPage /></BrandRoute></Route>
      <Route path="/wallet"><BrandRoute><WalletPage /></BrandRoute></Route>
      <Route path="/team"><BrandRoute><TeamPage /></BrandRoute></Route>
      <Route path="/settings"><BrandRoute><SettingsPage /></BrandRoute></Route>
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
