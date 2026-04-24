import { CreatorShell, CreatorSubHeader } from "@/components/creator-shell";
import type { ReactNode } from "react";

export function SettingsSubShell({
  title,
  subtitle,
  children,
  trailing,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <CreatorShell>
      <CreatorSubHeader title={title} subtitle={subtitle} backHref="/settings" trailing={trailing} />
      <div className="px-5 pt-2">{children}</div>
    </CreatorShell>
  );
}
