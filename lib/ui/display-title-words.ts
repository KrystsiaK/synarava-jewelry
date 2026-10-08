/**
 * Storefront display-title wrap units.
 *
 * Whitespace splits alone leave punctuation (especially middle dot `·`) as its
 * own token. With DisplayHeading reveal masks (`inline-block` per token) that
 * token can start a line: "браслет" / "· 8 мм". Glue orphan marks to the
 * previous word with NBSP so CSS and reveal spans keep them together.
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

export function isOrphanPunctuationToken(token: string): boolean {
  if (!token) return false;
  if (ORPHAN_PUNCT_TOKEN.test(token)) return true;
  return LEADING_ORPHAN_PUNCT.test(token);
}

/** Split a display title into wrap units; punctuation binds to the prior word. */
export function displayTitleWords(text: string): string[] {
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

/** Plain-text title with the same NBSP glue (product cards, related rails). */
export function formatDisplayTitle(text: string): string {
  return displayTitleWords(text).join(" ");
}
