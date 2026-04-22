import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CreatorShell,
  CreatorHeader,
  HeaderIconButton,
  SectionHeader,
} from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { fmtMoney, fmtCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SocialAccount } from "@shared/schema";

const PLATFORM_META: Record<string, { icon: string; label: string; color: string }> = {
  instagram: { icon: "photo_camera", label: "Instagram", color: "from-[#f58529] via-[#dd2a7b] to-[#8134af]" },
  youtube: { icon: "play_arrow", label: "YouTube", color: "from-[#ff0000] to-[#c00]" },
  twitter: { icon: "chat", label: "X / Twitter", color: "from-[#1da1f2] to-[#0d8ecf]" },
  linkedin: { icon: "work", label: "LinkedIn", color: "from-[#0a66c2] to-[#0a4d8f]" },
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: socialsData } = useQuery<{ socials: SocialAccount[] }>({
    queryKey: ["/api/socials"],
  });

  const socials = socialsData?.socials || [];
  const connected = socials.filter((s) => s.connected);

  if (!user) return null;

  return (
    <CreatorShell>
      <CreatorHeader
        title="Profile"
        trailing={
          <HeaderIconButton
            icon="settings"
            href="/settings"
            label="Settings"
            testId="link-settings"
          />
        }
      />

      <div className="px-5 space-y-6 pb-4">
        {/* Profile header */}
        <div className="flex flex-col items-center text-center pt-1">
          <div className="relative">
            <img
              src={user.avatar_url || ""}
              alt={user.full_name}
              className="size-28 rounded-full border-4 border-primary/30 object-cover"
            />
            {user.verified_pro && (
              <div className="absolute bottom-1 right-1 size-8 rounded-full bg-primary border-4 border-background flex items-center justify-center">
                <Icon name="verified" filled className="text-primary-foreground text-[14px]" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-3">{user.full_name}</h1>
          <div className="text-sm text-muted-foreground">@{(user.handle || "").replace(/^@/, "")}</div>
          {user.verified_pro && (
            <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-primary/15 text-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
              <Icon name="workspace_premium" filled className="text-[14px]" />
              Verified Pro
            </div>
          )}
          {user.bio && (
            <p className="text-sm text-muted-foreground mt-3 max-w-xs">{user.bio}</p>
          )}
          {user.niches.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {user.niches.map((n) => (
                <span key={n} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-card border border-border rounded-full px-2.5 py-1">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Reach" value={fmtCompact(user.total_reach)} />
          <StatTile label="Engagement" value={`${user.avg_engagement.toFixed(1)}%`} />
          <StatTile label="Earned" value={fmtMoney(user.total_earned_cents, { compact: true })} />
        </div>

        {/* Connected socials */}
        <section>
          <SectionHeader
            title="Connected accounts"
            action={<Link href="/connect-socials">Manage</Link>}
          />
          {connected.length === 0 ? (
            <Link
              href="/connect-socials"
              className="block p-5 bg-card border border-dashed border-border rounded-2xl text-center hover-elevate"
            >
              <Icon name="link" className="text-[28px] text-muted-foreground mb-1" />
              <div className="font-bold text-sm">Connect your first account</div>
              <p className="text-xs text-muted-foreground mt-0.5">Unlock campaigns matched to your reach.</p>
            </Link>
          ) : (
            <div className="space-y-2">
              {connected.map((s) => {
                const meta = PLATFORM_META[s.platform];
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
                    <div className={cn("size-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white", meta.color)}>
                      <Icon name={meta.icon} filled className="text-[20px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">@{s.handle.replace(/^@/, "")}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtCompact(s.followers)} followers · {s.engagement_rate.toFixed(1)}% engagement
                      </div>
                    </div>
                    <Icon name="check_circle" filled className="text-green-400 text-[20px]" />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Menu */}
        <section>
          <SectionHeader title="Account" />
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <MenuRow icon="badge" label="Edit profile" href="/settings/profile" />
            <MenuRow icon="credit_card" label="Payout methods" href="/settings/payouts" />
            <MenuRow icon="description" label="KYC & Tax" href="/settings/kyc" />
            <MenuRow icon="notifications" label="Notifications" href="/settings/notifications" />
            <MenuRow icon="shield" label="Privacy & security" href="/settings/privacy" />
            <MenuRow icon="help" label="Help & support" href="/settings/help" last />
          </div>
        </section>

        <button
          onClick={logout}
          className="w-full h-12 rounded-2xl bg-card border border-border text-red-400 font-bold hover-elevate"
          data-testid="button-logout"
        >
          Sign out
        </button>
      </div>
    </CreatorShell>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-card border border-border rounded-2xl text-center">
      <div className="text-xl font-black" style={{ color: "#6ea0ff" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">{label}</div>
    </div>
  );
}

function MenuRow({ icon, label, href, last }: { icon: string; label: string; href: string; last?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 hover-elevate",
        !last && "border-b border-border"
      )}
    >
      <Icon name={icon} filled className="text-[20px] text-muted-foreground" />
      <span className="flex-1 font-semibold text-sm">{label}</span>
      <Icon name="chevron_right" className="text-muted-foreground" />
    </Link>
  );
}
