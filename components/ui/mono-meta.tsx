import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function MonoMeta({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label-mono", className)} {...props} />;
}
