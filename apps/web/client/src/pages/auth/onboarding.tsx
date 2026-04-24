import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CreatorXMark } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * 3-slide carousel matching the "Track Earnings & Chat" onboarding design.
 * Each slide has a hero illustration, headline, subhead.
 */
const SLIDES = [
  {
    title: ["Discover", "Premium Campaigns"],
    body: "Match with top brands that fit your audience \u2014 personalized recommendations, every day.",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=900&h=900&fit=crop&auto=format&q=85",
  },
  {
    title: ["Track Earnings", "& Chat"],
    body: "Monitor your campaign revenue in real-time and communicate directly with top brands.",
    image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=900&h=900&fit=crop&auto=format&q=85",
  },
  {
    title: ["Get Paid", "On Time. Every Time."],
    body: "Payment is locked the moment your deliverable is approved. Withdraw anytime.",
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=900&fit=crop&auto=format&q=85",
  },
];

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const last = idx === SLIDES.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col px-6 pt-10 pb-10">
        {/* Header: logo + skip */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <CreatorXMark />
            <span className="font-display font-extrabold tracking-[0.2em] text-sm text-foreground">
              CREATORX
            </span>
          </div>
          <button
            onClick={() => navigate("/auth/login")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-skip"
          >
            Skip
          </button>
        </div>

        {/* Hero illustration */}
        <div className="rounded-3xl overflow-hidden aspect-square bg-card mb-10">
          <img
            src={slide.image}
            alt=""
            className="w-full h-full object-cover"
            key={slide.image}
          />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-extrabold tracking-tight text-center mb-5 leading-tight">
          {slide.title[0]}
          <br />
          {slide.title[1]}
        </h1>

        {/* Body */}
        <p className="text-muted-foreground text-center text-base max-w-sm mx-auto mb-8 leading-relaxed">
          {slide.body}
        </p>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === idx ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/40"
              )}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto space-y-4">
          <Button
            size="lg"
            className="w-full h-14 text-base font-semibold rounded-full glow-primary"
            onClick={() => (last ? navigate("/auth/signup") : setIdx(idx + 1))}
            data-testid="button-next"
          >
            {last ? "Get Started" : "Next"}
            <span className="ml-2">{"\u2192"}</span>
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/auth/login")}
              className="text-foreground font-semibold hover:text-primary transition-colors"
              data-testid="link-login"
            >
              Log In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
