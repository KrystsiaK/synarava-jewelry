import { type HTMLAttributes } from "react";

import { glueTextChildren } from "@/lib/text/glue-text-children";
import { cn } from "@/lib/ui";

export function CapsLabel({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span data-component="CapsLabel" className={cn("label-caps", className)} {...props}>
      {glueTextChildren(children)}
    </span>
  );
}
