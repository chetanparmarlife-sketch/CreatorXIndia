import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Route, Router, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { AuthProvider, NotAuthorizedPage, RequireAuth, RequireRole, queryClient } from "@creatorx/ui";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import CreatorLoginPage from "@/pages/auth/login";
import HomePage from "@/pages/creator/home";
import DiscoverPage from "@/pages/creator/discover";
import CampaignDetailPage from "@/pages/creator/campaign-details";
import MyCampaignsPage from "@/pages/creator/my-campaigns";
import EarningsPage from "@/pages/creator/earnings";
import NotificationsPage from "@/pages/creator/notifications";
import InboxPage from "@/pages/creator/inbox";
import ThreadPage from "@/pages/creator/chat-thread";
import WithdrawPage from "@/pages/creator/withdraw";
import SettingsPage from "@/pages/creator/settings/index";
import SettingsProfilePage from "@/pages/creator/settings/profile";
import SettingsKycPage from "@/pages/creator/settings/kyc";
import SettingsPayoutsPage from "@/pages/creator/settings/payouts";
import SettingsNotificationsPage from "@/pages/creator/settings/notifications";
import SettingsPrivacyPage from "@/pages/creator/settings/privacy";
import SettingsHelpPage from "@/pages/creator/settings/help";
import NotFound from "@/pages/not-found";

function CreatorRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={["creator"]}>{children}</RequireRole>
    </RequireAuth>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/auth/login" component={CreatorLoginPage} />
      <Route path="/" component={() => <Redirect to="/home" />} />
      <Route path="/home"><CreatorRoute><HomePage /></CreatorRoute></Route>
      <Route path="/discover"><CreatorRoute><DiscoverPage /></CreatorRoute></Route>
      <Route path="/campaigns/:id"><CreatorRoute><CampaignDetailPage /></CreatorRoute></Route>
      <Route path="/campaigns"><CreatorRoute><MyCampaignsPage /></CreatorRoute></Route>
      <Route path="/earnings"><CreatorRoute><EarningsPage /></CreatorRoute></Route>
      <Route path="/notifications"><CreatorRoute><NotificationsPage /></CreatorRoute></Route>
      <Route path="/inbox/:id"><CreatorRoute><ThreadPage /></CreatorRoute></Route>
      <Route path="/inbox"><CreatorRoute><InboxPage /></CreatorRoute></Route>
      <Route path="/withdraw"><CreatorRoute><WithdrawPage /></CreatorRoute></Route>
      <Route path="/settings/profile"><CreatorRoute><SettingsProfilePage /></CreatorRoute></Route>
      <Route path="/settings/kyc"><CreatorRoute><SettingsKycPage /></CreatorRoute></Route>
      <Route path="/settings/payouts"><CreatorRoute><SettingsPayoutsPage /></CreatorRoute></Route>
      <Route path="/settings/notifications"><CreatorRoute><SettingsNotificationsPage /></CreatorRoute></Route>
      <Route path="/settings/privacy"><CreatorRoute><SettingsPrivacyPage /></CreatorRoute></Route>
      <Route path="/settings/help"><CreatorRoute><SettingsHelpPage /></CreatorRoute></Route>
      <Route path="/settings"><CreatorRoute><SettingsPage /></CreatorRoute></Route>
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
