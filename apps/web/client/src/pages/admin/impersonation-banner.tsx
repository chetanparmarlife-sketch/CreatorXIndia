import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Brand } from "@creatorx/schema";
import { Button } from "@/components/ui/button";

function currentBrandId(path: string): string | null {
  const match = path.match(/^\/admin\/brands\/([^/]+)(?:\/|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function ImpersonationBanner() {
  const [location, navigate] = useLocation();
  const brandId = currentBrandId(location);

  const { data } = useQuery<{ brands: Brand[] }>({
    queryKey: ["/api/admin/brands"],
    enabled: Boolean(brandId),
  });

  const companyName = useMemo(() => {
    const brand = data?.brands.find((item) => item.id === brandId);
    return brand?.name ?? "this brand";
  }, [brandId, data?.brands]);

  if (!brandId) return null;

  return (
    <div
      className="mb-4 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
      data-testid="impersonation-banner"
    >
      <span className="font-semibold">You are viewing as {companyName} (admin mode)</span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/admin/brands")}
        data-testid="btn-exit-impersonation"
      >
        Exit
      </Button>
    </div>
  );
}
