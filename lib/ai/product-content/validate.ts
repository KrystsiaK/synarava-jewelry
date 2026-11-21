import { z } from "zod";

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

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;

const localeFieldsSchema = z
  .object({
    title: z.string().optional(),
    shortDescription: z.string().optional(),
    description: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  })
  .strict();

export const geminiLocalesSchema = z
  .object({
    locales: z
      .object({
        en: localeFieldsSchema.optional(),
        pt: localeFieldsSchema.optional(),
        ru: localeFieldsSchema.optional(),
      })
      .strict(),
  })
  .strict();

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

function collectClaimWarnings(
  locale: AiLocale,
  field: AiField,
  text: string,
  corpus: string,
): ProductContentDraft["warnings"] {
  const lower = text.toLowerCase();
  const warnings: ProductContentDraft["warnings"] = [];
  for (const { term, label } of CLAIM_GUARD_TERMS) {
    if (!lower.includes(term.toLowerCase())) continue;
    if (corpus.includes(term.toLowerCase())) continue;
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
 */
export function validateAndNormalizeDraftLocales(
  rawText: string,
  facts: ProductContentFacts,
  requestedLocales: AiLocale[],
): ValidatedLocales | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }

  const result = geminiLocalesSchema.safeParse(parsed);
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
