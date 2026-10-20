import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import pl from "@/messages/pl.json";

import { flattenMessages } from "@/lib/i18n/utils";

/**
 * Bundled UI dictionaries. A registered locale missing from this map falls
 * back to English per key (ADR-0007 A8). Add a static import here when a
 * generated `messages/<code>.json` is ready to ship in the client bundle.
 */
const RAW_CATALOGS: Record<string, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  pt: pt as Record<string, unknown>,
  ru: ru as Record<string, unknown>,
  de: de as Record<string, unknown>,
  fr: fr as Record<string, unknown>,
  pl: pl as Record<string, unknown>,
};

const FLAT_CACHE = new Map<string, Record<string, string>>();

export function listBundledMessageLocales(): string[] {
  return Object.keys(RAW_CATALOGS);
}

/** Flat dictionary for a locale, or empty when no messages file is bundled. */
export function getFlatMessages(locale: string): Record<string, string> {
  const code = locale.trim().toLowerCase();
  const cached = FLAT_CACHE.get(code);
  if (cached) return cached;
  const raw = RAW_CATALOGS[code];
  const flat = raw ? flattenMessages(raw) : {};
  FLAT_CACHE.set(code, flat);
  return flat;
}

export function getEnglishMessages(): Record<string, string> {
  return getFlatMessages("en");
}
