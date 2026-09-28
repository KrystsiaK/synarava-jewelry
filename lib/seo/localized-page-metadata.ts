import { plainTextFromRichText } from "@/lib/content/rich-text";

type PageMetadataSource = {
  title?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
} | null | undefined;

function nonEmpty(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function plainMeta(value: string | null | undefined) {
  const plain = plainTextFromRichText(value ?? "");
  return plain || null;
}

/** Applies the same field-level fallback policy used by storefront content. */
export function localizedPageMetadataCopy({
  page,
  fallbackTitle,
  fallbackDescription,
}: {
  page: PageMetadataSource;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  return {
    title: nonEmpty(page?.seoTitle) ?? nonEmpty(page?.title) ?? fallbackTitle,
    description:
      plainMeta(page?.seoDescription) ??
      plainMeta(page?.excerpt) ??
      fallbackDescription,
  };
}
