import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Icon } from "@/components/brand";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { SocialAccount } from "@creatorx/schema";
import { fmtCompact } from "@/lib/format";

const PLATFORMS = [
  { key: "instagram", name: "Instagram", color: "bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888]", icon: "photo_camera", placeholder: "yourhandle", exampleFollowers: "25000" },
  { key: "youtube", name: "YouTube", color: "bg-red-600", icon: "play_arrow", placeholder: "@YourChannel", exampleFollowers: "10000" },
  { key: "twitter", name: "Twitter / X", color: "bg-sky-500", icon: "alternate_email", placeholder: "yourhandle", exampleFollowers: "5000" },
  { key: "linkedin", name: "LinkedIn", color: "bg-[#0a66c2]", icon: "work", placeholder: "your-name", exampleFollowers: "3000" },
] as const;

type PlatformKey = typeof PLATFORMS[number]["key"];

export default function ConnectSocialsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [dialogPlatform, setDialogPlatform] = useState<PlatformKey | null>(null);
  const [handle, setHandle] = useState("");
  const [followers, setFollowers] = useState("");
  const [engagement, setEngagement] = useState("");

  const { data } = useQuery<{ socials: SocialAccount[] }>({
    queryKey: ["/api/socials"],
  });

  const connectMutation = useMutation({
    mutationFn: async (payload: { platform: string; handle: string; followers: number; engagement_rate?: number }) => {
      const res = await apiRequest("POST", "/api/socials/connect", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/socials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setDialogPlatform(null);
      setHandle("");
      setFollowers("");
      setEngagement("");
      toast({ title: "Account linked", description: "We've queued it for verification." });
    },
    onError: (e: any) => toast({ title: "Couldn't link", description: e?.message || "Try again", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, connected }: { id: string; connected: boolean }) => {
      const res = await apiRequest("POST", `/api/socials/${id}/toggle`, { connected });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/socials"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const socials = data?.socials || [];
  const anyConnected = socials.some((s) => s.connected);

  const getSocial = (platform: string) => socials.find((s) => s.platform === platform);

  function openDialog(platform: PlatformKey) {
    const existing = getSocial(platform);
    setDialogPlatform(platform);
    setHandle(existing?.handle || "");
    setFollowers(existing?.followers ? String(existing.followers) : "");
    setEngagement(existing?.engagement_rate ? String(existing.engagement_rate) : "");
  }

  function submit() {
    if (!dialogPlatform) return;
    const cleaned = handle.trim().replace(/^@/, "");
    const f = Number(followers.replace(/[,_\s]/g, ""));
    const e = engagement ? Number(engagement) : undefined;
    if (!cleaned) return toast({ title: "Enter your handle", variant: "destructive" });
    if (!Number.isFinite(f) || f < 100) return toast({ title: "Enter your follower count (min 100)", variant: "destructive" });
    if (e !== undefined && (!Number.isFinite(e) || e < 0 || e > 100)) return toast({ title: "Engagement rate should be 0-100%", variant: "destructive" });
    connectMutation.mutate({ platform: dialogPlatform, handle: cleaned, followers: f, engagement_rate: e });
  }

  const dlgMeta = PLATFORMS.find((p) => p.key === dialogPlatform);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-6 pt-6 pb-6">
        <div className="flex items-center justify-between mb-8 pt-4">
          <button
            onClick={() => window.history.back()}
            className="size-10 rounded-full bg-card hover-elevate flex items-center justify-center"
            data-testid="button-back"
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="h-1.5 w-8 rounded-full bg-primary" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          </div>
          <button
            onClick={() => navigate("/auth/niches")}
            className="text-sm text-muted-foreground hover:text-foreground"
            data-testid="link-skip"
          >
            Skip
          </button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Link your profiles</h1>
          <p className="text-muted-foreground leading-relaxed">
            Add your handle and reach. Our team verifies these before you get access to higher-tier campaigns.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {PLATFORMS.map((p) => {
            const social = getSocial(p.key);
            const connected = social?.connected;
            return (
              <div
                key={p.key}
                className={cn(
                  "flex items-center gap-3 bg-card rounded-2xl px-4 py-4 border transition-all",
                  connected ? "border-primary" : "border-border"
                )}
                data-testid={`row-social-${p.key}`}
              >
                <div className={cn("size-12 rounded-xl flex items-center justify-center flex-shrink-0 relative", p.color)}>
                  <Icon name={p.icon} filled className="text-white text-[24px]" />
                  {connected && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-green-500 border-2 border-card flex items-center justify-center">
                      <Icon name="check" className="text-white text-[10px]" />
                    </span>
                  )}
                  {social?.verified && (
                    <span className="absolute -top-1 -right-1 size-4 rounded-full bg-blue-500 border-2 border-card flex items-center justify-center" title="Admin verified">
                      <Icon name="verified" className="text-white text-[10px]" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold flex items-center gap-1.5">
                    {p.name}
                    {social?.verified && <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500">Verified</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {connected && social
                      ? `@${social.handle} \u2022 ${fmtCompact(social.followers)} followers${social.engagement_rate ? ` \u2022 ${social.engagement_rate}% ER` : ""}`
                      : "Not connected"}
                  </div>
                </div>
                {connected ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openDialog(p.key)}
                      className="size-8 rounded-full bg-muted hover-elevate flex items-center justify-center"
                      data-testid={`button-edit-${p.key}`}
                      title="Edit"
                    >
                      <Icon name="edit" className="text-[16px]" />
                    </button>
                    <button
                      onClick={() => toggleMutation.mutate({ id: social!.id, connected: false })}
                      className="size-8 rounded-full bg-muted hover-elevate flex items-center justify-center"
                      data-testid={`button-disconnect-${p.key}`}
                      title="Disconnect"
                    >
                      <Icon name="close" className="text-[18px]" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => openDialog(p.key)}
                    data-testid={`button-connect-${p.key}`}
                    className="rounded-full font-semibold"
                    size="sm"
                  >
                    Connect
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mb-4 mt-auto">
          Our team verifies handles within 24 hours. Inflated numbers will be rejected.
        </p>

        <Button
          size="lg"
          className="w-full h-14 rounded-full font-semibold glow-primary"
          onClick={() => {
            if (!anyConnected) {
              toast({
                title: "Connect at least one account",
                description: "You'll need it to match with campaigns.",
                variant: "destructive",
              });
              return;
            }
            navigate("/auth/niches");
          }}
          data-testid="button-continue"
        >
          Continue
        </Button>
      </div>

      <Dialog open={!!dialogPlatform} onOpenChange={(v) => !v && setDialogPlatform(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Link {dlgMeta?.name}</DialogTitle>
            <DialogDescription>
              Enter your handle and current follower count. We'll verify these before approving high-ticket campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Handle</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
                  placeholder={dlgMeta?.placeholder || "yourhandle"}
                  className="pl-7"
                  data-testid="input-handle"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Follower / subscriber count</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                placeholder={dlgMeta?.exampleFollowers || "25000"}
                className="mt-1"
                data-testid="input-followers"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg engagement rate (%)  <span className="text-[10px] normal-case opacity-60">optional</span></Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={engagement}
                onChange={(e) => setEngagement(e.target.value)}
                placeholder="e.g. 3.5"
                className="mt-1"
                data-testid="input-engagement"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogPlatform(null)}>Cancel</Button>
            <Button onClick={submit} disabled={connectMutation.isPending} data-testid="button-save-handle">
              {connectMutation.isPending ? "Saving\u2026" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
