import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorXMark } from "@/components/brand";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login, requestOtp, user } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (user) navigate("/");
  }, [navigate, user]);

  async function onRequestOtp() {
    setIsRequestingOtp(true);
    try {
      await requestOtp(email);
      setOtpRequested(true);
      toast({ title: "OTP sent", description: "Check server logs for OTP in this phase." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to request OTP";
      toast({ title: "Could not request OTP", description: message, variant: "destructive" });
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      const profile = await login(email, otp);
      toast({ title: `Welcome back, ${profile.full_name.split(" ")[0]}` });
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast({ title: "Login failed", description: message, variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
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
          <p className="text-muted-foreground">Request a one-time passcode to sign in.</p>
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
            type="button"
            variant="secondary"
            size="lg"
            className="w-full h-12 rounded-xl font-semibold"
            onClick={onRequestOtp}
            disabled={!email || isRequestingOtp}
            data-testid="button-request-otp"
          >
            {isRequestingOtp ? "Requesting OTP…" : otpRequested ? "Resend OTP" : "Request OTP"}
          </Button>

          <div>
            <Label htmlFor="otp" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              6-digit OTP
            </Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-2 h-12 bg-card border-border rounded-xl"
              data-testid="input-otp"
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 rounded-full font-semibold glow-primary"
            disabled={!email || otp.length !== 6 || isLoggingIn}
            data-testid="button-login"
          >
            {isLoggingIn ? "Logging in…" : "Log In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-auto">
          New to CreatorX?{" "}
          <Link href="/auth/signup" className="text-foreground font-semibold hover:text-primary" data-testid="link-signup">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
