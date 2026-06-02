import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function BodyLead({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("max-w-2xl text-lg leading-8 text-muted md:text-[1.2rem]", className)} {...props} />;
}
