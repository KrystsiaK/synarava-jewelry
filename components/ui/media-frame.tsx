import type { HTMLAttributes } from "react";
import Image from "next/image";

import { cn } from "@/lib/ui";

type MediaFrameProps = HTMLAttributes<HTMLDivElement> & {
  src: string;
  alt: string;
  caption?: string;
  mirror?: boolean;
  imageClassName?: string;
  sizes?: string;
};

export function MediaFrame({
  src,
  alt,
  caption,
  mirror = false,
  className,
  imageClassName,
  sizes = "(max-width: 768px) 100vw, 50vw",
  ...props
}: MediaFrameProps) {
  return (
    <figure className={cn("space-y-4", className)} {...props}>
      <div className="relative aspect-[4/5] overflow-hidden bg-black/5">
        <Image
          alt={alt}
          src={src}
          fill
          sizes={sizes}
          className={cn("object-cover", imageClassName)}
        />
        {mirror ? (
          <div className="mirror-fragment absolute inset-y-0 right-0 w-1/2 overflow-hidden">
            <Image
              alt=""
              aria-hidden="true"
              src={src}
              fill
              sizes="25vw"
              className="!-right-full !left-auto !w-[200%] scale-x-[-1] object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-white/10 mix-blend-overlay" />
          </div>
        ) : null}
      </div>
      {caption ? <figcaption className="label-mono text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
