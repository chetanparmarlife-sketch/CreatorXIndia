import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type BrandProfile = {
  id: string;
  name: string;
  logo_url: string | null;
  verified: boolean;
  status: "pending" | "approved" | "rejected";
  website: string | null;
  industry: string;
  description: string | null;
  contact_email: string | null;
  wallet_balance_paise: number;
  notification_preferences: Record<string, boolean>;
  created_at: string;
};

type WalletSummary = {
  balancePaise: number;
};

type Invoice = {
  id: string;
  invoice_number: string;
  total_paise: number;
  issued_at: string;
  pdf_url: string | null;
};

type TabKey = "profile" | "notifications" | "billing";

const NOTIFICATION_EVENTS = [
  "new_application",
  "deliverable_submitted",
  "message_received",
  "campaign_approved",
] as const;

export default function BrandSettingsPage() {
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `s/${brandId}` : "";
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [form, setForm] = useState({
    companyName: "",
    industry: "",
    websiteUrl: "",
    gstin: "",
    logoUrl: "",
  });
  const [notificationState, setNotificationState] = useState<Record<string, boolean>>({});

  const brandQuery = useQuery<{ brand: BrandProfile }>({
    queryKey: ["brand", brandId, "profile"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/profile");
      return res.json() as Promise<{ brand: BrandProfile }>;
    },
  });

  const walletQuery = useQuery<WalletSummary>({
    queryKey: ["brand", brandId, "wallet"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/wallet");
      return res.json() as Promise<WalletSummary>;
    },
  });

  const invoicesQuery = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["brand", brandId, "invoices"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/invoices");
      return res.json() as Promise<{ invoices: Invoice[] }>;
    },
  });

  useEffect(() => {
    const brand = brandQuery.data?.brand;
    if (!brand) return;
    setForm({
      companyName: brand.name || "",
      industry: brand.industry || "",
      websiteUrl: brand.website || "",
      gstin: "",
      logoUrl: brand.logo_url || "",
    });
    setNotificationState({
      new_application: Boolean(brand.notification_preferences?.new_application),
      deliverable_submitted: Boolean(brand.notification_preferences?.deliverable_submitted),
      message_received: Boolean(brand.notification_preferences?.message_received),
      campaign_approved: Boolean(brand.notification_preferences?.campaign_approved),
    });
  }, [brandQuery.data?.brand]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyName: form.companyName,
        industry: form.industry,
        websiteUrl: form.websiteUrl,
        gstin: form.gstin || undefined,
        logoUrl: form.logoUrl || undefined,
      };
      const res = await apiRequest("PATCH", "/api/brand/profile", payload);
      return res.json() as Promise<{ brand: BrandProfile }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["brand", brandId, "profile"] });
      toast({ title: "Profile saved" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not save profile";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    },
  });

  const saveNotificationsMutation = useMutation({
    mutationFn: async (preferences: Record<string, boolean>) => {
      const res = await apiRequest("PATCH", "/api/brand/notification-preferences", { preferences });
      return res.json() as Promise<{ preferences: Record<string, boolean> }>;
    },
    onSuccess: async (data) => {
      setNotificationState(data.preferences);
      await queryClient.invalidateQueries({ queryKey: ["brand", brandId, "profile"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not update preferences";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    },
  });

  const balancePaise = walletQuery.data?.balancePaise ?? 0;
  const invoices = invoicesQuery.data?.invoices ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h1 className="text-3xl font-bold">Settings</h1>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === "profile" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              data-testid="tab-profile"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notifications")}
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === "notifications" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              data-testid="tab-notifications"
            >
              Notifications
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`rounded-lg px-3 py-2 text-sm ${activeTab === "billing" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              data-testid="tab-billing"
            >
              Billing
            </button>
          </div>

          {activeTab === "profile" && (
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.companyName}
                onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))}
                placeholder="Company name"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
                data-testid="input-companyName"
              />
              <input
                value={form.industry}
                onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))}
                placeholder="Industry"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
                data-testid="input-industry"
              />
              <input
                value={form.websiteUrl}
                onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))}
                placeholder="https://yourcompany.com"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
                data-testid="input-websiteUrl"
              />
              <input
                value={form.gstin}
                onChange={(event) => setForm((current) => ({ ...current, gstin: event.target.value }))}
                placeholder="GSTIN (optional)"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
                data-testid="input-gstin"
              />
              <input
                value={form.logoUrl}
                onChange={(event) => setForm((current) => ({ ...current, logoUrl: event.target.value }))}
                placeholder="Logo URL (optional)"
                className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none md:col-span-2"
                data-testid="input-logoUrl"
              />
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => saveProfileMutation.mutate()}
                  disabled={saveProfileMutation.isPending}
                  className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  data-testid="btn-save-profile"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3">
              {NOTIFICATION_EVENTS.map((eventName) => (
                <button
                  key={eventName}
                  type="button"
                  onClick={() => {
                    const next = { ...notificationState, [eventName]: !notificationState[eventName] };
                    setNotificationState(next);
                    saveNotificationsMutation.mutate(next);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left"
                  data-testid={`toggle-${eventName}`}
                >
                  <span className="text-sm capitalize">{eventName.replace(/_/g, " ")}</span>
                  <span className={`rounded-full px-2 py-1 text-xs ${notificationState[eventName] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {notificationState[eventName] ? "On" : "Off"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm text-muted-foreground">Current wallet balance</div>
                <div className="mt-1 text-2xl font-bold" data-testid="billing-wallet-balance">
                  {fmtMoney(balancePaise)}
                </div>
                <Link href={`${brandBasePath}/wallet`} className="mt-3 inline-block text-sm text-primary underline" data-testid="link-open-wallet">
                  Open wallet
                </Link>
              </div>

              <div className="space-y-2">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-4 md:items-center">
                    <div className="font-medium">{invoice.invoice_number}</div>
                    <div>{fmtMoney(invoice.total_paise)}</div>
                    <div className="text-sm text-muted-foreground">{fmtDate(invoice.issued_at)}</div>
                    {invoice.pdf_url ? (
                      <a href={invoice.pdf_url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                        Download
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">Download unavailable</span>
                    )}
                  </div>
                ))}
                {invoices.length === 0 && (
                  <div className="text-sm text-muted-foreground">No invoices yet.</div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
