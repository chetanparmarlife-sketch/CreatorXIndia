import { useQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/brand";
import { timeAgo, fmtDate } from "@/lib/format";
import type { AuditLog, Profile } from "@shared/schema";

type Enriched = AuditLog & { admin: Profile | null };

const ACTION_ICONS: Record<string, string> = {
  create_campaign: "add_circle",
  update_campaign: "edit",
  delete_campaign: "delete",
  create_brand: "add_business",
  update_brand: "edit",
  delete_brand: "delete",
  decide_application: "fact_check",
  decide_deliverable: "movie",
  decide_payout: "payments",
  verify_creator: "verified",
  suspend_creator: "block",
  create_community: "event",
  update_community: "edit",
  delete_community: "delete",
  reset_database: "restart_alt",
};

export default function AdminAuditPage() {
  const { data } = useQuery<{ audit: Enriched[] }>({ queryKey: ["/api/admin/audit"] });

  const rows = data?.audit || [];
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <AdminShell title="Audit log" subtitle={`${rows.length} entries`}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {sorted.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No audit events yet</div>
        ) : (
          sorted.map((a) => (
            <div key={a.id} className="flex items-start gap-3 px-5 py-4 border-b border-border last:border-b-0">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon name={ACTION_ICONS[a.action] || "history"} filled className="text-[16px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm">
                  <span className="font-bold">{a.admin?.full_name || "Admin"}</span>
                  <span className="text-muted-foreground"> performed </span>
                  <span className="font-mono text-primary text-xs bg-primary/10 rounded px-1.5 py-0.5">{a.action}</span>
                  <span className="text-muted-foreground"> on </span>
                  <span className="font-semibold">{a.entity_kind}</span>
                  <span className="text-muted-foreground font-mono text-xs"> #{a.entity_id.slice(-6)}</span>
                </div>
                {a.details && (
                  <pre className="text-[10px] text-muted-foreground font-mono mt-1 truncate">{a.details}</pre>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0 text-right">
                <div>{timeAgo(a.created_at)}</div>
                <div className="text-[10px]">{fmtDate(a.created_at)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}
