import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { getActingBrandIdFromLocation, setActingBrandBridge } from "@/lib/queryClient";

export function useBrandContext(): { brandId: string; isImpersonating: boolean; isAdmin: boolean } {
  const { user } = useAuth();

  const context = useMemo(() => {
    return {
      brandId: user?.id ?? "",
      isImpersonating: false,
      isAdmin: false,
    };
  }, [user?.id]);

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
