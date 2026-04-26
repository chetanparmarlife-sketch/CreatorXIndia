import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { timeAgo } from "@/lib/format";
import { useBrandContext } from "@/hooks/useBrandContext";

type BrandThreadRow = {
  id: string;
  campaign_id: string | null;
  brand_id: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
  last_message_preview: string;
  last_message_at: string;
  unread_count: number;
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

function truncatePreview(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}...`;
}

export default function BrandInboxPage() {
  const [, navigate] = useLocation();
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `s/${brandId}` : "";
  const { data, isLoading } = useQuery<{ threads: BrandThreadRow[] }>({
    queryKey: ["brand", brandId, "threads"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/threads");
      return res.json() as Promise<{ threads: BrandThreadRow[] }>;
    },
  });

  const threads = data?.threads ?? [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">Conversations with creators</p>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading threads...
          </div>
        )}

        {!isLoading && threads.length === 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No conversations yet.
          </div>
        )}

        <div className="space-y-3">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => navigate(`${brandBasePath}/messages/${thread.id}`)}
              className="w-full rounded-2xl border border-border bg-card p-4 text-left hover:bg-muted/40"
              data-testid={`thread-row-${thread.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <img
                    src={thread.creator?.avatar_url || ""}
                    alt=""
                    className="h-12 w-12 rounded-full bg-muted object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {thread.creator?.display_name ?? "Creator"}
                    </div>
                    {thread.campaign && (
                      <div className="truncate text-xs text-muted-foreground">{thread.campaign.title}</div>
                    )}
                    <div className="mt-1 truncate text-sm text-muted-foreground">
                      {truncatePreview(thread.last_message_preview)}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{timeAgo(thread.last_message_at)}</span>
                  {thread.unread_count > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
