import type { ReactNode } from "react";

import { CapsLabel } from "@/components/ui/caps-label";
import { cn } from "@/lib/ui";

type InfoItem = {
  label: string;
  value: ReactNode;
};

export function InfoList({
  items,
  className,
}: {
  items: InfoItem[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-6", className)}>
      {items.map((item) => (
        <div key={item.label} className="grid gap-2 border-b border-[color:var(--color-border-subtle)] pb-4 last:border-b-0 last:pb-0">
          <dt>
            <CapsLabel className="text-muted">{item.label}</CapsLabel>
          </dt>
          <dd className="text-base leading-7 text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
