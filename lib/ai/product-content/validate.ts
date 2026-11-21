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
];

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

/** Truncated roots that must match as token prefixes (e.g. гипоаллерген → гипоаллергенный). */
const CLAIM_STEM_TERMS = new Set([
  "hipoalergénic",
  "hipoalergenic",
  "гипоаллерген",
  "водонепроницаем",
  "сертифиц",
  "драгоценн",
]);

/**
 * Hyphen continues a compound token so "silver" does not match "silver-plated".
 * Stem terms match a token prefix only.
 */
export function claimTermPresent(haystack: string, term: string): boolean {
  const t = term.toLowerCase();
  const escaped = escapeRegExp(t);
  const flags = "iu";
  if (CLAIM_STEM_TERMS.has(t)) {
    return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}`, flags).test(haystack);
  }
  return new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, flags).test(
    haystack,
  );
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
    if (claimTermPresent(corpus, term)) continue;
    warnings.push({
      locale,
      field,
      message: `Possible invented claim "${label}" not found in product facts`,
    });
  }
  return warnings;
}

export type ValidatedLocales = {
  locales: ProductContentDraft["locales"];
  warnings: ProductContentDraft["warnings"];
};

/**
 * Zod-parse + sanitize + claim-guard. Never throws — returns null on invalid JSON/shape.
 * Accepts raw JSON text or already-parsed unknown.
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
    const raw = result.data.locales[locale];
    if (!raw) continue;

    const next: Partial<Record<AiField, string>> = {};

    if (locale !== "en") {
      const title = trimField(raw.title);
      if (title) {
        next.title = title;
        warnings.push(...collectClaimWarnings(locale, "title", title, corpus));
      }
    }

    const shortDescription = trimField(raw.shortDescription);
    if (shortDescription) {
      next.shortDescription = shortDescription;
      warnings.push(
        ...collectClaimWarnings(locale, "shortDescription", shortDescription, corpus),
      );
    }

    const descriptionRaw = trimField(raw.description);
    if (descriptionRaw) {
      const description = normalizeRichTextForStorage(descriptionRaw);
      if (description) {
        next.description = description;
        warnings.push(
          ...collectClaimWarnings(
            locale,
            "description",
            plainTextFromRichText(description),
            corpus,
          ),
        );
      }
    }

    const seoTitle = trimField(raw.seoTitle);
    if (seoTitle) {
      const clipped = clampPlain(seoTitle, SEO_TITLE_MAX);
      next.seoTitle = clipped;
      warnings.push(...collectClaimWarnings(locale, "seoTitle", clipped, corpus));
    }

    const seoDescription = trimField(raw.seoDescription);
    if (seoDescription) {
      const clipped = clampPlain(seoDescription, SEO_DESCRIPTION_MAX);
      next.seoDescription = clipped;
      warnings.push(
        ...collectClaimWarnings(locale, "seoDescription", clipped, corpus),
      );
    }

    if (Object.keys(next).length > 0) {
      locales[locale] = next;
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
