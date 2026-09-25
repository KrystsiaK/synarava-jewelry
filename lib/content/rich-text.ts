/**
 * Minimal rich-text helpers for admin WYSIWYG + storefront render.
 * Allowed markup: paragraphs, lists, line breaks, emphasis, and safe links.
 */

import { resolveLegalActionPath } from "@/lib/content/legal-actions";

const TAG_RE = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Markdown-ish copy (lists, **bold**, [links](url)) that TipTap should convert. */
export function looksLikeMarkdown(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || looksLikeHtml(trimmed)) return false;
  return (
    /^#{1,6}\s/m.test(trimmed) ||
    /^\s*[-*+]\s+/m.test(trimmed) ||
    /^\s*\d+\.\s+/m.test(trimmed) ||
    /\[[^\]]+\]\([^)]+\)/.test(trimmed) ||
    /\*\*[^*]+\*\*/.test(trimmed) ||
    /__[^_]+__/.test(trimmed)
  );
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
 * Accept http(s), mailto, in-app paths (`/shop`), hash anchors.
 * Legacy allowlisted `action:` hrefs normalize to their storefront path
 * (e.g. `action:cookie-settings` → `/cookie-settings`). Bare `www.` → `https://`.
 * @see https://tiptap.dev/docs/editor/extensions/marks/link#isalloweduri
 */
export function sanitizeHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  const actionPath = resolveLegalActionPath(trimmed);
  if (actionPath) return actionPath;
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

function inlineMarkdownToHtml(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const safe = sanitizeHref(href);
    if (!safe) return escapeHtml(label);
    const external = isExternalHttpHref(safe);
    const target = external ? ' target="_blank"' : "";
    const rel = external ? ' rel="noopener noreferrer"' : "";
    return `<a href="${escapeAttr(safe)}"${target}${rel}>${escapeHtml(label)}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  return html;
}

/**
 * Best-effort Markdown → TipTap HTML so legal defaults open as WYSIWYG, not source.
 * Covers paragraphs, bullet/ordered lists, bold, and links used in legal copy.
 */
export function markdownToRichHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lines = trimmed.split("\n");
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i] ?? "")) {
        items.push(inlineMarkdownToHtml((lines[i] ?? "").replace(/^\s*[-*+]\s+/, "")));
        i += 1;
      }
      parts.push(`<ul>${items.map((item) => `<li><p>${item}</p></li>`).join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? "")) {
        items.push(inlineMarkdownToHtml((lines[i] ?? "").replace(/^\s*\d+\.\s+/, "")));
        i += 1;
      }
      parts.push(`<ol>${items.map((item) => `<li><p>${item}</p></li>`).join("")}</ol>`);
      continue;
    }

    const block: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? "";
      if (!next.trim()) break;
      if (/^\s*[-*+]\s+/.test(next) || /^\s*\d+\.\s+/.test(next)) break;
      block.push(next);
      i += 1;
    }
    parts.push(`<p>${inlineMarkdownToHtml(block.join(" "))}</p>`);
  }

  return parts.join("");
}

export function plainTextToRichHtml(value: string): string {
  if (!value) return "";
  return value
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");
}

/** TipTap / preview input: HTML as-is; Markdown → HTML; else plain paragraphs. */
export function normalizeRichTextForEditor(value: string): string {
  const trimmed = value ?? "";
  if (!trimmed.trim()) return "";
  if (looksLikeHtml(trimmed)) return trimmed;
  if (looksLikeMarkdown(trimmed)) return markdownToRichHtml(trimmed);
  return plainTextToRichHtml(trimmed);
}

export function stripRichTextTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
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
  // Single plain paragraph (no links / lists / breaks) → store as plain text.
  const paragraphCount = (sanitized.match(/<p\b/gi) || []).length;
  const hasList = /<(?:ul|ol|li)\b/i.test(sanitized);
  if (
    !/<a\b/i.test(sanitized) &&
    !hasList &&
    paragraphCount <= 1 &&
    !/<br\b/i.test(sanitized)
  ) {
    return stripRichTextTags(sanitized);
  }
  return sanitized;
}

export function sanitizeRichTextHtml(input: string): string {
  return input.replace(TAG_RE, (match, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    const closing = match.startsWith("</");

    if (tag === "br") return closing ? "" : "<br>";
    if (
      tag === "p" ||
      tag === "strong" ||
      tag === "em" ||
      tag === "b" ||
      tag === "i" ||
      tag === "ul" ||
      tag === "ol" ||
      tag === "li"
    ) {
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
