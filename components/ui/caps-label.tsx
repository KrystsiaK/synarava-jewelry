import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function CapsLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("label-caps", className)} {...props} />;
}
