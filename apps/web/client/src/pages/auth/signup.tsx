import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorXMark } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { signup } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: "", handle: "", email: "" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signup(form);
      toast({ title: "Account created \u2014 let's link your socials next" });
      navigate("/auth/connect-socials");
    } catch (err: any) {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-6 pt-10 pb-10">
        <div className="flex items-center gap-2.5 mb-12">
          <CreatorXMark />
          <span className="font-display font-extrabold tracking-[0.2em] text-sm">CREATORX</span>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Create your profile</h1>
          <p className="text-muted-foreground">One account. Every top brand in one place.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 mb-6">
          <Field label="Full Name">
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Jamie Rivera"
              className="h-12 bg-card border-border rounded-xl"
              data-testid="input-full-name"
              required
            />
          </Field>
          <Field label="Handle">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input
                value={form.handle}
                onChange={(e) =>
                  setForm({ ...form, handle: e.target.value.replace(/[^a-z0-9._]/gi, "").toLowerCase() })
                }
                placeholder="jamie.rivera"
                className="h-12 bg-card border-border rounded-xl pl-8"
                data-testid="input-handle"
                required
              />
            </div>
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jamie@example.com"
              className="h-12 bg-card border-border rounded-xl"
              data-testid="input-email"
              required
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 rounded-full font-semibold glow-primary mt-2"
            disabled={loading}
            data-testid="button-continue"
          >
            {loading ? "Creating account\u2026" : "Continue"}
            <span className="ml-2">{"\u2192"}</span>
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          By continuing, you agree to our{" "}
          <span className="underline underline-offset-2">Terms</span> and{" "}
          <span className="underline underline-offset-2">Privacy Policy</span>.
        </p>

        <p className="text-center text-sm text-muted-foreground mt-auto pt-8">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-foreground font-semibold hover:text-primary">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}
