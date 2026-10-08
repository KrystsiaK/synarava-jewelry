import { type HTMLAttributes } from "react";

import { glueTextChildren } from "@/lib/text/glue-text-children";
import { cn } from "@/lib/ui";

export function MonoMeta({ className, children, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span data-component="MonoMeta" className={cn("label-mono", className)} {...props}>
      {glueTextChildren(children)}
    </span>
  );
}
