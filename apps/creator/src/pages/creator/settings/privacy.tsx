import { useMutation } from "@tanstack/react-query";
import { SettingsSubShell } from "./_shell";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn, getErrorMessage } from "@/lib/utils";

export default function SettingsPrivacyPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const deleteMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/profile");
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Account deleted" });
      logout();
    },
    onError: (e: unknown) =>
      toast({ title: "Couldn't delete", description: getErrorMessage(e), variant: "destructive" }),
  });

  function confirmDelete() {
    if (
      confirm(
        "Delete your account? This permanently removes your profile, applications, earnings history and all related data. This cannot be undone."
      )
    ) {
      deleteMut.mutate();
    }
  }

  if (!user) return null;

  return (
    <SettingsSubShell title="Privacy & security" subtitle="Control your data">
      <div className="space-y-5">
        <Section title="Data">
          <InfoRow
            icon="visibility"
            label="Profile visibility"
            value="Public to verified brands"
          />
          <InfoRow
            icon="lock"
            label="Payout details"
            value="Encrypted, never shared"
          />
          <InfoRow
            icon="verified_user"
            label="Identity documents"
            value="Admin-reviewed only"
            last
          />
        </Section>

        <Section title="Security">
          <InfoRow
            icon="mail"
            label="Email"
            value={user.email}
          />
          <InfoRow
            icon="phone"
            label="Phone"
            value={user.phone || "Not set"}
            last
          />
        </Section>

        <Section title="Compliance">
          <DocRow
            icon="description"
            label="Privacy policy"
            href="https://www.creatorx.app/privacy"
          />
          <DocRow
            icon="gavel"
            label="Terms of service"
            href="https://www.creatorx.app/terms"
          />
          <DocRow
            icon="cookie"
            label="Cookie policy"
            href="https://www.creatorx.app/cookies"
            last
          />
        </Section>

        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">
            Danger zone
          </h2>
          <div className="bg-red-500/5 border border-red-500/30 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Icon name="warning" filled className="text-red-400 text-[20px] flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm text-red-300">Delete account</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Permanently removes your profile, applications, earnings history, and all related data.
                  Any pending payouts are cancelled.
                </div>
              </div>
            </div>
            <button
              onClick={confirmDelete}
              disabled={deleteMut.isPending}
              className="w-full h-11 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 font-bold text-sm hover-elevate disabled:opacity-50"
              data-testid="button-delete"
            >
              {deleteMut.isPending ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </section>
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

function InfoRow({
  icon, label, value, last,
}: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3.5", !last && "border-b border-border")}>
      <div className="size-9 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0">
        <Icon name={icon} filled className="text-[18px] text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{value}</div>
      </div>
    </div>
  );
}

function DocRow({
  icon, label, href, last,
}: {
  icon: string;
  label: string;
  href: string;
  last?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 hover-elevate",
        !last && "border-b border-border"
      )}
    >
      <div className="size-9 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0">
        <Icon name={icon} filled className="text-[18px] text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{label}</div>
      </div>
      <Icon name="open_in_new" className="text-muted-foreground text-[18px] flex-shrink-0" />
    </a>
  );
}
