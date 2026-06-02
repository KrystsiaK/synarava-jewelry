import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function ArtifactPanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}
