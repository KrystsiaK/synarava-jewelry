/**
 * Serializes a JSON-LD object for a <script> tag, escaping `<`, `>`, and `&`
 * so a value containing e.g. "</script>" can't break out of the tag or be
 * misread as HTML.
 */
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
