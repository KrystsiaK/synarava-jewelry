import { type HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

export function EditorialHeading({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("font-serif text-[2.8rem] leading-[0.96] md:text-[4rem]", className)} {...props} />;
}
