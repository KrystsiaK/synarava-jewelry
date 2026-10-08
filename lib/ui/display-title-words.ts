/**
 * Display-title wrap units — thin adapter over the shared orphan-punctuation
 * text layer. Prefer `@/lib/text/glue-orphan-punctuation` for non-title copy.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-wrap
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap
 */

import {
  glueOrphanPunctuation,
  isOrphanPunctuationToken,
  orphanPunctuationWrapUnits,
} from "@/lib/text/glue-orphan-punctuation";

export { isOrphanPunctuationToken };

/** Split a display title into wrap units; punctuation binds to the prior word. */
export function displayTitleWords(text: string): string[] {
  return orphanPunctuationWrapUnits(text);
}

/** Plain-text title with the same NBSP glue (product cards, related rails). */
export function formatDisplayTitle(text: string): string {
  return glueOrphanPunctuation(text.trim());
}
