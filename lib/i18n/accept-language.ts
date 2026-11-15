/**
 * Negotiate a published storefront route segment from Accept-Language.
 * Primary language subtag only (pt-PT / pt-BR → pt). Respects q-weights.
 * https://httpwg.org/specs/rfc9110.html#field.accept-language
 */

type WeightedTag = { tag: string; q: number; order: number };

function parseAcceptLanguage(header: string): WeightedTag[] {
  const parts = header.split(",");
  const tags: WeightedTag[] = [];

  for (let order = 0; order < parts.length; order += 1) {
    const raw = parts[order]?.trim();
    if (!raw) continue;

    const [tagPart, ...params] = raw.split(";").map((piece) => piece.trim());
    if (!tagPart || tagPart === "*") continue;

    // Loose language-tag shape: letters + optional -subtags. Reject garbage.
    if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/.test(tagPart)) continue;

    let q = 1;
    for (const param of params) {
      const match = /^q=(0(?:\.\d{1,3})?|1(?:\.0{1,3})?)$/i.exec(param);
      if (!match) {
        q = Number.NaN;
        break;
      }
      q = Number.parseFloat(match[1] ?? "1");
    }
    if (!Number.isFinite(q) || q <= 0) continue;

    tags.push({ tag: tagPart, q, order });
  }

  return tags.toSorted((a, b) => b.q - a.q || a.order - b.order);
}

/** Best published route segment for the header, or null if none match. */
export function matchPublishedLocaleFromAcceptLanguage(
  header: string | null | undefined,
  publishedSegments: readonly string[],
): string | null {
  if (!header || publishedSegments.length === 0) return null;

  const published = new Set(publishedSegments);
  for (const { tag } of parseAcceptLanguage(header)) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (primary && published.has(primary)) return primary;
  }
  return null;
}
