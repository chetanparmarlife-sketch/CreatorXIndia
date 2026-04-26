import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtMoney } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { Brand } from "@creatorx/schema";

type AdminBrand = Brand & {
  status?: "pending" | "approved" | "rejected";
};

function statusForBrand(brand: AdminBrand): "pending" | "approved" | "rejected" {
  if (brand.status === "approved" || brand.status === "rejected" || brand.status === "pending") {
    return brand.status;
  }
  return brand.verified ? "approved" : "pending";
}

export default function AdminBrandsPage() {
  const { toast } = useToast();
  const [q, setQ] = useState("");

  const { data } = useQuery<{ brands: AdminBrand[] }>({ queryKey: ["/api/admin/brands"] });

  const statusMutation = useMutation({
    mutationFn: async ({ brandId, status }: { brandId: string; status: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/admin/brands/${brandId}/status`, { status });
      return res.json() as Promise<{ brand: AdminBrand }>;
    },
    onSuccess: async (_data, variables) => {
      toast({ title: variables.status === "approved" ? "Brand approved" : "Brand rejected" });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/brands"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not update brand";
      toast({ title: "Brand status update failed", description: message, variant: "destructive" });
    },
  });

  const brands = useMemo(() => {
    const allBrands = data?.brands ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return allBrands;
    return allBrands.filter((brand) =>
      brand.name.toLowerCase().includes(query) || brand.industry.toLowerCase().includes(query),
    );
  }, [data?.brands, q]);

  return (
    <AdminShell title="Brands" subtitle={`${brands.length} brand${brands.length === 1 ? "" : "s"}`}>
      <div className="mb-5 max-w-md">
        <div className="relative">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]" />
          <Input
            placeholder="Search brands..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="h-11 pl-10 bg-card border-border rounded-xl"
            data-testid="input-search-brands"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Wallet</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => {
              const status = statusForBrand(brand);
              return (
                <tr key={brand.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-background p-1.5 shrink-0">
                        {brand.logo_url ? (
                          <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-bold text-primary">
                            {brand.name[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold truncate">{brand.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{brand.contact_email ?? "No contact email"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{brand.industry}</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">{status}</span>
                  </td>
                  <td className="px-4 py-4 font-semibold">{fmtMoney(brand.wallet_balance_paise)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <Link href={`/brands/${brand.id}/dashboard`}>
                        <Button variant="outline" size="sm" data-testid={`btn-view-brand-${brand.id}`}>
                          View as Brand
                        </Button>
                      </Link>
                      {status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => statusMutation.mutate({ brandId: brand.id, status: "approved" })}
                            disabled={statusMutation.isPending}
                            data-testid={`btn-approve-brand-${brand.id}`}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => statusMutation.mutate({ brandId: brand.id, status: "rejected" })}
                            disabled={statusMutation.isPending}
                            data-testid={`btn-reject-brand-${brand.id}`}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
