import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation } from "wouter";
import type { UserRole } from "@creatorx/schema";
import { useAuth } from "../lib/auth-context";

type OtpLoginProps = {
  headline: string;
  subline: string;
  accentColor: string;
  allowedRoles: UserRole[];
  roleError: string;
  successPath: string;
  backgroundClassName?: string;
  signupHref?: string;
};

export function OtpLogin({
  headline,
  subline,
  accentColor,
  allowedRoles,
  roleError,
  successPath,
  backgroundClassName = "bg-background",
  signupHref,
}: OtpLoginProps) {
  const [, navigate] = useLocation();
  const { login, logout, requestOtp, user } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (allowedRoles.includes(user.role)) {
      navigate(successPath);
      return;
    }
    setError(roleError);
  }, [allowedRoles, navigate, roleError, successPath, user]);

  async function onRequestOtp() {
    if (isRequestingOtp || !email) return;
    setIsRequestingOtp(true);
    setError(null);
    setMessage(null);
    try {
      await requestOtp(email);
      setOtpRequested(true);
      setMessage("OTP sent. Check your email for the code.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to request OTP");
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    setMessage(null);
    try {
      const profile = await login(email, otp);
      if (!allowedRoles.includes(profile.role)) {
        setError(roleError);
        await logout();
        return;
      }
      navigate(successPath);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <div className={`flex min-h-screen flex-col ${backgroundClassName}`}>
      <main className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-6 py-10">
        <div className="mb-16 flex items-center gap-2.5">
          <div
            className="inline-flex size-9 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: accentColor }}
          >
            ✦
          </div>
          <span className="text-sm font-extrabold tracking-[0.2em] text-foreground">CREATORX</span>
        </div>

        <div className="mb-10">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-foreground">{headline}</h1>
          <p className="text-muted-foreground">{subline}</p>
        </div>

        <form onSubmit={onSubmit} className="mb-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@creator-x.club"
              className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-4 text-foreground outline-none focus:ring-2"
              style={{ "--tw-ring-color": accentColor } as CSSProperties}
              data-testid="input-email"
              required
            />
          </div>

          <button
            type="button"
            className="h-12 w-full rounded-lg border border-border bg-card font-semibold text-foreground transition hover:bg-muted disabled:opacity-60"
            onClick={onRequestOtp}
            disabled={!email || isRequestingOtp}
            data-testid="button-request-otp"
          >
            {isRequestingOtp ? "Requesting OTP..." : otpRequested ? "Resend OTP" : "Request OTP"}
          </button>

          <div>
            <label htmlFor="otp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              6-digit OTP
            </label>
            <input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              className="mt-2 h-12 w-full rounded-lg border border-border bg-card px-4 text-foreground outline-none focus:ring-2"
              style={{ "--tw-ring-color": accentColor } as CSSProperties}
              data-testid="input-otp"
              required
            />
          </div>

          {message && <p className="text-sm font-medium text-emerald-400">{message}</p>}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            className="h-14 w-full rounded-full font-semibold text-white shadow-lg transition disabled:opacity-60"
            style={{ backgroundColor: accentColor }}
            disabled={!email || otp.length !== 6 || isLoggingIn}
            data-testid="button-login"
          >
            {isLoggingIn ? "Logging in..." : "Log In"}
          </button>
        </form>

        {signupHref && (
          <p className="mt-auto text-center text-sm text-muted-foreground">
            New to CreatorX?{" "}
            <Link href={signupHref} className="font-semibold text-foreground hover:underline" data-testid="link-signup">
              Sign up
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
