/**
 * Minimal rich-text helpers for admin WYSIWYG + storefront render.
 * Allowed markup: paragraphs, line breaks, emphasis, and safe links.
 */

const TAG_RE = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll("'", "&#39;");
}

/** Same-tab storefront/hash targets (no `target="_blank"`). */
export function isInternalHref(href: string): boolean {
  const trimmed = href.trim();
  return trimmed.startsWith("/") || trimmed.startsWith("#");
}

/** Absolute http(s) — open in a new tab with noopener. */
export function isExternalHttpHref(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/**
 * Accept http(s), mailto, in-app paths (`/shop`), and hash anchors (`#section`).
 * Bare `www.` → `https://`. Rejects javascript/data/vbscript.
 * @see https://tiptap.dev/docs/editor/extensions/marks/link#isalloweduri
 */
export function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (
    isExternalHttpHref(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    isInternalHref(trimmed)
  ) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

/** TipTap `isAllowedUri` — allow our internal paths while keeping default protocol checks. */
export function isAllowedRichTextHref(
  url: string,
  defaultValidate: (url: string) => boolean,
): boolean {
  if (!url) return false;
  if (sanitizeHref(url)) return true;
  return defaultValidate(url);
}

export function plainTextToRichHtml(value: string): string {
  if (!value) return "";
  return value
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");
}

/** TipTap / preview input: plain text → paragraphs; HTML left as-is. */
export function normalizeRichTextForEditor(value: string): string {
  const trimmed = value ?? "";
  if (!trimmed.trim()) return "";
  if (looksLikeHtml(trimmed)) return trimmed;
  return plainTextToRichHtml(trimmed);
}

export function stripRichTextTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(TAG_RE, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Plain string for meta descriptions / search summaries (never HTML). */
export function plainTextFromRichText(value: string | null | undefined): string {
  if (!value) return "";
  return stripRichTextTags(value).replace(/\s+/g, " ").trim();
}

export function richTextPlainLength(value: string): number {
  return stripRichTextTags(value).replace(/\s+/g, " ").trim().length;
}

export function isRichTextEmpty(html: string): boolean {
  return richTextPlainLength(html) === 0;
}

/** Strip TipTap empty shells and disallow unsafe tags/attrs. */
export function normalizeRichTextForStorage(html: string): string {
  if (!html || isRichTextEmpty(html)) return "";
  const sanitized = sanitizeRichTextHtml(html);
  // Single plain paragraph (no links / breaks) → store as plain text so
  // existing storefront copy and meta fields stay compatible until an
  // operator actually inserts a link or multiple paragraphs.
  const paragraphCount = (sanitized.match(/<p\b/gi) || []).length;
  if (!/<a\b/i.test(sanitized) && paragraphCount <= 1 && !/<br\b/i.test(sanitized)) {
    return stripRichTextTags(sanitized);
  }
  return sanitized;
}

export function sanitizeRichTextHtml(input: string): string {
  return input.replace(TAG_RE, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    const closing = match.startsWith("</");

    if (tag === "br") return closing ? "" : "<br>";
    if (tag === "p" || tag === "strong" || tag === "em" || tag === "b" || tag === "i") {
      return closing ? `</${tag}>` : `<${tag}>`;
    }
    if (tag === "a") {
      if (closing) return "</a>";
      const hrefMatch = match.match(HREF_RE);
      const rawHref = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? "";
      const href = sanitizeHref(rawHref);
      if (!href) return "";
      const external = isExternalHttpHref(href);
      const target = external ? ' target="_blank"' : "";
      const rel = external ? ' rel="noopener noreferrer"' : "";
      return `<a href="${escapeAttr(href)}"${target}${rel}>`;
    }
    // Drop unknown tags; keep inner text.
    return "";
  });
}
