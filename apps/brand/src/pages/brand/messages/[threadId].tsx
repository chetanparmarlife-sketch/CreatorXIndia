import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type BrandThreadData = {
  thread: {
    id: string;
    campaign_id: string | null;
    brand_id: string;
    creator_id: string;
    created_at: string;
    updated_at: string;
    creator: {
      id: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
    campaign: {
      id: string;
      title: string;
    } | null;
  };
  messages: Array<{
    id: string;
    thread_id: string;
    sender_id: string;
    sender_role: "creator" | "brand" | "system";
    body: string;
    attachment_url: string | null;
    attachment_kind: "image" | "video" | "file" | null;
    attachment_name: string | null;
    attachment_size: string | null;
    read: boolean;
    read_at: string | null;
    created_at: string;
  }>;
};

export default function BrandThreadPage() {
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/brands/${brandId}` : "";
  const [brandMatched, brandParams] = useRoute<{ threadId: string }>("/messages/:threadId");
  const [adminMatched, adminParams] = useRoute<{ brandId: string; threadId: string }>("/brands/:brandId/messages/:threadId");
  const matched = brandMatched || adminMatched;
  const { toast } = useToast();
  const threadId = brandParams?.threadId ?? adminParams?.threadId ?? "";
  const [inputValue, setInputValue] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const threadQuery = useQuery<BrandThreadData>({
    queryKey: ["brand", brandId, "threads", threadId, "messages"],
    enabled: matched && threadId.length > 0,
    refetchInterval: 10_000,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/brand/threads/${threadId}/messages`);
      return res.json() as Promise<BrandThreadData>;
    },
  });

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [threadQuery.data?.messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await apiRequest("POST", `/api/brand/threads/${threadId}/messages`, { body });
      return res.json() as Promise<{ message: { id: string } }>;
    },
    onSuccess: async () => {
      setInputValue("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "threads"] }),
        queryClient.invalidateQueries({ queryKey: ["brand", brandId, "threads", threadId, "messages"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not send message";
      toast({ title: "Message failed", description: message, variant: "destructive" });
    },
  });

  if (!matched) return null;

  if (threadQuery.isLoading || !threadQuery.data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {threadQuery.isError ? "Could not load thread." : "Loading thread..."}
        </div>
      </div>
    );
  }

  const { thread, messages } = threadQuery.data;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Link href={`${brandBasePath}/inbox`} className="text-sm text-primary underline" data-testid="link-back-to-inbox">
            Back to inbox
          </Link>

          <div className="mt-3 flex items-center gap-3">
            <img
              src={thread.creator?.avatar_url || ""}
              alt=""
              className="h-12 w-12 rounded-full bg-muted object-cover"
            />
            <div className="min-w-0">
              <div className="truncate font-semibold">{thread.creator?.display_name ?? "Creator"}</div>
              {thread.campaign && (
                <div className="truncate text-xs text-muted-foreground">{thread.campaign.title}</div>
              )}
            </div>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="h-[60vh] space-y-3 overflow-y-auto rounded-2xl border border-border bg-card p-4"
        >
          {messages.map((message) => {
            const isBrandMessage = message.sender_role === "brand";
            return (
              <div
                key={message.id}
                className={cn("flex", isBrandMessage ? "justify-end" : "justify-start")}
                data-testid={`message-${message.id}`}
              >
                <div className={cn("max-w-[80%]", isBrandMessage ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2 text-sm",
                      isBrandMessage
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-muted text-foreground",
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.body}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{fmtDate(message.created_at, "long")}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  const trimmed = inputValue.trim();
                  if (trimmed.length > 0 && trimmed.length <= 2000) {
                    sendMutation.mutate(trimmed);
                  }
                }
              }}
              rows={2}
              placeholder="Write a message"
              className="min-h-12 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none"
              data-testid="input-message"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = inputValue.trim();
                if (trimmed.length > 0 && trimmed.length <= 2000) {
                  sendMutation.mutate(trimmed);
                }
              }}
              disabled={sendMutation.isPending || inputValue.trim().length === 0 || inputValue.trim().length > 2000}
              className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              data-testid="btn-send-message"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
