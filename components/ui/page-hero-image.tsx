import Image from "next/image";

import { cn } from "@/lib/ui";

export function PageHeroImage({
  src,
  imageClassName,
  overlayClassName,
}: {
  src?: string | null;
  imageClassName?: string;
  overlayClassName?: string;
}) {
  if (!src) return null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-charcoal" aria-hidden="true">
      <Image
        data-testid="page-hero-image"
        src={src}
        alt=""
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
