import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function relativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatShortDate(value);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CX";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function platformIcon(platform: string): IoniconName {
  if (platform === "instagram") return "logo-instagram";
  if (platform === "youtube") return "logo-youtube";
  if (platform === "twitter") return "logo-twitter";
  if (platform === "linkedin") return "logo-linkedin";
  return "phone-portrait";
}
