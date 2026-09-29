import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";

/**
 * Suffix after `%s` in a Next/site title template (e.g. `%s | Synarava` → ` | Synarava`).
 * Empty when the template has no `%s` placeholder.
 */
export function titleTemplateSuffix(
  titleTemplate: string = SITE_SEO_DEFAULTS.titleTemplate,
): string {
  const marker = "%s";
  const index = titleTemplate.indexOf(marker);
  if (index < 0) return "";
  return titleTemplate.slice(index + marker.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip one or more trailing brand suffixes that match the site title template
 * (Shopify meta titles often already end with `| Synarava`).
 */
export function stripTitleTemplateBrand(
  pageTitle: string,
  titleTemplate: string = SITE_SEO_DEFAULTS.titleTemplate,
): string {
  const trimmed = pageTitle.trim();
  const suffix = titleTemplateSuffix(titleTemplate).trim();
  if (!trimmed || !suffix) return trimmed;

  // Match `| Synarava`, `— Synarava`, `- Synarava` with flexible whitespace, repeatedly.
  const separator = suffix.match(/^([|\-–—])/)?.[1] ?? "|";
  const brand = suffix.replace(/^[|\-–—]\s*/, "").trim();
  if (!brand) return trimmed;

  const trailing = new RegExp(
    `(?:\\s*[${escapeRegExp(separator)}|\\-–—]\\s*${escapeRegExp(brand)})+$`,
    "i",
  );
  return trimmed.replace(trailing, "").trimEnd();
}

/**
 * Single composition path for storefront `<title>` / SERP chrome.
 * Applies `titleTemplate` once; if `pageTitle` already ends with the brand
 * (or was doubled), the brand appears exactly once.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata#template
 */
export function composeDocumentTitle(
  pageTitle: string | null | undefined,
  titleTemplate: string = SITE_SEO_DEFAULTS.titleTemplate,
): string {
  const base = stripTitleTemplateBrand(pageTitle ?? "", titleTemplate);
  if (!base) {
    const suffix = titleTemplateSuffix(titleTemplate).trim();
    const brand = suffix.replace(/^[|\-–—]\s*/, "").trim();
    return brand || SITE_SEO_DEFAULTS.defaultTitle;
  }
  if (!titleTemplate.includes("%s")) {
    return base;
  }
  return titleTemplate.replace("%s", base);
}

/**
 * Next.js Metadata `title` that bypasses the root layout template so brand
 * composition stays in {@link composeDocumentTitle} only.
 */
export function metadataDocumentTitle(
  pageTitle: string | null | undefined,
  titleTemplate: string = SITE_SEO_DEFAULTS.titleTemplate,
): { absolute: string } {
  return { absolute: composeDocumentTitle(pageTitle, titleTemplate) };
}
