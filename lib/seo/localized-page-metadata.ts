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
    description: nonEmpty(page?.seoDescription) ?? nonEmpty(page?.excerpt) ?? fallbackDescription,
  };
}
