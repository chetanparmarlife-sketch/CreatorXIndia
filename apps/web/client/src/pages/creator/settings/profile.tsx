import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { SettingsSubShell } from "./_shell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Lookups = { cities: string[]; languages: string[]; niches: string[] };

export default function SettingsProfilePage() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const { data: lookups } = useQuery<Lookups>({ queryKey: ["/api/lookups"] });

  const [fullName, setFullName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [niches, setNiches] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setHandle((user.handle || "").replace(/^@/, ""));
      setBio(user.bio || "");
      setPhone(user.phone || "");
      setCity(user.city || "");
      setLanguages(user.languages || []);
      setNiches(user.niches || []);
    }
  }, [user]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/profile", {
        full_name: fullName,
        handle: handle.replace(/^@/, ""),
        bio,
        phone,
        city,
        languages,
        niches,
      });
      return await res.json();
    },
    onSuccess: async () => {
      toast({ title: "Profile updated" });
      await refresh();
      queryClient.invalidateQueries();
    },
    onError: (e: any) =>
      toast({ title: "Couldn't save", description: e?.message || "Please try again.", variant: "destructive" }),
  });

  if (!user) return null;

  return (
    <SettingsSubShell title="Edit profile" subtitle="Your public creator identity">
      <div className="space-y-5">
        <Field label="Full name">
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="bg-card border-border h-12 rounded-xl"
            data-testid="input-name"
          />
        </Field>

        <Field label="Handle" hint="Used in public URLs. No spaces or @.">
          <div className="flex items-center bg-card border border-border rounded-xl h-12 px-3 focus-within:ring-1 focus-within:ring-primary">
            <span className="text-muted-foreground mr-1">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ""))}
              className="flex-1 bg-transparent outline-none text-sm"
              data-testid="input-handle"
            />
          </div>
        </Field>

        <Field label="Bio" hint={`${bio.length}/160 characters`}>
          <Textarea
            value={bio}
            maxLength={160}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="What do you create?"
            className="bg-card border-border rounded-xl resize-none"
            data-testid="input-bio"
          />
        </Field>

        <Field label="Phone (India)">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98XXXXXXXX"
            className="bg-card border-border h-12 rounded-xl"
            data-testid="input-phone"
          />
        </Field>

        <Field label="City">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full bg-card border border-border h-12 rounded-xl px-3 text-sm"
            data-testid="select-city"
          >
            <option value="">Select city</option>
            {(lookups?.cities || []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field label="Languages (content)" hint="Pick all you create in">
          <div className="flex flex-wrap gap-2">
            {(lookups?.languages || []).map((l) => {
              const on = languages.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguages(on ? languages.filter((x) => x !== l) : [...languages, l])}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    on
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-foreground hover-elevate"
                  )}
                  data-testid={`chip-lang-${l}`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Niches" hint="Your content categories">
          <div className="flex flex-wrap gap-2">
            {(lookups?.niches || []).map((n) => {
              const on = niches.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNiches(on ? niches.filter((x) => x !== n) : [...niches, n])}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    on
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-card border-border text-foreground hover-elevate"
                  )}
                  data-testid={`chip-niche-${n}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </Field>

        <Button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="w-full h-12 rounded-xl font-bold glow-primary"
          data-testid="button-save-profile"
        >
          {saveMut.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </SettingsSubShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
