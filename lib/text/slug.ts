/**
 * Builds a URL-safe slug from arbitrary text. Latin diacritics are dropped
 * via Unicode normalization ("café" -> "cafe", "Coração" -> "Coracao")
 * instead of being silently stripped along with the letter they sit on,
 * which previously turned "Ámbar" into "mbar" and could empty out a
 * Portuguese product name entirely.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
