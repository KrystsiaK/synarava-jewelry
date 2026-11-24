/**
 * Shared normalizer for ALL AI text output.
 * Applied once at the ContentProvider boundary so every caller is covered.
 */

/** Zero-width / bidi / BOM / soft hyphen (excl. ZWJ — handled with emoji protection). */
const INVISIBLE_EXCEPT_ZWJ =
  /[\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g;

const ZWJ = "\u200D";

/** NBSP + narrow NBSP → regular space. */
const NBSP_LIKE = /[\u00A0\u202F]/g;

/**
 * Emoji ZWJ sequences (e.g. family 👨‍👩‍👧‍👦).
 * Keep ZWJ only inside these; strip lone / non-emoji ZWJ.
 */
const EMOJI_ZWJ_SEQUENCE =
  /(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?(?:\p{Emoji_Modifier})?)+)/gu;

const PLACEHOLDER_PREFIX = "\uE000AIZWJ";

/** NFC + strip invisibles; keep emoji ZWJ sequences and diacritics; collapse spaces; trim lines. */
export function normalizeAiText(input: string): string {
  const nfc = input.normalize("NFC");

  const stashed: string[] = [];
  const withPlaceholders = nfc.replace(EMOJI_ZWJ_SEQUENCE, (match) => {
    const index = stashed.length;
    stashed.push(match);
    return `${PLACEHOLDER_PREFIX}${index};`;
  });

  const stripped = withPlaceholders
    .replace(INVISIBLE_EXCEPT_ZWJ, "")
    .replaceAll(ZWJ, "")
    .replace(NBSP_LIKE, " ");

  const restored = stripped.replace(
    new RegExp(`${PLACEHOLDER_PREFIX}(\\d+);`, "g"),
    (_m, indexStr: string) => stashed[Number(indexStr)] ?? "",
  );

  return restored
    .split("\n")
    .map((line) => line.replace(/ {2,}/g, " ").trim())
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Recursively normalize every string leaf in a JSON-shaped value (immutable). */
export function normalizeAiJson(value: unknown): unknown {
  if (typeof value === "string") {
    return normalizeAiText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAiJson(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        normalizeAiJson(child),
      ]),
    );
  }
  return value;
}
