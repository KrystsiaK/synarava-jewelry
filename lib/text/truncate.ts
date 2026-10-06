/**
 * Shared storefront/CMS plain-text clamp.
 *
 * Truncates on a word boundary and appends an ellipsis when text exceeds
 * `maxLength`. Rejects orphan single-letter / tiny trailing fragments and
 * mid-word cuts whenever a prior word boundary exists — so expand CTAs never
 * follow an ugly break like `…roupa. A…`.
 *
 * CSS `line-clamp` cannot enforce these leftover rules; callers that need a
 * story/excerpt clamp should use this helper (or measure in JS), not CSS alone.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/lastIndexOf
 */

const ELLIPSIS = "…";

/** Minimum letters/digits required in the final kept token before ellipsis. */
const MIN_TRAILING_WORD_CHARS = 3;

const WORD_CHAR_RE = /[\p{L}\p{N}]/gu;
const TRAILING_SEPARATORS_RE = /[\s.,;:!?…\-–—]+$/u;

function significantCharCount(token: string): number {
  return (token.match(WORD_CHAR_RE) ?? []).length;
}

function lastWhitespaceIndex(value: string): number {
  for (let i = value.length - 1; i >= 0; i -= 1) {
    if (/\s/u.test(value[i]!)) return i;
  }
  return -1;
}

function trimTrailingSeparators(value: string): string {
  return value.replace(TRAILING_SEPARATORS_RE, "").trimEnd();
}

/**
 * Drop the final token while it is a tiny leftover (orphan letter, 1–2 char
 * fragment). Stops when the trailing token is substantial enough to read
 * before an expand control.
 */
function peelWeakTrailingWords(value: string): string {
  let candidate = value.trimEnd();
  while (candidate) {
    const boundary = lastWhitespaceIndex(candidate);
    const lastToken = boundary >= 0 ? candidate.slice(boundary + 1) : candidate;
    if (significantCharCount(lastToken) >= MIN_TRAILING_WORD_CHARS) {
      return trimTrailingSeparators(candidate);
    }
    if (boundary < 0) return "";
    candidate = candidate.slice(0, boundary).trimEnd();
  }
  return "";
}

/** Truncates on a word boundary and appends an ellipsis if the text exceeds maxLength. */
export function truncateText(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (maxLength <= 0) return "";
  if (trimmed.length <= maxLength) return trimmed;

  const cut = trimmed.slice(0, maxLength);
  const boundary = lastWhitespaceIndex(cut);

  // Prefer a prior word boundary so we never keep a mid-word fragment when
  // one exists inside the window.
  const atBoundary = boundary > 0 ? cut.slice(0, boundary).trimEnd() : "";
  const peeled = peelWeakTrailingWords(atBoundary);

  if (peeled) return `${peeled}${ELLIPSIS}`;

  // No usable multi-word boundary (single unbroken token longer than max).
  // Last resort: hard cut — unavoidable without exceeding maxLength.
  const hard = trimTrailingSeparators(cut);
  if (hard) return `${hard}${ELLIPSIS}`;
  return ELLIPSIS;
}
