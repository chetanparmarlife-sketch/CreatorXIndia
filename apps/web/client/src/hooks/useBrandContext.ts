import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { getActingBrandIdFromLocation, setActingBrandBridge } from "@/lib/queryClient";

export function useBrandContext(): { brandId: string; isImpersonating: boolean; isAdmin: boolean } {
  const [location] = useLocation();
  const { user } = useAuth();

  const context = useMemo(() => {
    const adminMatch = location.match(/^\/admin\/brands\/([^/]+)(?:\/|$)/);
    if (adminMatch?.[1]) {
      return {
        brandId: decodeURIComponent(adminMatch[1]),
        isImpersonating: false,
        isAdmin: true,
      };
    }

    return {
      brandId: user?.id ?? "",
      isImpersonating: false,
      isAdmin: false,
    };
  }, [location, user?.id]);

  useEffect(() => {
    setActingBrandBridge({
      getActingBrandId: () => (context.isAdmin ? context.brandId : null),
    });

    return () => {
      setActingBrandBridge({ getActingBrandId: getActingBrandIdFromLocation });
    };
  }, [context.brandId, context.isAdmin]);

  return context;
}
