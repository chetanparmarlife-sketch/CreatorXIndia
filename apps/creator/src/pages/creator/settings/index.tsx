import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CreatorShell, CreatorSubHeader } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { cn, getErrorMessage } from "@/lib/utils";

type KycPayload = { kyc_status: string };
type PayoutPayload = { upi_id: string | null; bank_ifsc: string | null };

export default function SettingsHub() {
  const { user, logout } = useAuth();
  const { data: kyc } = useQuery<KycPayload>({ queryKey: ["/api/kyc"] });
  const { data: payout } = useQuery<PayoutPayload>({ queryKey: ["/api/payout-instruments"] });

  if (!user) return null;

  const kycStatus = kyc?.kyc_status || "none";
  const hasUpi = !!payout?.upi_id;
  const hasBank = !!payout?.bank_ifsc;
  const payoutSummary = hasUpi && hasBank ? "UPI + Bank saved" : hasUpi ? "UPI saved" : hasBank ? "Bank saved" : "Not set up";

  const kycMeta = {
    none: { label: "Not submitted", cls: "text-muted-foreground" },
    pending: { label: "Under review", cls: "text-amber-400" },
    verified: { label: "Verified", cls: "text-green-400" },
    rejected: { label: "Rejected", cls: "text-red-400" },
  }[kycStatus] || { label: "Not submitted", cls: "text-muted-foreground" };

  return (
    <CreatorShell>
      <CreatorSubHeader title="Settings" backHref="/profile" />

      <div className="px-5 pt-1 pb-4 space-y-6">
        {/* User card */}
        <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-2xl">
          <img
            src={user.avatar_url || ""}
            alt={user.full_name}
            className="size-12 rounded-full object-cover border border-border"
          />
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{user.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">@{(user.handle || "").replace(/^@/, "")}</div>
          </div>
          <Link
            href="/settings/profile"
            className="text-xs font-bold text-primary hover-elevate px-3 py-1.5 rounded-full border border-primary/30"
            data-testid="link-edit-profile"
          >
            Edit
          </Link>
        </div>

        <Section title="Account">
          <MenuRow
            icon="badge"
            label="Edit profile"
            description="Name, handle, bio, city, languages"
            href="/settings/profile"
            testId="menu-profile"
          />
          <MenuRow
            icon="description"
            label="KYC & Tax"
            description={kycMeta.label}
            descriptionCls={kycMeta.cls}
            href="/settings/kyc"
            testId="menu-kyc"
          />
          <MenuRow
            icon="credit_card"
            label="Payout methods"
            description={payoutSummary}
            href="/settings/payouts"
            testId="menu-payouts"
            last
          />
        </Section>

        <Section title="Preferences">
          <MenuRow
            icon="notifications"
            label="Notifications"
            description="Push, email digest, marketing"
            href="/settings/notifications"
            testId="menu-notifications"
          />
          <MenuRow
            icon="link"
            label="Connected accounts"
            description="Instagram, YouTube, etc."
            href="/connect-socials"
            testId="menu-socials"
            last
          />
        </Section>

        <Section title="Support">
          <MenuRow
            icon="shield"
            label="Privacy & security"
            description="Data, password, account"
            href="/settings/privacy"
            testId="menu-privacy"
          />
          <MenuRow
            icon="help"
            label="Help & support"
            description="FAQ, contact us"
            href="/settings/help"
            testId="menu-help"
            last
          />
        </Section>

        <button
          onClick={logout}
          className="w-full h-12 rounded-2xl bg-card border border-border text-red-400 font-bold hover-elevate"
          data-testid="button-signout"
        >
          Sign out
        </button>

        <div className="text-center text-xs text-muted-foreground pt-2">
          CreatorX · Made in India for creators
        </div>
      </div>
    </CreatorShell>
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

function MenuRow({
  icon, label, description, descriptionCls, href, last, testId,
}: {
  icon: string;
  label: string;
  description?: string;
  descriptionCls?: string;
  href: string;
  last?: boolean;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 hover-elevate",
        !last && "border-b border-border"
      )}
      data-testid={testId}
    >
      <div className="size-9 rounded-xl bg-background border border-border flex items-center justify-center flex-shrink-0">
        <Icon name={icon} filled className="text-[18px] text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{label}</div>
        {description && (
          <div className={cn("text-xs truncate", descriptionCls || "text-muted-foreground")}>
            {description}
          </div>
        )}
      </div>
      <Icon name="chevron_right" className="text-muted-foreground flex-shrink-0" />
    </Link>
  );
}
