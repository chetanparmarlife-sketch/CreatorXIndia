import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorXMark } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  handle: string;
  avatar_url: string | null;
  verified_pro?: boolean;
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, loginAsDemo, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(user.role === "admin" ? "/admin" : "/");
  }, [user, navigate]);

  const { data: demoData } = useQuery<{ creators: DemoUser[]; admins: DemoUser[] }>({
    queryKey: ["/api/auth/demo-users"],
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const p = await login(email);
      toast({ title: `Welcome back, ${p.full_name.split(" ")[0]}` });
      navigate(p.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function demoLogin(id: string) {
    const p = await loginAsDemo(id);
    if (p) navigate(p.role === "admin" ? "/admin" : "/");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-6 pt-10 pb-10">
        <div className="flex items-center gap-2.5 mb-16">
          <CreatorXMark />
          <span className="font-display font-extrabold tracking-[0.2em] text-sm">CREATORX</span>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Log in to pick up where you left off.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 mb-6">
          <div>
            <Label htmlFor="email" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@creatorx.app"
              className="mt-2 h-12 bg-card border-border rounded-xl"
              data-testid="input-email"
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full h-14 rounded-full font-semibold glow-primary"
            disabled={loading}
            data-testid="button-login"
          >
            {loading ? "Logging in\u2026" : "Log In"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs uppercase tracking-widest text-muted-foreground">
              or try a demo account
            </span>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {demoData?.creators?.slice(0, 3).map((u) => (
            <button
              key={u.id}
              onClick={() => demoLogin(u.id)}
              className="w-full flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-border hover-elevate text-left"
              data-testid={`button-demo-${u.handle}`}
            >
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <div className="size-10 rounded-full bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                  {u.full_name}
                  {u.verified_pro && (
                    <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px]">
                      {"\u2713"}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <span className="text-xs text-primary font-semibold">Continue {"\u2192"}</span>
            </button>
          ))}
          {demoData?.admins?.map((u) => (
            <button
              key={u.id}
              onClick={() => demoLogin(u.id)}
              className="w-full flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-primary/30 hover-elevate text-left"
              data-testid={`button-demo-admin`}
            >
              <div className="size-10 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-primary font-bold text-sm">
                CX
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  Admin Console
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                    ADMIN
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <span className="text-xs text-primary font-semibold">Open {"\u2192"}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-auto">
          New to CreatorX?{" "}
          <Link href="/signup" className="text-foreground font-semibold hover:text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
