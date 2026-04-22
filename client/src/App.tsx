import { Switch, Route, Router, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import { Icon } from "@/components/brand";

// Auth pages
import OnboardingPage from "@/pages/auth/onboarding";
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import ConnectSocialsPage from "@/pages/auth/connect-socials";
import NichesPage from "@/pages/auth/niches";

// Creator pages
import HomePage from "@/pages/creator/home";
import DiscoverPage from "@/pages/creator/discover";
import CampaignDetailsPage from "@/pages/creator/campaign-details";
import MyCampaignsPage from "@/pages/creator/my-campaigns";
import InboxPage from "@/pages/creator/inbox";
import ChatThreadPage from "@/pages/creator/chat-thread";
import NewMessagePage from "@/pages/creator/new-message";
import NotificationsPage from "@/pages/creator/notifications";
import EarningsPage from "@/pages/creator/earnings";
import WithdrawPage from "@/pages/creator/withdraw";
import ProfilePage from "@/pages/creator/profile";
import SettingsPage from "@/pages/creator/settings/index";
import SettingsProfilePage from "@/pages/creator/settings/profile";
import SettingsKycPage from "@/pages/creator/settings/kyc";
import SettingsPayoutsPage from "@/pages/creator/settings/payouts";
import SettingsNotificationsPage from "@/pages/creator/settings/notifications";
import SettingsPrivacyPage from "@/pages/creator/settings/privacy";
import SettingsHelpPage from "@/pages/creator/settings/help";
import CommunityPage from "@/pages/creator/community";
import EventDetailsPage from "@/pages/creator/event-details";

// Admin pages
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminCreatorsPage from "@/pages/admin/creators";
import AdminCreatorDetailPage from "@/pages/admin/creator-detail";
import AdminBrandsPage from "@/pages/admin/brands";
import AdminCampaignsPage from "@/pages/admin/campaigns";
import AdminApplicationsPage from "@/pages/admin/applications";
import AdminDeliverablesPage from "@/pages/admin/deliverables";
import AdminPayoutsPage from "@/pages/admin/payouts";
import AdminKycPage from "@/pages/admin/kyc";
import AdminHandlesPage from "@/pages/admin/handles";
import AdminCommunityPage from "@/pages/admin/community";
import AdminAuditPage from "@/pages/admin/audit";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Icon name="progress_activity" className="animate-spin text-[32px] text-primary" />
    </div>
  );
}

function RequireAuth({ children, role }: { children: React.ReactNode; role?: "creator" | "admin" }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) return <LoadingScreen />;

  if (!user) {
    // Landing / onboarding for unauthenticated users — keep them on these pages
    if (["/", "/login", "/signup", "/onboarding"].includes(location)) {
      return <>{children}</>;
    }
    return <Redirect to="/login" />;
  }

  if (role && user.role !== role) {
    // Admin trying to visit creator app or vice versa
    return <Redirect to={user.role === "admin" ? "/admin" : "/home"} />;
  }

  return <>{children}</>;
}

function RoleLanding() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <OnboardingPage />;
  return <Redirect to={user.role === "admin" ? "/admin" : "/home"} />;
}

function AppRouter() {
  return (
    <Switch>
      {/* Landing */}
      <Route path="/" component={RoleLanding} />

      {/* Auth */}
      <Route path="/onboarding" component={OnboardingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/connect-socials">
        <RequireAuth><ConnectSocialsPage /></RequireAuth>
      </Route>
      <Route path="/niches">
        <RequireAuth><NichesPage /></RequireAuth>
      </Route>

      {/* Creator app */}
      <Route path="/home">
        <RequireAuth role="creator"><HomePage /></RequireAuth>
      </Route>
      <Route path="/discover">
        <RequireAuth role="creator"><DiscoverPage /></RequireAuth>
      </Route>
      <Route path="/campaigns">
        <RequireAuth role="creator"><MyCampaignsPage /></RequireAuth>
      </Route>
      <Route path="/campaigns/:id">
        <RequireAuth role="creator"><CampaignDetailsPage /></RequireAuth>
      </Route>
      <Route path="/inbox">
        <RequireAuth role="creator"><InboxPage /></RequireAuth>
      </Route>
      <Route path="/chat/:id">
        <RequireAuth role="creator"><ChatThreadPage /></RequireAuth>
      </Route>
      <Route path="/new-message">
        <RequireAuth role="creator"><NewMessagePage /></RequireAuth>
      </Route>
      <Route path="/notifications">
        <RequireAuth role="creator"><NotificationsPage /></RequireAuth>
      </Route>
      <Route path="/earnings">
        <RequireAuth role="creator"><EarningsPage /></RequireAuth>
      </Route>
      <Route path="/withdraw">
        <RequireAuth role="creator"><WithdrawPage /></RequireAuth>
      </Route>
      <Route path="/profile">
        <RequireAuth role="creator"><ProfilePage /></RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth role="creator"><SettingsPage /></RequireAuth>
      </Route>
      <Route path="/settings/profile">
        <RequireAuth role="creator"><SettingsProfilePage /></RequireAuth>
      </Route>
      <Route path="/settings/kyc">
        <RequireAuth role="creator"><SettingsKycPage /></RequireAuth>
      </Route>
      <Route path="/settings/payouts">
        <RequireAuth role="creator"><SettingsPayoutsPage /></RequireAuth>
      </Route>
      <Route path="/settings/notifications">
        <RequireAuth role="creator"><SettingsNotificationsPage /></RequireAuth>
      </Route>
      <Route path="/settings/privacy">
        <RequireAuth role="creator"><SettingsPrivacyPage /></RequireAuth>
      </Route>
      <Route path="/settings/help">
        <RequireAuth role="creator"><SettingsHelpPage /></RequireAuth>
      </Route>
      <Route path="/community">
        <RequireAuth role="creator"><CommunityPage /></RequireAuth>
      </Route>
      <Route path="/community/:id">
        <RequireAuth role="creator"><EventDetailsPage /></RequireAuth>
      </Route>

      {/* Admin console */}
      <Route path="/admin">
        <RequireAuth role="admin"><AdminDashboardPage /></RequireAuth>
      </Route>
      <Route path="/admin/creators">
        <RequireAuth role="admin"><AdminCreatorsPage /></RequireAuth>
      </Route>
      <Route path="/admin/creators/:id">
        <RequireAuth role="admin"><AdminCreatorDetailPage /></RequireAuth>
      </Route>
      <Route path="/admin/brands">
        <RequireAuth role="admin"><AdminBrandsPage /></RequireAuth>
      </Route>
      <Route path="/admin/campaigns">
        <RequireAuth role="admin"><AdminCampaignsPage /></RequireAuth>
      </Route>
      <Route path="/admin/applications">
        <RequireAuth role="admin"><AdminApplicationsPage /></RequireAuth>
      </Route>
      <Route path="/admin/deliverables">
        <RequireAuth role="admin"><AdminDeliverablesPage /></RequireAuth>
      </Route>
      <Route path="/admin/payouts">
        <RequireAuth role="admin"><AdminPayoutsPage /></RequireAuth>
      </Route>
      <Route path="/admin/kyc">
        <RequireAuth role="admin"><AdminKycPage /></RequireAuth>
      </Route>
      <Route path="/admin/handles">
        <RequireAuth role="admin"><AdminHandlesPage /></RequireAuth>
      </Route>
      <Route path="/admin/community">
        <RequireAuth role="admin"><AdminCommunityPage /></RequireAuth>
      </Route>
      <Route path="/admin/audit">
        <RequireAuth role="admin"><AdminAuditPage /></RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
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

export default App;
