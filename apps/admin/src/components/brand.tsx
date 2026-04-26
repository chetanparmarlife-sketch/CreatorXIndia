import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * CreatorX wordmark — "Creator" in white + "X" in primary blue.
 * Matches the logo concept in the Stitch design file.
 */
export function CreatorXLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-5xl md:text-6xl",
  };
  return (
    <span className={cn("font-display font-extrabold tracking-tight leading-none", sizes[size], className)}>
      <span className="text-foreground">Creator</span>
      <span className="text-primary">X</span>
    </span>
  );
}

/** Small square logo chip with sparkles glyph, used in header + auth screens */
export function CreatorXMark({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground", className)}>
      <Icon name="auto_awesome" className="text-[18px]" />
    </div>
  );
}

/**
 * Material Symbols icon — matches the icon set used throughout the Stitch designs.
 * Usage: <Icon name="home" /> or <Icon name="home" filled className="text-primary" />
 */
export function Icon({ name, className, filled, weight = 400, size }: { name: string; className?: string; filled?: boolean; weight?: 300 | 400 | 500 | 600 | 700; size?: number }) {
  return (
    <span
      className={cn("material-symbols-outlined leading-none", className)}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
        fontSize: size ? `${size}px` : undefined,
      } as CSSProperties}
    >
      {name}
    </span>
  );
}
