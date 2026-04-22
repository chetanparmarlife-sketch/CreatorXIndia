import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fmtCompact } from "@/lib/format";
import type { SocialAccount, Profile } from "@shared/schema";

type Enriched = SocialAccount & { creator: Profile };

export default function AdminHandlesPage() {
  const { toast } = useToast();

  const { data } = useQuery<{ handles: Enriched[] }>({
    queryKey: ["/api/admin/handle-verifications"],
  });

  const verifyMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) =>
      apiRequest("POST", `/api/admin/handles/${id}/verify`, { note }),
    onSuccess: () => {
      toast({ title: "Handle verified" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/handle-verifications"] });
    },
  });

  const handles = data?.handles || [];

  return (
    <AdminShell title="Handle verifications" subtitle={`${handles.length} pending · verify each social handle matches the real account`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_140px] gap-3 px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border-b border-border">
          <div>Creator</div>
          <div>Platform</div>
          <div>Handle</div>
          <div>Declared reach</div>
          <div className="text-right">Action</div>
        </div>
        {handles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No pending verifications</div>
        ) : (
          handles.map((h) => (
            <div key={h.id} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_140px] gap-3 px-5 py-3 items-center border-b border-border last:border-b-0" data-testid={`row-handle-${h.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <img src={h.creator?.avatar_url || ""} alt="" className="size-9 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{h.creator?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">@{h.creator?.handle}</div>
                </div>
              </div>
              <div className="text-xs uppercase tracking-widest font-bold">{h.platform}</div>
              <div className="text-xs font-mono truncate">@{h.handle}</div>
              <div className="text-xs">
                {fmtCompact(h.followers)} followers · {h.engagement_rate.toFixed(1)}% ER
              </div>
              <div className="flex items-center justify-end gap-1">
                <a href={platformUrl(h.platform, h.handle)} target="_blank" rel="noreferrer" className="h-8 px-3 rounded-lg bg-card border border-border text-xs font-bold hover-elevate inline-flex items-center gap-1" data-testid={`link-view-${h.id}`}>
                  <Icon name="open_in_new" className="text-[14px]" /> View
                </a>
                <button onClick={() => verifyMut.mutate({ id: h.id })} className="h-8 px-3 rounded-lg bg-primary/15 text-primary text-xs font-bold hover-elevate" data-testid={`button-verify-${h.id}`}>Verify</button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

function platformUrl(platform: string, handle: string) {
  const h = handle.replace(/^@/, "");
  switch (platform) {
    case "instagram": return `https://instagram.com/${h}`;
    case "youtube": return `https://youtube.com/@${h}`;
    case "twitter": return `https://x.com/${h}`;
    case "linkedin": return `https://linkedin.com/in/${h}`;
    default: return "#";
  }
}
