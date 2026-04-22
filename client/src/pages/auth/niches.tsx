import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/brand";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const NICHES = [
  { key: "Beauty", emoji: "\ud83d\udc84" },
  { key: "Tech", emoji: "\ud83d\udcbb" },
  { key: "Fashion", emoji: "\ud83d\udc57" },
  { key: "Lifestyle", emoji: "\u2728" },
  { key: "Food", emoji: "\ud83c\udf5c" },
  { key: "Fitness", emoji: "\ud83d\udcaa" },
  { key: "Travel", emoji: "\u2708\ufe0f" },
  { key: "Gaming", emoji: "\ud83c\udfae" },
  { key: "Home", emoji: "\ud83c\udfe0" },
  { key: "Parenting", emoji: "\ud83c\udf7c" },
  { key: "Finance", emoji: "\ud83d\udcb0" },
  { key: "Music", emoji: "\ud83c\udfb5" },
];

export default function NichesPage() {
  const [, navigate] = useLocation();
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggle(n: string) {
    setSelected((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n]));
  }

  async function finish() {
    if (selected.length === 0) {
      toast({ title: "Pick at least one niche", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("PATCH", "/api/profile", { niches: selected });
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      await refresh();
      toast({ title: "You're all set \ud83c\udf89" });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-6 pt-6 pb-6">
        {/* Progress */}
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
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="h-1.5 w-8 rounded-full bg-primary" />
          </div>
          <div className="w-10" />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">Pick your niches</h1>
          <p className="text-muted-foreground leading-relaxed">
            We'll use these to match you with the right campaigns. Pick as many as you like.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {NICHES.map((n) => {
            const on = selected.includes(n.key);
            return (
              <button
                key={n.key}
                onClick={() => toggle(n.key)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 aspect-square rounded-2xl border transition-all hover-elevate",
                  on ? "bg-primary/10 border-primary" : "bg-card border-border"
                )}
                data-testid={`chip-niche-${n.key.toLowerCase()}`}
              >
                <span className="text-2xl">{n.emoji}</span>
                <span className={cn("text-sm font-semibold", on && "text-primary")}>{n.key}</span>
              </button>
            );
          })}
        </div>

        <Button
          size="lg"
          className="w-full h-14 rounded-full font-semibold glow-primary mt-auto"
          onClick={finish}
          disabled={loading}
          data-testid="button-finish"
        >
          {loading ? "Saving\u2026" : `Finish${selected.length > 0 ? ` \u2022 ${selected.length} picked` : ""}`}
        </Button>
      </div>
    </div>
  );
}
