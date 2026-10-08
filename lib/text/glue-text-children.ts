import type { ReactNode } from "react";

import { glueOrphanPunctuation } from "@/lib/text/glue-orphan-punctuation";

/** Glue orphan punctuation when `children` is a plain string (or string array). */
export function glueTextChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return glueOrphanPunctuation(children);
  if (Array.isArray(children)) {
    return children.map((child) =>
      typeof child === "string" ? glueOrphanPunctuation(child) : child,
    );
  }
  return children;
}
