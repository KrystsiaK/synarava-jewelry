/**
 * Soft publish checklist for product gallery alt text.
 * Shopify SoT for MEDIA_IMAGE.alt — we surface gaps, not a second alt store.
 */

import { mediaFramesFromWorkingSnapshot } from "@/lib/shopify/shopify-snapshot-media";

export function normalizeImageAlt(value: string | null | undefined) {
  return value?.trim() ?? "";
}

/** Auto placeholder from snapshot frames (`Image 1`, …). */
export function isPlaceholderImageAlt(alt: string) {
  return /^image\s+\d+$/i.test(alt.trim());
}

/**
 * Alt that is still basically a filename / camera dump — not buyer-facing copy.
 * Prefer descriptive English (e.g. "Lava ring on linen, side view").
 */
export function isFilenameLikeImageAlt(alt: string, filename?: string | null) {
  const text = alt.trim();
  if (!text) return false;

  if (filename) {
    const stem = filename.replace(/\.[^.]+$/, "").trim();
    if (stem && text.toLowerCase() === stem.toLowerCase()) return true;
  }

  if (/\s/.test(text)) return false;
  if (/\.(jpe?g|png|webp|gif|avif|heic)$/i.test(text)) return true;
  if (/^[a-f0-9-]{8,}$/i.test(text)) return true;
  if (/^(img|image|dsc|photo|pic|file)[-_]?\d/i.test(text)) return true;
  // upload stems often look like `lava-ring-1b5f1e41`
  if (/^[a-z0-9]+(?:-[a-z0-9]+){1,6}$/i.test(text) && /[a-f0-9]{6,}$/i.test(text)) return true;
  return false;
}

/** True when alt is blank, placeholder, or filename-like (needs editor attention). */
export function imageAltNeedsAttention(alt: string | null | undefined, filename?: string | null) {
  const text = normalizeImageAlt(alt);
  if (!text) return true;
  if (isPlaceholderImageAlt(text)) return true;
  return isFilenameLikeImageAlt(text, filename);
}

export function imageAltSoftWarning(alt: string | null | undefined, filename?: string | null) {
  const text = normalizeImageAlt(alt);
  if (!text) return "Add descriptive alt text before publishing.";
  if (isPlaceholderImageAlt(text)) return "Replace the placeholder with a short description of the image.";
  if (isFilenameLikeImageAlt(text, filename)) {
    return "This still looks like a filename — describe the product view for SEO and accessibility.";
  }
  return null;
}

export type ImageAltCoverageCounts = {
  publishedWithMedia: number;
  withGoodAlt: number;
};

/** Same tone ladder as SEO title coverage: empty / warn / partial / ok. */
export function imageAltCoverageTone(bucket: ImageAltCoverageCounts) {
  if (bucket.publishedWithMedia === 0) return "empty" as const;
  if (bucket.withGoodAlt === 0) return "warn" as const;
  if (bucket.withGoodAlt < bucket.publishedWithMedia) return "partial" as const;
  return "ok" as const;
}

/** Gallery alts from local ProductMedia rows, else OUR workingSnapshot.media. */
export function productGalleryAltsForChecklist(product: {
  media: Array<{ alt: string | null; asset?: { filename?: string | null } | null }>;
  workingSnapshot: unknown;
}): Array<{ alt: string; filename?: string | null }> {
  if (product.media.length > 0) {
    return product.media.map((item) => ({
      alt: item.alt ?? "",
      filename: item.asset?.filename ?? null,
    }));
  }
  return mediaFramesFromWorkingSnapshot(product.workingSnapshot).map((frame) => ({
    alt: frame.alt,
    filename: null,
  }));
}

export function countWeakGalleryAlts(
  alts: Array<{ alt: string; filename?: string | null }>,
) {
  return alts.filter((item) => imageAltNeedsAttention(item.alt, item.filename)).length;
}
