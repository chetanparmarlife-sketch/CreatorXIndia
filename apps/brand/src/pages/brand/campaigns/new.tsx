import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { INDIAN_NICHES } from "@creatorx/schema/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBrandContext } from "@/hooks/useBrandContext";

type Platform = "instagram" | "youtube" | "twitter" | "linkedin";
type DeliverableType = "post" | "reel" | "story" | "video";

const PLATFORM_OPTIONS: Platform[] = ["instagram", "youtube", "twitter", "linkedin"];
const DELIVERABLE_OPTIONS: DeliverableType[] = ["post", "reel", "story", "video"];

export default function NewCampaignPage() {
  const [, navigate] = useLocation();
  const { brandId, isAdmin } = useBrandContext();
  const brandBasePath = isAdmin ? `/brands/${brandId}` : "";
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [niche, setNiche] = useState<(typeof INDIAN_NICHES)[number]>(INDIAN_NICHES[0]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [deliverableType, setDeliverableType] = useState<DeliverableType>("post");
  const [budgetRupees, setBudgetRupees] = useState("");
  const [maxCreators, setMaxCreators] = useState("1");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [briefUrl, setBriefUrl] = useState("");

  const platformSet = useMemo(() => new Set(platforms), [platforms]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const rupees = Number(budgetRupees);
      const creatorsCount = Number(maxCreators);
      const budgetPaise = Math.round(rupees * 100);

      const res = await apiRequest("POST", "/api/brand/campaigns", {
        title,
        description,
        niche,
        platforms,
        deliverable_type: deliverableType,
        budget_paise: budgetPaise,
        max_creators: creatorsCount,
        application_deadline: applicationDeadline,
        brief_url: briefUrl || undefined,
      });

      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/brand/dashboard-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/brand/activity"] }),
      ]);
      navigate(`${brandBasePath}/campaigns`);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Could not create campaign";
      toast({ title: "Create campaign failed", description: message, variant: "destructive" });
    },
  });

  function togglePlatform(platform: Platform) {
    setPlatforms((current) => {
      if (current.includes(platform)) {
        return current.filter((item) => item !== platform);
      }
      return [...current, platform];
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const rupees = Number(budgetRupees);
    if (!Number.isFinite(rupees) || rupees < 500) {
      toast({ title: "Budget must be at least ₹500", variant: "destructive" });
      return;
    }

    if (platforms.length === 0) {
      toast({ title: "Select at least one platform", variant: "destructive" });
      return;
    }

    const deadlineDate = new Date(`${applicationDeadline}T00:00:00.000Z`);
    if (!applicationDeadline || Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      toast({ title: "Application deadline must be in the future", variant: "destructive" });
      return;
    }

    createMutation.mutate();
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-6">Create campaign</h1>

        <form className="space-y-5" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} data-testid="input-title" required />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              data-testid="input-description"
              required
            />
          </div>

          <div>
            <Label htmlFor="niche">Niche</Label>
            <select
              id="niche"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={niche}
              onChange={(event) => setNiche(event.target.value as (typeof INDIAN_NICHES)[number])}
              data-testid="input-niche"
            >
              {INDIAN_NICHES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Platforms</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {PLATFORM_OPTIONS.map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-sm rounded-md border border-border p-2">
                  <input
                    type="checkbox"
                    checked={platformSet.has(platform)}
                    onChange={() => togglePlatform(platform)}
                    data-testid={`input-platform-${platform}`}
                  />
                  <span className="capitalize">{platform}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="deliverable-type">Deliverable type</Label>
            <select
              id="deliverable-type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={deliverableType}
              onChange={(event) => setDeliverableType(event.target.value as DeliverableType)}
              data-testid="input-deliverable_type"
            >
              {DELIVERABLE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="budget">Budget (₹)</Label>
            <Input
              id="budget"
              type="number"
              min={500}
              value={budgetRupees}
              onChange={(event) => setBudgetRupees(event.target.value)}
              data-testid="input-budget_paise"
              required
            />
          </div>

          <div>
            <Label htmlFor="max-creators">Max creators</Label>
            <Input
              id="max-creators"
              type="number"
              min={1}
              value={maxCreators}
              onChange={(event) => setMaxCreators(event.target.value)}
              data-testid="input-max_creators"
              required
            />
          </div>

          <div>
            <Label htmlFor="application-deadline">Application deadline</Label>
            <Input
              id="application-deadline"
              type="date"
              value={applicationDeadline}
              onChange={(event) => setApplicationDeadline(event.target.value)}
              data-testid="input-application_deadline"
              required
            />
          </div>

          <div>
            <Label htmlFor="brief-url">Brief URL (optional)</Label>
            <Input
              id="brief-url"
              type="url"
              value={briefUrl}
              onChange={(event) => setBriefUrl(event.target.value)}
              data-testid="input-brief_url"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => navigate(`${brandBasePath}/dashboard`)} data-testid="btn-cancel-campaign">
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="btn-submit-campaign">
              {createMutation.isPending ? "Creating..." : "Create campaign"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
