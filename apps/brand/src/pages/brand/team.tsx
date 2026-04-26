import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useBrandContext } from "@/hooks/useBrandContext";

type TeamMember = {
  id: string;
  brand_id: string;
  user_id: string;
  role: "admin" | "member" | "viewer";
  invited_by: string;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

export default function BrandTeamPage() {
  const { brandId } = useBrandContext();
  const { user } = useAuth();
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");

  const teamQuery = useQuery<{ members: TeamMember[] }>({
    queryKey: ["brand", brandId, "team"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/brand/team");
      return res.json() as Promise<{ members: TeamMember[] }>;
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/brand/team/invite", {
        email: inviteEmail,
        role: inviteRole,
      });
      return res.json() as Promise<{ member: TeamMember }>;
    },
    onSuccess: async () => {
      setInviteEmail("");
      await queryClient.invalidateQueries({ queryKey: ["brand", brandId, "team"] });
      toast({ title: "Invite sent" });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not invite team member";
      toast({ title: "Invite failed", description: message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiRequest("DELETE", `/api/brand/team/${targetUserId}`);
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["brand", brandId, "team"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not remove team member";
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    },
  });

  const members = teamQuery.data?.members ?? [];
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [members],
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage members with access to this brand panel.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-xl font-semibold">Current Members</h2>

          {teamQuery.isLoading && <p className="text-sm text-muted-foreground">Loading members...</p>}

          {!teamQuery.isLoading && sortedMembers.length === 0 && (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          )}

          <div className="space-y-3">
            {sortedMembers.map((member) => {
              const isSelf = user?.id === member.user_id;
              return (
                <div
                  key={member.id}
                  className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_auto_auto]"
                  data-testid={`member-row-${member.user_id}`}
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={member.user?.avatar_url || ""}
                      alt=""
                      className="h-10 w-10 rounded-full bg-muted object-cover"
                    />
                    <div>
                      <div className="font-medium">{member.user?.full_name ?? "Unknown user"}</div>
                      <div className="text-xs text-muted-foreground">{member.user?.email ?? "No email"}</div>
                      <div className="text-xs text-muted-foreground">
                        Joined: {fmtDate(member.accepted_at ?? member.invited_at)}
                      </div>
                    </div>
                  </div>

                  <div className="self-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold capitalize">
                      {member.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(member.user_id)}
                    disabled={isSelf || removeMutation.isPending}
                    className="h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50"
                    data-testid={`btn-remove-${member.user_id}`}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-xl font-semibold">Invite Member</h2>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="member@company.com"
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
              data-testid="input-invite-email"
            />

            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "admin" | "member" | "viewer")}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none"
              data-testid="select-invite-role"
            >
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>

            <button
              type="button"
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail.trim() || inviteMutation.isPending}
              className="h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              data-testid="btn-send-invite"
            >
              Send Invite
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
