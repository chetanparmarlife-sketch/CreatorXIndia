import type { ReactNode } from "react";
import { Switch, Route, Router, Redirect } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import type { UserRole } from "@creatorx/schema";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth";
import { RequireAuth, RequireRole, RoleRedirect } from "@/components/route-guard";
import NotFound from "@/pages/not-found";

// Auth pages
import LoginPage from "@/pages/auth/login";
import SignupPage from "@/pages/auth/signup";
import OnboardingPage from "@/pages/auth/onboarding";
import NichesPage from "@/pages/auth/niches";
import ConnectSocialsPage from "@/pages/auth/connect-socials";

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

// Brand pages
import BrandDashboardPage from "@/pages/brand/dashboard";
import BrandOnboardingPage from "@/pages/brand/onboarding";
import NewCampaignPage from "@/pages/brand/campaigns/new";

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

const ADMIN_ROLES: UserRole[] = ["admin_ops", "admin_support", "admin_finance", "admin_readonly"];

function NotAuthorizedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="page-not-authorized">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">You don't have access to this page.</h1>
      </div>
    </div>
  );
}

function CreatorRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={["creator"]}>{children}</RequireRole>
    </RequireAuth>
  );
}

function BrandRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={["brand"]}>{children}</RequireRole>
    </RequireAuth>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole roles={ADMIN_ROLES}>{children}</RequireRole>
    </RequireAuth>
  );
}

function CampaignAlias({ params }: { params: { id: string } }) {
  return <Redirect to={`/creator/campaigns/${params.id}`} />;
}

function ChatAlias({ params }: { params: { id: string } }) {
  return <Redirect to={`/creator/chat/${params.id}`} />;
}

function CommunityAlias({ params }: { params: { id: string } }) {
  return <Redirect to={`/creator/community/${params.id}`} />;
}

function SettingsAlias({ params }: { params: { section: string } }) {
  return <Redirect to={`/creator/settings/${params.section}`} />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/auth/login" component={LoginPage} />
      <Route path="/auth/signup" component={SignupPage} />
      <Route path="/auth/onboarding" component={OnboardingPage} />
      <Route path="/auth/niches" component={NichesPage} />
      <Route path="/auth/connect-socials" component={ConnectSocialsPage} />

      <Route path="/" component={RoleRedirect} />

      <Route path="/creator/home">
        <CreatorRoute><HomePage /></CreatorRoute>
      </Route>
      <Route path="/creator/discover">
        <CreatorRoute><DiscoverPage /></CreatorRoute>
      </Route>
      <Route path="/creator/campaigns">
        <CreatorRoute><MyCampaignsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/campaigns/:id">
        <CreatorRoute><CampaignDetailsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/inbox">
        <CreatorRoute><InboxPage /></CreatorRoute>
      </Route>
      <Route path="/creator/chat/:id">
        <CreatorRoute><ChatThreadPage /></CreatorRoute>
      </Route>
      <Route path="/creator/new-message">
        <CreatorRoute><NewMessagePage /></CreatorRoute>
      </Route>
      <Route path="/creator/notifications">
        <CreatorRoute><NotificationsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/earnings">
        <CreatorRoute><EarningsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/withdraw">
        <CreatorRoute><WithdrawPage /></CreatorRoute>
      </Route>
      <Route path="/creator/profile">
        <CreatorRoute><ProfilePage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings">
        <CreatorRoute><SettingsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/profile">
        <CreatorRoute><SettingsProfilePage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/kyc">
        <CreatorRoute><SettingsKycPage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/payouts">
        <CreatorRoute><SettingsPayoutsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/notifications">
        <CreatorRoute><SettingsNotificationsPage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/privacy">
        <CreatorRoute><SettingsPrivacyPage /></CreatorRoute>
      </Route>
      <Route path="/creator/settings/help">
        <CreatorRoute><SettingsHelpPage /></CreatorRoute>
      </Route>
      <Route path="/creator/community">
        <CreatorRoute><CommunityPage /></CreatorRoute>
      </Route>
      <Route path="/creator/community/:id">
        <CreatorRoute><EventDetailsPage /></CreatorRoute>
      </Route>

      <Route path="/brand/dashboard">
        <BrandRoute><BrandDashboardPage /></BrandRoute>
      </Route>
      <Route path="/brand/onboarding">
        <BrandRoute><BrandOnboardingPage /></BrandRoute>
      </Route>
      <Route path="/brand/campaigns/new">
        <BrandRoute><NewCampaignPage /></BrandRoute>
      </Route>
      <Route path="/brand/campaigns">
        <Redirect to="/brand/dashboard" />
      </Route>
      <Route path="/brand">
        <Redirect to="/brand/dashboard" />
      </Route>

      <Route path="/admin/dashboard">
        <AdminRoute><AdminDashboardPage /></AdminRoute>
      </Route>
      <Route path="/admin/creators">
        <AdminRoute><AdminCreatorsPage /></AdminRoute>
      </Route>
      <Route path="/admin/creators/:id">
        <AdminRoute><AdminCreatorDetailPage /></AdminRoute>
      </Route>
      <Route path="/admin/brands">
        <AdminRoute><AdminBrandsPage /></AdminRoute>
      </Route>
      <Route path="/admin/campaigns">
        <AdminRoute><AdminCampaignsPage /></AdminRoute>
      </Route>
      <Route path="/admin/applications">
        <AdminRoute><AdminApplicationsPage /></AdminRoute>
      </Route>
      <Route path="/admin/deliverables">
        <AdminRoute><AdminDeliverablesPage /></AdminRoute>
      </Route>
      <Route path="/admin/payouts">
        <AdminRoute><AdminPayoutsPage /></AdminRoute>
      </Route>
      <Route path="/admin/kyc">
        <AdminRoute><AdminKycPage /></AdminRoute>
      </Route>
      <Route path="/admin/handles">
        <AdminRoute><AdminHandlesPage /></AdminRoute>
      </Route>
      <Route path="/admin/community">
        <AdminRoute><AdminCommunityPage /></AdminRoute>
      </Route>
      <Route path="/admin/audit">
        <AdminRoute><AdminAuditPage /></AdminRoute>
      </Route>
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>

      <Route path="/not-authorized" component={NotAuthorizedPage} />

      {/* Legacy aliases */}
      <Route path="/login"><Redirect to="/auth/login" /></Route>
      <Route path="/signup"><Redirect to="/auth/signup" /></Route>
      <Route path="/onboarding"><Redirect to="/auth/onboarding" /></Route>
      <Route path="/niches"><Redirect to="/auth/niches" /></Route>
      <Route path="/connect-socials"><Redirect to="/auth/connect-socials" /></Route>

      <Route path="/home"><Redirect to="/creator/home" /></Route>
      <Route path="/discover"><Redirect to="/creator/discover" /></Route>
      <Route path="/campaigns" component={() => <Redirect to="/creator/campaigns" />} />
      <Route path="/campaigns/:id" component={CampaignAlias} />
      <Route path="/inbox"><Redirect to="/creator/inbox" /></Route>
      <Route path="/chat/:id" component={ChatAlias} />
      <Route path="/new-message"><Redirect to="/creator/new-message" /></Route>
      <Route path="/notifications"><Redirect to="/creator/notifications" /></Route>
      <Route path="/earnings"><Redirect to="/creator/earnings" /></Route>
      <Route path="/withdraw"><Redirect to="/creator/withdraw" /></Route>
      <Route path="/profile"><Redirect to="/creator/profile" /></Route>
      <Route path="/settings"><Redirect to="/creator/settings" /></Route>
      <Route path="/settings/:section" component={SettingsAlias} />
      <Route path="/community"><Redirect to="/creator/community" /></Route>
      <Route path="/community/:id" component={CommunityAlias} />

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
