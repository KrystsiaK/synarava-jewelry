import Image from "next/image";

import { cn } from "@/lib/ui";
import { resolveCmsImageAlt } from "@/lib/content/cms-image-alt";

export function PageHeroImage({
  src,
  alt,
  imageClassName,
  overlayClassName,
}: {
  src?: string | null;
  /** When set, the hero is announced to assistive tech; blank keeps it decorative. */
  alt?: string | null;
  imageClassName?: string;
  overlayClassName?: string;
}) {
  if (!src) return null;

  const resolvedAlt = resolveCmsImageAlt(alt);
  const decorative = !resolvedAlt;

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-charcoal"
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        data-testid="page-hero-image"
        src={src}
        alt={resolvedAlt}
        fill
        preload
        quality={75}
        sizes="100vw"
        className={cn("object-cover", imageClassName)}
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/15",
          overlayClassName,
        )}
      />
    </div>
  );
}
