import {
  normalizeRichTextForStorage,
  plainTextFromRichText,
} from "@/lib/content/rich-text";
import type {
  AiField,
  AiLocale,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";
import { factsCorpus, type ProductContentFacts } from "@/lib/ai/product-content/facts";
import { BANNED_CLICHES } from "@/lib/ai/product-content/prompt";
import { productContentLocalesSchema } from "@/lib/ai/product-content/schema";

export { productContentLocalesSchema, geminiLocalesSchema } from "@/lib/ai/product-content/schema";

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

/** Claim words that must appear in product facts when used in generated copy. */
export const CLAIM_GUARD_TERMS: { term: string; label: string }[] = [
  { term: "925", label: "925" },
  { term: "sterling", label: "sterling" },
  { term: "silver", label: "silver" },
  { term: "prata", label: "prata" },
  { term: "серебро", label: "серебро" },
  { term: "серебра", label: "серебра" },
  { term: "gold", label: "gold" },
  { term: "ouro", label: "ouro" },
  { term: "золото", label: "золото" },
  { term: "золота", label: "золота" },
  { term: "18k", label: "18K" },
  { term: "hypoallergenic", label: "hypoallergenic" },
  { term: "hipoalergénic", label: "hipoalergénico" },
  { term: "hipoalergenic", label: "hipoalergénico" },
  { term: "гипоаллерген", label: "гипоаллергенный" },
  { term: "waterproof", label: "waterproof" },
  { term: "à prova de água", label: "à prova de água" },
  { term: "водонепроницаем", label: "водонепроницаемый" },
  { term: "certified", label: "certified" },
  { term: "certificado", label: "certificado" },
  { term: "сертифиц", label: "сертифицированный" },
  { term: "gemstone", label: "gemstone" },
  { term: "gemstones", label: "gemstones" },
  { term: "pedra preciosa", label: "pedra preciosa" },
  { term: "драгоценн", label: "драгоценный камень" },
  { term: "diamond", label: "diamond" },
  { term: "diamante", label: "diamante" },
  { term: "бриллиант", label: "бриллиант" },
  { term: "pearl", label: "pearl" },
  { term: "pérola", label: "pérola" },
  { term: "жемчуг", label: "жемчуг" },
  // Invented commerce / quantity / packaging / warranty (EN / PT / RU)
  { term: "single", label: "single" },
  { term: "pair", label: "pair" },
  { term: "set", label: "set" },
  { term: "par", label: "par" },
  { term: "conjunto", label: "conjunto" },
  { term: "пара", label: "пара" },
  { term: "одна", label: "одна" },
  { term: "комплект", label: "комплект" },
  { term: "gift box", label: "gift box" },
  { term: "warranty", label: "warranty" },
  { term: "garantia", label: "garantia" },
  { term: "гарантия", label: "гарантия" },
];

/** Cross-language material synonyms — any member present in facts covers the group. */
const CLAIM_SYNONYM_GROUPS: string[][] = [
  ["gold", "ouro", "золото", "золота"],
  ["silver", "prata", "серебро", "серебра"],
  ["pearl", "pérola", "жемчуг"],
  ["diamond", "diamante", "бриллиант"],
  ["hypoallergenic", "hipoalergénic", "hipoalergenic", "гипоаллерген"],
  ["waterproof", "à prova de água", "водонепроницаем"],
  ["certified", "certificado", "сертифиц"],
  ["gemstone", "gemstones", "pedra preciosa", "драгоценн"],
  ["pair", "par", "пара"],
  ["set", "conjunto", "комплект"],
  ["warranty", "garantia", "гарантия"],
];

const TEST_SOURCE_PATTERNS: RegExp[] = [
  /\blorem\s+ipsum\b/iu,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bplaceholder\b/iu,
  /\btest[\s_-]*product\b/iu,
  /\bsample\s+text\b/iu,
  /\bdummy\b/iu,
  /\basdf\b/iu,
  /\bqwerty\b/iu,
  /\bxxx+\b/iu,
];

/** Truncated roots that must match as token prefixes. */
const CLAIM_STEM_TERMS = new Set([
  "hipoalergénic",
  "hipoalergenic",
  "гипоаллерген",
  "водонепроницаем",
  "сертифиц",
  "драгоценн",
]);

function trimField(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampPlain(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize claim text: lowercase, unify hyphens/spaces around karat (18K / 18-k / 18 k).
 */
export function normalizeClaimText(text: string): string {
  return text
    .toLowerCase()
    .replace(/(\d+)\s*[-–—]?\s*k(?:arat|t)?\b/giu, "$1k")
    .replace(/(\d+)\s*[-–—]?\s*к(?:арат)?\b/giu, "$1k");
}

/**
 * Hyphen continues a compound token so "silver" does not match "silver-plated".
 * Stem terms match a token prefix only. Operates on already-normalized text.
 */
export function claimTermPresent(haystack: string, term: string): boolean {
  const h = normalizeClaimText(haystack);
  const t = normalizeClaimText(term);
  const escaped = escapeRegExp(t);
  const flags = "iu";
  if (CLAIM_STEM_TERMS.has(term.toLowerCase()) || CLAIM_STEM_TERMS.has(t)) {
    return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}`, flags).test(h);
  }
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, flags).test(h);
}

function synonymGroupFor(term: string): string[] {
  const normalized = normalizeClaimText(term);
  for (const group of CLAIM_SYNONYM_GROUPS) {
    if (group.some((g) => normalizeClaimText(g) === normalized)) return group;
  }
  return [term];
}

function claimCoveredByFacts(corpus: string, term: string): boolean {
  return synonymGroupFor(term).some((alias) => claimTermPresent(corpus, alias));
}

function collectClaimWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
  corpus: string,
): ProductContentDraft["warnings"] {
  const warnings: ProductContentDraft["warnings"] = [];
  for (const { term, label } of CLAIM_GUARD_TERMS) {
    if (!claimTermPresent(text, term)) continue;
    if (claimCoveredByFacts(corpus, term)) continue;
    warnings.push({
      locale,
      field,
      message: `Possible invented claim "${label}" not found in product facts`,
    });
  }
  return warnings;
}

function collectClicheWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
): ProductContentDraft["warnings"] {
  const lower = text.toLowerCase();
  const warnings: ProductContentDraft["warnings"] = [];
  for (const { locale: scope, phrase } of BANNED_CLICHES) {
    if (scope !== "all" && scope !== locale) continue;
    if (lower.includes(phrase.toLowerCase())) {
      warnings.push({
        locale,
        field,
        message: `cliché: "${phrase}"`,
      });
    }
  }
  return warnings;
}

function collectTestSourceWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
): ProductContentDraft["warnings"] {
  for (const pattern of TEST_SOURCE_PATTERNS) {
    if (pattern.test(text)) {
      return [
        {
          locale,
          field,
          message: "test-source leakage detected in generated copy",
        },
      ];
    }
  }
  return [];
}

/** RU fields should be Cyrillic — warn on Latin jewelry words not present in facts. */
function collectRuForeignLatinWarnings(
  field: AiField,
  text: string,
  corpus: string,
): ProductContentDraft["warnings"] {
  const warnings: ProductContentDraft["warnings"] = [];
  const latinWords = text.match(/\b[A-Za-z]{3,}\b/g) ?? [];
  const allow = new Set(
    ["synarava", "pvd", "seo", "html", "mm", "cm"].map((w) => w.toLowerCase()),
  );
  for (const word of latinWords) {
    const lower = word.toLowerCase();
    if (allow.has(lower)) continue;
    if (claimTermPresent(corpus, lower)) continue;
    // Brand/product tokens already in facts (case-insensitive substring after normalize).
    if (normalizeClaimText(corpus).includes(normalizeClaimText(word))) continue;
    warnings.push({
      locale: "ru",
      field,
      message: `RU foreign latin: "${word}"`,
    });
  }
  return warnings;
}

/** Numbers / sizes / karat figures in copy must appear in facts. */
function collectUnsupportedNumberWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
  corpus: string,
): ProductContentDraft["warnings"] {
  const warnings: ProductContentDraft["warnings"] = [];
  const normalizedCorpus = normalizeClaimText(corpus);
  const matches = text.match(/\d+(?:[.,]\d+)?(?:\s*(?:mm|cm|k|кт))?/giu) ?? [];
  for (const raw of matches) {
    const token = normalizeClaimText(raw.replace(/\s+/g, ""));
    if (!token) continue;
    // Bare single digits often appear in lists — still require presence when multi-digit or unit.
    if (/^\d$/.test(token)) continue;
    if (normalizedCorpus.includes(token)) continue;
    // Also accept with space variants already normalized (18k).
    if (claimTermPresent(corpus, token)) continue;
    warnings.push({
      locale,
      field,
      message: `unsupported number "${raw.trim()}" not found in product facts`,
    });
  }
  return warnings;
}

function collectFieldQualityWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
  corpus: string,
): ProductContentDraft["warnings"] {
  return [
    ...collectClaimWarnings(locale, field, text, corpus),
    ...collectClicheWarnings(locale, field, text),
    ...collectTestSourceWarnings(locale, field, text),
    ...collectUnsupportedNumberWarnings(locale, field, text, corpus),
    ...(locale === "ru" ? collectRuForeignLatinWarnings(field, text, corpus) : []),
  ];
}

export type ValidatedLocales = {
  locales: ProductContentDraft["locales"];
  warnings: ProductContentDraft["warnings"];
};

/**
 * Zod-parse + sanitize + claim-guard + quality checks.
 * Never throws — returns null on invalid JSON/shape.
 */
export function validateAndNormalizeDraftLocales(
  raw: string | unknown,
  facts: ProductContentFacts,
  requestedLocales: AiLocale[],
): ValidatedLocales | null {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const result = productContentLocalesSchema.safeParse(parsed);
  if (!result.success) return null;

  const corpus = factsCorpus(facts);
  const locales: ProductContentDraft["locales"] = {};
  const warnings: ProductContentDraft["warnings"] = [];
  const requested = new Set(requestedLocales);

  for (const locale of requested) {
    const rawLocale = result.data.locales[locale];
    if (!rawLocale) {
      warnings.push({
        locale,
        field: "shortDescription",
        message: "empty locale output",
      });
      continue;
    }

    const next: Partial<Record<AiField, string>> = {};

    if (locale !== "en") {
      const title = trimField(rawLocale.title);
      if (title) {
        next.title = title;
        warnings.push(...collectFieldQualityWarnings(locale, "title", title, corpus));
      }
    }

    const shortDescription = trimField(rawLocale.shortDescription);
    if (shortDescription) {
      next.shortDescription = shortDescription;
      warnings.push(
        ...collectFieldQualityWarnings(locale, "shortDescription", shortDescription, corpus),
      );
    }

    const descriptionRaw = trimField(rawLocale.description);
    if (descriptionRaw) {
      const description = normalizeRichTextForStorage(descriptionRaw);
      if (description) {
        next.description = description;
        warnings.push(
          ...collectFieldQualityWarnings(
            locale,
            "description",
            plainTextFromRichText(description),
            corpus,
          ),
        );
      }
    }

    const seoTitle = trimField(rawLocale.seoTitle);
    if (seoTitle) {
      const clipped = clampPlain(seoTitle, SEO_TITLE_MAX);
      next.seoTitle = clipped;
      warnings.push(...collectFieldQualityWarnings(locale, "seoTitle", clipped, corpus));
    }

    const seoDescription = trimField(rawLocale.seoDescription);
    if (seoDescription) {
      const clipped = clampPlain(seoDescription, SEO_DESCRIPTION_MAX);
      next.seoDescription = clipped;
      warnings.push(
        ...collectFieldQualityWarnings(locale, "seoDescription", clipped, corpus),
      );
    }

    if (Object.keys(next).length > 0) {
      locales[locale] = next;
    } else {
      warnings.push({
        locale,
        field: "shortDescription",
        message: "empty locale output",
      });
    }
  }

  // Hard rule: en.title must never appear even if model smuggled it.
  if (locales.en && "title" in (locales.en as Record<string, unknown>)) {
    const rest = { ...locales.en };
    delete rest.title;
    locales.en = rest;
  }

  return { locales, warnings };
}
