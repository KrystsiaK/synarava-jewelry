import { db } from "@/lib/db";

export type StorefrontLocaleRecord = {
  id: string;
  code: string;
  routeSegment: string;
  shopifyLocale: string;
  intlLocale: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isPublished: boolean;
  sortOrder: number;
  shopifyUpdatedAt: Date | null;
};

export async function listStorefrontLocales(): Promise<StorefrontLocaleRecord[]> {
  return db.storefrontLocale.findMany({ orderBy: { sortOrder: "asc" } });
}

/**
 * Route segments that appear more than once. The DB's unique constraint
 * should make this impossible, but the admin view checks it defensively so
 * a conflict is surfaced instead of one row silently winning.
 */
export function findDuplicateRouteSegments(
  locales: Array<Pick<StorefrontLocaleRecord, "routeSegment">>,
): string[] {
  const counts = new Map<string, number>();
  for (const locale of locales) counts.set(locale.routeSegment, (counts.get(locale.routeSegment) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([segment]) => segment);
}

/** Exactly one locale must be the `en` source; anything else is a data problem. */
export function findEnglishSourceViolation(
  locales: Array<Pick<StorefrontLocaleRecord, "code" | "isDefault">>,
): string | null {
  const defaults = locales.filter((locale) => locale.isDefault);
  if (defaults.length === 0) return "No locale is marked as the default source.";
  if (defaults.length > 1) {
    return `Multiple locales are marked default: ${defaults.map((locale) => locale.code).join(", ")}.`;
  }
  if (defaults[0].code !== "en") return `The default locale must be "en", found "${defaults[0].code}".`;
  return null;
}
