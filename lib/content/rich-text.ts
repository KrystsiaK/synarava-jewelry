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

/** Accept http(s), mailto, in-app paths, and hash anchors. Bare www. → https. */
export function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  return null;
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

export function richTextPlainLength(value: string): number {
  return stripRichTextTags(value).replace(/\s+/g, " ").trim().length;
}

export function isRichTextEmpty(html: string): boolean {
  return richTextPlainLength(html) === 0;
}

/** Strip TipTap empty shells and disallow unsafe tags/attrs. */
export function normalizeRichTextForStorage(html: string): string {
  if (!html || isRichTextEmpty(html)) return "";
  return sanitizeRichTextHtml(html);
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
      const external = /^https?:\/\//i.test(href);
      const target = external ? ' target="_blank"' : "";
      const rel = external ? ' rel="noopener noreferrer"' : "";
      return `<a href="${escapeAttr(href)}"${target}${rel}>`;
    }
    // Drop unknown tags; keep inner text.
    return "";
  });
}
