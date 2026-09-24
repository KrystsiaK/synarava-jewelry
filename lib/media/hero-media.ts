/**
 * Site videos replace a static hero image when any slot is set.
 * The image remains a fallback (and optional video poster).
 */
export function normalizeVideoSources(src?: string | string[] | null): string[] {
  if (!src) return [];
  const list = Array.isArray(src) ? src : [src];
  return list.filter((value): value is string => typeof value === "string" && value.length > 0);
}

export type HeroBackdrop =
  | { mode: "video"; sources: string[]; poster?: string }
  | { mode: "image"; src: string }
  | { mode: "none" };

export function resolveHeroBackdrop(options: {
  videoSrc?: string | string[] | null;
  imageSrc?: string | null;
}): HeroBackdrop {
  const sources = normalizeVideoSources(options.videoSrc);
  const imageSrc = typeof options.imageSrc === "string" && options.imageSrc.length > 0
    ? options.imageSrc
    : undefined;

  if (sources.length > 0) {
    return { mode: "video", sources, poster: imageSrc };
  }
  if (imageSrc) {
    return { mode: "image", src: imageSrc };
  }
  return { mode: "none" };
}
