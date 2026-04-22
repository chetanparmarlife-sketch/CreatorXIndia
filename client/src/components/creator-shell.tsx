import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Icon } from "./brand";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

/**
 * Mobile-first app shell that centers content in a phone-sized column on
 * desktop (so the Stitch mobile designs translate 1:1) and fills the full
 * width below 768px.
 *
 * The shell reserves space for the fixed bottom nav (80px) via `pb-24`
 * on the inner container. Pages can opt out via `hideBottomNav` for
 * immersive flows (chat thread, campaign apply, onboarding).
 */
export function CreatorShell({
  children,
  hideBottomNav = false,
}: {
  children: ReactNode;
  padded?: boolean;
  hideBottomNav?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "mx-auto w-full max-w-[480px] min-h-screen bg-background relative md:border-x md:border-border",
          hideBottomNav ? "pb-0" : "pb-24"
        )}
      >
        {children}
        {!hideBottomNav && <CreatorBottomNav />}
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/discover", icon: "explore", label: "Discover" },
  { href: "/inbox", icon: "mail", label: "Inbox" },
  { href: "/earnings", icon: "payments", label: "Earnings" },
  { href: "/profile", icon: "person", label: "Profile" },
];

function CreatorBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: notifData } = useQuery<{ notifications: { read: boolean }[] }>({
    queryKey: ["/api/notifications"],
    enabled: !!user,
  });
  const unread = notifData?.notifications?.filter((n) => !n.read).length || 0;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 mx-auto max-w-[480px] bg-background/95 backdrop-blur-xl border-t border-border z-50"
      data-testid="nav-creator-bottom"
    >
      <div className="flex items-center justify-around pt-2 pb-3 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? location === "/" : location.startsWith(item.href);
          const badge = item.href === "/inbox" && unread > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors min-w-[48px]",
                "hover-elevate"
              )}
              data-testid={`link-nav-${item.label.toLowerCase()}`}
            >
              <div className="relative">
                <Icon
                  name={item.icon}
                  filled={active}
                  className={cn("text-[24px]", active ? "text-primary" : "text-muted-foreground")}
                />
                {badge && (
                  <span className="absolute -top-0.5 -right-1 size-2 bg-primary rounded-full ring-2 ring-background" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-semibold tracking-wide",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Primary top-level page header. Use on Home / Discover / Campaigns / Inbox /
 * Earnings / Profile — the five bottom-nav destinations plus their peers.
 *
 * Layout: title (left) / optional trailing icon buttons (right).
 * Subtitle sits directly under title.
 */
export function CreatorHeader({
  title,
  leading,
  trailing,
  subtitle,
  sticky = true,
}: {
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  subtitle?: ReactNode;
  sticky?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 px-5 pt-5 pb-3",
        sticky && "sticky top-0 z-40 bg-background/90 backdrop-blur-md"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {leading}
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="text-[22px] leading-tight font-extrabold tracking-tight truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {trailing && (
        <div className="flex items-center gap-2 flex-shrink-0">{trailing}</div>
      )}
    </header>
  );
}

/**
 * Sub-page header used inside a top-level destination (Settings sub-pages,
 * Withdraw, Notifications, Campaign detail, Chat thread, etc.).
 *
 * Layout: back chevron (left) + title/subtitle + optional trailing.
 * Back target defaults to browser history; callers can pass `backHref` to
 * route to a specific page.
 */
export function CreatorSubHeader({
  title,
  subtitle,
  trailing,
  backHref,
  onBack,
  sticky = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  backHref?: string;
  onBack?: () => void;
  sticky?: boolean;
}) {
  const handleBack = () => {
    if (onBack) return onBack();
    if (backHref) {
      window.location.hash = backHref;
      return;
    }
    window.history.back();
  };

  return (
    <header
      className={cn(
        "flex items-center gap-3 px-5 pt-5 pb-3",
        sticky && "sticky top-0 z-40 bg-background/90 backdrop-blur-md"
      )}
    >
      <button
        onClick={handleBack}
        className="size-10 -ml-2 rounded-full flex items-center justify-center hover-elevate shrink-0"
        data-testid="button-back"
        aria-label="Back"
      >
        <Icon name="arrow_back" className="text-[22px]" />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] leading-tight font-extrabold tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      {trailing && (
        <div className="flex items-center gap-2 shrink-0">{trailing}</div>
      )}
    </header>
  );
}

/**
 * Round icon button reused in headers (bell, settings gear, compose, etc.).
 * Keeps a consistent size + chrome across every top-level page.
 */
export function HeaderIconButton({
  icon,
  href,
  onClick,
  badge,
  label,
  testId,
}: {
  icon: string;
  href?: string;
  onClick?: () => void;
  badge?: boolean;
  label: string;
  testId?: string;
}) {
  const className =
    "relative size-10 rounded-full bg-card border border-border hover-elevate flex items-center justify-center shrink-0";
  const content = (
    <>
      <Icon name={icon} className="text-[20px]" />
      {badge && (
        <span className="absolute top-2 right-2.5 size-2 bg-primary rounded-full" />
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className} aria-label={label} data-testid={testId}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      aria-label={label}
      data-testid={testId}
    >
      {content}
    </button>
  );
}

/** Section heading with optional action (e.g. "View all"). */
export function SectionHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between mb-3", className)}>
      <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
      {action && <div className="text-sm text-primary font-semibold">{action}</div>}
    </div>
  );
}

/** Small avatar + status dot used in top-level headers. */
export function HeaderAvatar({
  src,
  href = "/profile",
  online = true,
}: {
  src?: string | null;
  href?: string;
  online?: boolean;
}) {
  if (!src) return null;
  return (
    <Link href={href} className="relative shrink-0" data-testid="link-header-avatar">
      <img
        src={src}
        alt=""
        className="size-10 rounded-full border-2 border-white/10 object-cover"
      />
      {online && (
        <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full border-2 border-background" />
      )}
    </Link>
  );
}
