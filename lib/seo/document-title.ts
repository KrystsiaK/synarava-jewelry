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

const DEFAULT_BRAND = "Synarava";

/** True when the title already leads with the brand (legacy absolute titles). */
export function isBrandFirstTitle(
  title: string | null | undefined,
  brand: string = DEFAULT_BRAND,
): boolean {
  const trimmed = title?.trim();
  if (!trimmed || !brand.trim()) return false;
  return new RegExp(`^${escapeRegExp(brand.trim())}\\b`, "i").test(trimmed);
}

/**
 * Bare on-page H1 slogans must not become `<title>` / og:title.
 * Only short ALL-CAPS lines that end with `.` (e.g. "TODAY, THIS.") —
 * not short admin SEO titles like "FAQ" or "NEW ARRIVALS".
 */
function looksLikeBareSlogan(title: string, brand: string): boolean {
  const trimmed = title.trim();
  if (!trimmed || !trimmed.endsWith(".")) return false;
  if (isBrandFirstTitle(trimmed, brand)) return false;
  // Already ends with the template brand → SEO title, not a slogan.
  if (stripTitleTemplateBrand(trimmed) !== trimmed) return false;
  return (
    trimmed.length <= 40 &&
    /^[A-Z0-9][A-Z0-9\s,.'’\-–—!?]*\.$/.test(trimmed)
  );
}

function resolveHomeTitleCandidate(
  candidate: string,
  brand: string,
  titleTemplate: string,
): string | null {
  const trimmed = candidate.trim();
  if (!trimmed || looksLikeBareSlogan(trimmed, brand)) return null;
  if (isBrandFirstTitle(trimmed, brand)) return trimmed;
  return composeDocumentTitle(trimmed, titleTemplate);
}

/**
 * Homepage `<title>` / og:title: prefer admin page SEO title (any locale),
 * then localized messages fallback, then site SEO default. Trailing-brand
 * titles (`… | Synarava`) are first-class. Brand-first absolutes are kept
 * without re-applying the template. Bare H1 slogans are skipped.
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata#template
 */
export function resolveHomeDocumentTitle({
  seoTitle,
  siteDefaultTitle,
  fallbackTitle,
  brand = DEFAULT_BRAND,
  titleTemplate = SITE_SEO_DEFAULTS.titleTemplate,
}: {
  seoTitle?: string | null;
  siteDefaultTitle?: string | null;
  fallbackTitle: string;
  brand?: string;
  titleTemplate?: string;
}): string {
  const candidates = [seoTitle, fallbackTitle, siteDefaultTitle, SITE_SEO_DEFAULTS.defaultTitle];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const resolved = resolveHomeTitleCandidate(candidate, brand, titleTemplate);
    if (resolved) return resolved;
  }
  return SITE_SEO_DEFAULTS.defaultTitle;
}
