"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/ui";

type EditorialSplitFeatureProps = {
  href?: string;
  reversed?: boolean;
  showDivider?: boolean;
  imageSrc: string;
  imageAlt: string;
  imagePanelClassName?: string;
  contentPanelClassName?: string;
  imageFrameClassName?: string;
  imageClassName?: string;
  topMeta?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  imageOverlay?: ReactNode;
};

export function EditorialSplitFeature({
  href,
  reversed = false,
  showDivider = true,
  imageSrc,
  imageAlt,
  imagePanelClassName,
  contentPanelClassName,
  imageFrameClassName,
  imageClassName,
  topMeta,
  title,
  description,
  action,
  footer,
  imageOverlay,
}: EditorialSplitFeatureProps) {
  const content = (
    <article
      className={cn(
        "group grid grid-cols-1 gap-10 py-14 md:grid-cols-12 md:items-center md:gap-8 md:py-20",
        showDivider && "border-t border-foreground/[0.08]",
      )}
    >
      <div
        className={cn(
          "md:col-span-6",
          reversed ? "md:col-start-7" : "md:col-start-1",
          imagePanelClassName,
        )}
      >
        <div className={cn("relative aspect-[4/5] overflow-hidden bg-foreground/5", imageFrameClassName)}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className={cn("object-cover transition-transform duration-700 group-hover:scale-[1.025]", imageClassName)}
          />
          {imageOverlay ? <div className="absolute inset-0">{imageOverlay}</div> : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-full flex-col justify-between gap-10 md:col-span-5",
          reversed ? "md:col-start-1 md:row-start-1" : "md:col-start-8",
          contentPanelClassName,
        )}
      >
        <div className="space-y-7">
          {topMeta ? <div>{topMeta}</div> : null}
          <div>{title}</div>
          {description ? <p className="max-w-xl text-sm leading-[1.9] text-muted-ink md:text-base">{description}</p> : null}
          {action ? <div>{action}</div> : null}
        </div>
        {footer ? <div>{footer}</div> : null}
      </div>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red">
      {content}
    </Link>
  );
}
