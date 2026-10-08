/**
 * Shared text-layer: keep orphan punctuation from starting a line.
 *
 * Whitespace splits alone leave marks (especially middle dot `·`) as their own
 * token. Reveal masks, narrow measures, and CMS copy can then wrap so a line
 * starts with `· 8 мм`. Glue those marks to the previous word with NBSP.
 *
 * Apply at render time (not storage) so editors and Shopify sync stay clean.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap
 */

const NBSP = "\u00A0";

/** Lone punctuation / separators that must not start a line. */
const ORPHAN_PUNCT_TOKEN =
  /^[·•∙⋅‧\u00B7\u2219\u22C5\u2022\u2027\-–—|:;,./…]+$/u;

/** Token that begins with those marks (e.g. `·8`). */
const LEADING_ORPHAN_PUNCT =
  /^[·•∙⋅‧\u00B7\u2219\u22C5\u2022\u2027\-–—|:;,./…]/u;

/** Same-line glue: non-ws → spaces/tabs → orphan token. */
const SAME_LINE_ORPHAN_GLUE =
  /(\S)([^\S\n\r]+)([·•∙⋅‧\u00B7\u2219\u22C5\u2022\u2027\-–—|:;,./…]+\S*)/gu;

const HTML_TAG_RE = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;

export function isOrphanPunctuationToken(token: string): boolean {
  if (!token) return false;
  if (ORPHAN_PUNCT_TOKEN.test(token)) return true;
  return LEADING_ORPHAN_PUNCT.test(token);
}

/**
 * Split into wrap units for reveal/fit titles.
 * Collapses whitespace (title path); punctuation binds to the prior word.
 */
export function orphanPunctuationWrapUnits(text: string): string[] {
  const raw = text.trim().split(/\s+/).filter(Boolean);
  const units: string[] = [];

  for (const token of raw) {
    if (units.length > 0 && isOrphanPunctuationToken(token)) {
      units[units.length - 1] = `${units[units.length - 1]}${NBSP}${token}`;
      continue;
    }
    units.push(token);
  }

  return units;
}

/**
 * Glue orphan punctuation for any plain string.
 * Preserves newlines; only same-line space/tab runs become NBSP.
 */
export function glueOrphanPunctuation(text: string): string {
  if (!text) return text;
  return text.replace(
    SAME_LINE_ORPHAN_GLUE,
    (_match, prev: string, _ws: string, punct: string) =>
      `${prev}${NBSP}${punct}`,
  );
}

/**
 * Glue orphan punctuation in HTML text nodes only (tags/attrs untouched).
 * Call after sanitize on render paths.
 */
export function glueOrphanPunctuationInHtml(html: string): string {
  if (!html) return html;
  let result = "";
  let lastIndex = 0;
  HTML_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = HTML_TAG_RE.exec(html)) !== null) {
    result += glueOrphanPunctuation(html.slice(lastIndex, match.index));
    result += match[0];
    lastIndex = match.index + match[0].length;
  }
  result += glueOrphanPunctuation(html.slice(lastIndex));
  return result;
}
