import { type HTMLAttributes } from "react";

import { glueTextChildren } from "@/lib/text/glue-text-children";
import { cn } from "@/lib/ui";

/**
 * Large serif display heading. Prefer `DisplayHeading` with a `text` prop for
 * narrow measures — that path owns fit-by-longest-word. This primitive keeps
 * the shared ink box without single-line over-shrink on multi-word children.
 * String children get orphan-punctuation NBSP glue (shared text layer).
 */
export function EditorialHeading({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-component="EditorialHeading"
      className={cn(
        "type-display font-serif text-[2.8rem] leading-[0.96] md:text-[4rem]",
        className,
      )}
      {...props}
    >
      {glueTextChildren(children)}
    </h2>
  );
}
