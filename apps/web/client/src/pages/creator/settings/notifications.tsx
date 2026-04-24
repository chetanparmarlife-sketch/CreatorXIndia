import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SettingsSubShell } from "./_shell";
import { Switch } from "@/components/ui/switch";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export default function SettingsNotificationsPage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();

  const [push, setPush] = useState<boolean>(true);
  const [digest, setDigest] = useState<boolean>(true);
  const [marketing, setMarketing] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setPush(user.notif_push ?? true);
      setDigest(user.notif_email_digest ?? true);
      setMarketing(user.notif_marketing ?? false);
    }
  }, [user]);

  const mut = useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const res = await apiRequest("PATCH", "/api/profile/notifications", patch);
      return await res.json();
    },
    onSuccess: () => {
      refresh();
    },
    onError: (e: any) => {
      toast({ title: "Couldn't update", description: e?.message, variant: "destructive" });
    },
  });

  const update = (key: "notif_push" | "notif_email_digest" | "notif_marketing", value: boolean) => {
    if (key === "notif_push") setPush(value);
    if (key === "notif_email_digest") setDigest(value);
    if (key === "notif_marketing") setMarketing(value);
    mut.mutate({ [key]: value });
  };

  if (!user) return null;

  return (
    <SettingsSubShell title="Notifications" subtitle="Choose how we reach you">
      <div className="space-y-5">
        <Section title="In-app & push">
          <ToggleRow
            icon="notifications"
            label="Push notifications"
            description="Real-time alerts for applications, deliverables and payouts"
            value={push}
            onChange={(v) => update("notif_push", v)}
            testId="toggle-push"
            last
          />
        </Section>

        <Section title="Email">
          <ToggleRow
            icon="mail"
            label="Weekly digest"
            description="Top campaigns that match your niche, every Monday"
            value={digest}
            onChange={(v) => update("notif_email_digest", v)}
            testId="toggle-digest"
          />
          <ToggleRow
            icon="campaign"
            label="Marketing emails"
            description="Product updates, tips and creator stories"
            value={marketing}
            onChange={(v) => update("notif_marketing", v)}
            testId="toggle-marketing"
            last
          />
        </Section>

        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-start gap-2.5">
            <Icon name="info" filled className="text-muted-foreground text-[18px] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              Critical account notifications (payout status, KYC decisions, and security alerts)
              are always sent regardless of these settings.
            </div>
          </div>
        </div>
      </div>
    </SettingsSubShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function ToggleRow({
  icon, label, description, value, onChange, testId, last,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", !last && "border-b border-border")}>
      <div className="size-9 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0">
        <Icon name={icon} filled className="text-[18px] text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}
