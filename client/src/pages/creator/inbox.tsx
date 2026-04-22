import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CreatorShell,
  CreatorHeader,
  HeaderAvatar,
  HeaderIconButton,
} from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MessageThread, Brand, Campaign } from "@shared/schema";

type ThreadWithRefs = MessageThread & { brand: Brand | null; campaign: Campaign | null };

export default function InboxPage() {
  const { user } = useAuth();
  const { data } = useQuery<{ threads: ThreadWithRefs[] }>({
    queryKey: ["/api/threads"],
  });

  const threads = data?.threads || [];
  const sorted = [...threads].sort(
    (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );

  return (
    <CreatorShell>
      <CreatorHeader
        title="Inbox"
        subtitle="Your brand conversations"
        leading={<HeaderAvatar src={user?.avatar_url} />}
        trailing={
          <HeaderIconButton
            icon="edit"
            href="/new-message"
            label="New message"
            testId="link-new-message"
          />
        }
      />

      <div className="px-5 pt-1 pb-4 space-y-1">
        {sorted.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center mt-6">
            <Icon name="forum" className="text-[40px] text-muted-foreground mb-2" />
            <div className="font-bold mb-1">No conversations yet</div>
            <p className="text-sm text-muted-foreground">
              Once brands accept your applications, chats start here.
            </p>
          </div>
        ) : (
          sorted.map((t) => <ThreadRow key={t.id} thread={t} />)
        )}
      </div>
    </CreatorShell>
  );
}

function ThreadRow({ thread }: { thread: ThreadWithRefs }) {
  const brand = thread.brand;
  return (
    <Link
      href={`/chat/${thread.id}`}
      className="flex items-center gap-3 p-3 rounded-2xl hover-elevate"
      data-testid={`row-thread-${thread.id}`}
    >
      <div className="relative shrink-0">
        <div className="size-14 rounded-full bg-card border border-border overflow-hidden p-2">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-bold">
              {brand?.name?.[0] || "?"}
            </div>
          )}
        </div>
        {thread.brand_online && (
          <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-extrabold truncate">{brand?.name || "Brand"}</span>
          {brand?.verified && <Icon name="verified" filled className="text-[14px] text-primary" />}
        </div>
        {thread.status_label && (
          <div className="text-[10px] uppercase tracking-widest text-primary font-bold mb-0.5">
            {thread.status_label}
          </div>
        )}
        <div className={cn(
          "text-sm truncate",
          thread.unread_count > 0 ? "text-foreground font-semibold" : "text-muted-foreground"
        )}>
          {thread.last_message_preview}
        </div>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1">
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {timeAgo(thread.last_message_at)}
        </span>
        {thread.unread_count > 0 && (
          <span className="min-w-5 h-5 px-1.5 bg-primary text-primary-foreground rounded-full text-[10px] font-bold flex items-center justify-center">
            {thread.unread_count}
          </span>
        )}
      </div>
    </Link>
  );
}
