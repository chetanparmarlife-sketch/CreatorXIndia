import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell, CreatorSubHeader } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Notification, NotificationKind } from "@creatorx/schema";

const ICON_MAP: Record<NotificationKind, { icon: string; color: string }> = {
  application_accepted: { icon: "check_circle", color: "text-green-400" },
  application_rejected: { icon: "cancel", color: "text-red-400" },
  deliverable_feedback: { icon: "edit_note", color: "text-orange-400" },
  deliverable_approved: { icon: "verified", color: "text-primary" },
  payment_received: { icon: "payments", color: "text-green-400" },
  withdrawal_paid: { icon: "account_balance", color: "text-primary" },
  new_message: { icon: "forum", color: "text-primary" },
  campaign_match: { icon: "bolt", color: "text-amber-400" },
  system: { icon: "notifications", color: "text-muted-foreground" },
};

export default function NotificationsPage() {
  const { data } = useQuery<{ notifications: Notification[] }>({
    queryKey: ["/api/notifications"],
  });

  const readAll = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const readOne = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const notifications = data?.notifications || [];
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const unread = sorted.filter((n) => !n.read).length;

  return (
    <CreatorShell>
      <CreatorSubHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : "All caught up"}
        trailing={
          unread > 0 ? (
            <button
              onClick={() => readAll.mutate()}
              className="text-sm font-bold text-primary hover-elevate px-3 py-1.5 rounded-lg"
              data-testid="button-read-all"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      <div className="px-5 pt-1 pb-4 space-y-2">
        {sorted.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center mt-6">
            <Icon name="notifications_off" className="text-[40px] text-muted-foreground mb-2" />
            <div className="font-bold">All caught up</div>
            <p className="text-sm text-muted-foreground">New activity will appear here.</p>
          </div>
        ) : (
          sorted.map((n) => {
            const meta = ICON_MAP[n.kind];
            const Row = (
              <div
                className={cn(
                  "flex items-start gap-3 p-3 rounded-2xl hover-elevate",
                  !n.read && "bg-primary/5 border border-primary/30"
                )}
              >
                <div className={cn(
                  "size-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0",
                  meta.color
                )}>
                  <Icon name={meta.icon} filled className="text-[20px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm">{n.title}</div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>
                </div>
                {!n.read && <div className="size-2 bg-primary rounded-full shrink-0 mt-2" />}
              </div>
            );
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => !n.read && readOne.mutate(n.id)}
                className="block"
                data-testid={`row-notification-${n.id}`}
              >
                {Row}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => !n.read && readOne.mutate(n.id)}
                className="w-full text-left"
                data-testid={`row-notification-${n.id}`}
              >
                {Row}
              </button>
            );
          })
        )}
      </div>
    </CreatorShell>
  );
}
