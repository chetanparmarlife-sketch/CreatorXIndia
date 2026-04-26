import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreatorShell, CreatorSubHeader } from "@/components/creator-shell";
import { Icon } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import type { Brand } from "@creatorx/schema";

export default function NewMessagePage() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  const { data } = useQuery<{ brands: Brand[] }>({
    queryKey: ["/api/brands"],
  });

  const brands = (data?.brands || []).filter((b) => {
    if (!query) return true;
    return b.name.toLowerCase().includes(query.toLowerCase());
  });

  const startMut = useMutation({
    mutationFn: async (brandId: string) => {
      const res = await apiRequest("POST", "/api/threads/new", { brand_id: brandId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
      setLocation(`/inbox/${data.thread.id}`);
    },
  });

  return (
    <CreatorShell>
      <CreatorSubHeader
        title="New message"
        subtitle="Start a conversation with a brand"
        backHref="/inbox"
      />

      <div className="px-5 pt-1">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]" />
          <Input
            placeholder="Search brands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 pl-10 bg-card border-border rounded-2xl"
            data-testid="input-search-brands"
          />
        </div>
      </div>

      <div className="px-5 pt-3 pb-4 space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold py-2">
          {brands.length} brand{brands.length === 1 ? "" : "s"}
        </div>
        {brands.map((b) => (
          <button
            key={b.id}
            onClick={() => startMut.mutate(b.id)}
            disabled={startMut.isPending}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-2xl hover-elevate text-left disabled:opacity-50",
            )}
            data-testid={`button-brand-${b.id}`}
          >
            <div className="size-12 rounded-full bg-card border border-border p-1.5 shrink-0">
              {b.logo_url ? (
                <img src={b.logo_url} alt="" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-sm">
                  {b.name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold truncate">{b.name}</span>
                {b.verified && <Icon name="verified" filled className="text-[14px] text-primary" />}
              </div>
              <div className="text-xs text-muted-foreground truncate">{b.industry}</div>
            </div>
            <Icon name="chevron_right" className="text-muted-foreground" />
          </button>
        ))}
      </div>
    </CreatorShell>
  );
}
