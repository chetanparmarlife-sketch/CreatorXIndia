import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { fmtDate } from "@/lib/format";
import type { AuditLog } from "@creatorx/schema";

type AuditFilters = {
  actor: string;
  action: string;
  targetType: string;
  from: string;
  to: string;
};

type AuditLogResponse = {
  rows: AuditLog[];
  nextCursor: string | null;
};

const TARGET_TYPES = ["", "brand", "campaign", "application", "deliverable", "wallet_transaction", "auth", "profile", "withdrawal"];

export default function AdminAuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ actor: "", action: "", targetType: "", from: "", to: "" });
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(filters);
  const [cursor, setCursor] = useState<string>("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.actor.trim()) params.set("actor", appliedFilters.actor.trim());
    if (appliedFilters.action.trim()) params.set("action", appliedFilters.action.trim());
    if (appliedFilters.targetType) params.set("targetType", appliedFilters.targetType);
    if (appliedFilters.from) params.set("from", appliedFilters.from);
    if (appliedFilters.to) params.set("to", appliedFilters.to);
    if (cursor) params.set("cursor", cursor);
    params.set("limit", "50");
    return params.toString();
  }, [appliedFilters, cursor]);

  const { data, isLoading } = useQuery<AuditLogResponse>({
    queryKey: ["/api/admin/audit-log", queryString],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/audit-log?${queryString}`);
      return res.json() as Promise<AuditLogResponse>;
    },
  });

  function applyFilters() {
    setCursor("");
    setAppliedFilters(filters);
  }

  const rows = data?.rows ?? [];

  return (
    <AdminShell title="Audit log" subtitle="Filter and inspect platform activity">
      <section className="mb-5 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-6">
          <Input
            value={filters.actor}
            onChange={(event) => setFilters((current) => ({ ...current, actor: event.target.value }))}
            placeholder="Actor user ID"
            data-testid="filter-actor_user_id"
          />
          <Input
            value={filters.action}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
            placeholder="Action"
            data-testid="filter-action"
          />
          <select
            value={filters.targetType}
            onChange={(event) => setFilters((current) => ({ ...current, targetType: event.target.value }))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            data-testid="filter-target_type"
          >
            {TARGET_TYPES.map((targetType) => (
              <option key={targetType || "all"} value={targetType}>{targetType || "All targets"}</option>
            ))}
          </select>
          <Input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
            data-testid="filter-from"
          />
          <Input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            data-testid="filter-to"
          />
          <Button type="button" onClick={applyFilters} data-testid="btn-apply-audit-filters">Apply</Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target type</th>
              <th className="px-4 py-3">Target ID</th>
              <th className="px-4 py-3">Acting as brand</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Loading audit log...</td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No audit rows match.</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0" data-testid={`audit-row-${row.id}`}>
                <td className="px-4 py-4 text-muted-foreground">{fmtDate(row.created_at, "long")}</td>
                <td className="px-4 py-4 font-mono text-xs">{row.actor_user_id ?? row.admin_id}</td>
                <td className="px-4 py-4 font-semibold">{row.action}</td>
                <td className="px-4 py-4">{row.target_type ?? row.entity_kind}</td>
                <td className="px-4 py-4 font-mono text-xs">{row.target_id ?? row.entity_id}</td>
                <td className="px-4 py-4 font-mono text-xs">{row.acting_as_brand_id ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={!data?.nextCursor}
          onClick={() => data?.nextCursor && setCursor(data.nextCursor)}
          data-testid="btn-load-more-audit"
        >
          Load More
        </Button>
      </div>
    </AdminShell>
  );
}
