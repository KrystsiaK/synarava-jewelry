import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function CapsLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span data-component="CapsLabel" className={cn("label-caps", className)} {...props} />;
}
