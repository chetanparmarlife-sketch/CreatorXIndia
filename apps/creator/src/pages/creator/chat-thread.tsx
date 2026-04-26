import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Message, MessageThread, Brand, Campaign } from "@creatorx/schema";

type ThreadDetail = {
  thread: MessageThread & { brand: Brand | null; campaign: Campaign | null };
  messages: Message[];
};

export default function ChatThreadPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<ThreadDetail>({
    queryKey: ["/api/threads", params.id],
    refetchInterval: 6000,
  });

  // Mark as read on mount
  useEffect(() => {
    if (params.id) {
      apiRequest("POST", `/api/threads/${params.id}/read`).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
    }
  }, [params.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages?.length]);

  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/threads/${params.id}/send`, { body });
      return await res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/threads", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });

  if (!data) {
    return (
      <CreatorShell>
        <div className="h-[60vh] flex items-center justify-center">
          <Icon name="progress_activity" className="animate-spin text-[28px] text-muted-foreground" />
        </div>
      </CreatorShell>
    );
  }

  const { thread, messages } = data;
  const brand = thread.brand;

  return (
    <CreatorShell>
      {/* Chat header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setLocation("/inbox")}
          className="size-10 rounded-full hover-elevate flex items-center justify-center"
          data-testid="button-back"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </button>
        <div className="relative shrink-0">
          <div className="size-10 rounded-full bg-card border border-border overflow-hidden p-1.5">
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                {brand?.name?.[0] || "?"}
              </div>
            )}
          </div>
          {thread.brand_online && (
            <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold truncate flex items-center gap-1">
            {brand?.name}
            {brand?.verified && <Icon name="verified" filled className="text-[14px] text-primary" />}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {thread.brand_online ? "Online now" : "Replies in a few hours"}
          </div>
        </div>
        <button className="size-10 rounded-full hover-elevate flex items-center justify-center">
          <Icon name="info" className="text-[20px]" />
        </button>
      </header>

      {/* Campaign banner */}
      {thread.campaign && (
        <Link
          href={`/campaigns/${thread.campaign.id}`}
          className="mx-4 mt-3 p-3 bg-card border border-border rounded-2xl flex items-center gap-3 hover-elevate"
        >
          {thread.campaign.cover_image_url && (
            <img src={thread.campaign.cover_image_url} alt="" className="size-10 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {thread.status_label || "Campaign"}
            </div>
            <div className="font-bold text-sm truncate">{thread.campaign.title}</div>
          </div>
          <Icon name="chevron_right" className="text-muted-foreground" />
        </Link>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="px-4 pt-4 space-y-3 overflow-y-auto" style={{ height: "calc(100vh - 250px)" }}>
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} isMe={m.sender_id === user?.id} />
        ))}
      </div>

      {/* Composer */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 max-w-[480px] w-full px-3 py-3 bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-end gap-2">
          <button className="size-10 rounded-full bg-card hover-elevate flex items-center justify-center shrink-0">
            <Icon name="add" className="text-[20px]" />
          </button>
          <div className="flex-1 bg-card border border-border rounded-2xl flex items-end px-3 py-1.5 min-h-10">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) sendMut.mutate(input.trim());
                }
              }}
              rows={1}
              placeholder="Message"
              className="flex-1 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground py-1.5 max-h-24"
              data-testid="input-message"
            />
          </div>
          <button
            onClick={() => input.trim() && sendMut.mutate(input.trim())}
            disabled={!input.trim() || sendMut.isPending}
            className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-40 glow-primary"
            data-testid="button-send"
          >
            <Icon name="arrow_upward" className="text-[20px]" />
          </button>
        </div>
      </div>
    </CreatorShell>
  );
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  if (message.sender_role === "system") {
    return (
      <div className="flex justify-center py-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold bg-card border border-border rounded-full px-3 py-1">
          {message.body}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border rounded-bl-md"
        )}
      >
        {message.attachment_url && message.attachment_kind === "image" && (
          <img src={message.attachment_url} alt="" className="rounded-xl mb-2 max-w-full" />
        )}
        {message.attachment_url && message.attachment_kind === "file" && (
          <div className={cn("flex items-center gap-2 mb-2 p-2 rounded-xl", isMe ? "bg-white/15" : "bg-muted")}>
            <Icon name="description" className="text-[20px]" />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{message.attachment_name}</div>
              <div className="text-[10px] opacity-70">{message.attachment_size}</div>
            </div>
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.body}</div>
      </div>
    </div>
  );
}
