/* eslint-disable @next/next/no-img-element */
import type { HTMLAttributes } from "react";

import { cn } from "@/lib/ui";

type MediaFrameProps = HTMLAttributes<HTMLDivElement> & {
  src: string;
  alt: string;
  caption?: string;
  mirror?: boolean;
  imageClassName?: string;
};

export function MediaFrame({
  src,
  alt,
  caption,
  mirror = false,
  className,
  imageClassName,
  ...props
}: MediaFrameProps) {
  return (
    <figure className={cn("space-y-4", className)} {...props}>
      <div className="relative overflow-hidden bg-black/5">
        <img alt={alt} src={src} className={cn("h-full w-full object-cover", imageClassName)} />
        {mirror ? (
          <div className="mirror-fragment absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <img
              alt=""
              aria-hidden="true"
              src={src}
              className="absolute inset-y-0 -right-full h-full w-[200%] scale-x-[-1] object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
          </div>
        ) : null}
      </div>
      {caption ? <figcaption className="label-mono text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
