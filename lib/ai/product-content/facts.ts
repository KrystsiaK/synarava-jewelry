import { getMaxInputChars } from "@/lib/ai/config";
import { parseProductDetails } from "@/lib/content/product-details";
import { plainTextFromRichText } from "@/lib/content/rich-text";

export type ProductContentFacts = {
  productId: string;
  name: string;
  productType: string | null;
  materialLine: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  detailsAttributes: { label: string; value: string }[];
  characteristics: { key: string; label: string; value: string }[];
  collections: string[];
  translations: {
    locale: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    materialLine: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
};

type CharacteristicRow = {
  key: string;
  label: string;
  textValue: string | null;
  numberValue: { toString(): string } | number | null;
  booleanValue: boolean | null;
  unit: string | null;
};

type TranslationRow = {
  locale: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  materialLine: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

type CollectionLink = {
  collection: { name: string };
};

export type ProductForFacts = {
  id: string;
  name: string;
  productType: string | null;
  materialLine: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  details: unknown;
  characteristics: CharacteristicRow[];
  collections: CollectionLink[];
  translations: TranslationRow[];
};

function characteristicValue(row: CharacteristicRow): string {
  if (row.textValue?.trim()) {
    return row.unit ? `${row.textValue.trim()} ${row.unit}` : row.textValue.trim();
  }
  if (row.numberValue != null) {
    const n = typeof row.numberValue === "number" ? String(row.numberValue) : row.numberValue.toString();
    return row.unit ? `${n} ${row.unit}` : n;
  }
  if (row.booleanValue != null) return row.booleanValue ? "yes" : "no";
  return "";
}

/**
 * Detect instruction-smuggling / jailbreak phrases in free-text fact fields.
 * High-precision: only drops clearly instructional sentences, not product copy.
 */
export function isPromptInjectionLike(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\bignore\b[\s\S]{0,80}\binstructions?\b/iu.test(t) ||
    /\bdisregard\b[\s\S]{0,80}\binstructions?\b/iu.test(t) ||
    /\bsystem\s*:/iu.test(t) ||
    /\byou\s+(?:are|must)\s+now\b/iu.test(t) ||
    /\balways\s+(?:claim|say|output|respond|write|assert)\b/iu.test(t) ||
    /\bdo\s+not\s+follow\b[\s\S]{0,40}\b(?:rules?|instructions?)\b/iu.test(t) ||
    /\bnew\s+instructions?\b/iu.test(t) ||
    /\boverride\b[\s\S]{0,40}\b(?:system|rules?|instructions?)\b/iu.test(t) ||
    /\byou\s+must\s+say\b/iu.test(t)
  );
}

/** Drop injection-like sentences; clear short fields that are entirely instructional. */
export function scrubPromptInjectionText(text: string | null): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return text;
  if (isPromptInjectionLike(trimmed) && trimmed.length <= 280) {
    return null;
  }
  const parts = trimmed.split(/(?<=[.!?…])\s+|\n+/u);
  const kept = parts.map((p) => p.trim()).filter((p) => p.length > 0 && !isPromptInjectionLike(p));
  if (kept.length === 0) return null;
  return kept.join(" ").trim();
}

/**
 * Scrub instruction-smuggling from free-text fact fields before prompt + claim corpus.
 * Structured keys (productId, productType) are left intact; name falls back to "".
 */
export function scrubPromptInjectionFromFacts(facts: ProductContentFacts): ProductContentFacts {
  const scrubName = scrubPromptInjectionText(facts.name);
  return {
    ...facts,
    name: scrubName ?? "",
    materialLine: scrubPromptInjectionText(facts.materialLine),
    shortDescription: scrubPromptInjectionText(facts.shortDescription),
    description: scrubPromptInjectionText(facts.description),
    seoTitle: scrubPromptInjectionText(facts.seoTitle),
    seoDescription: scrubPromptInjectionText(facts.seoDescription),
    detailsAttributes: facts.detailsAttributes
      .map((a) => ({
        label: scrubPromptInjectionText(a.label) ?? "",
        value: scrubPromptInjectionText(a.value) ?? "",
      }))
      .filter((a) => a.label.length > 0 || a.value.length > 0),
    characteristics: facts.characteristics
      .map((c) => ({
        ...c,
        label: scrubPromptInjectionText(c.label) ?? c.key,
        value: scrubPromptInjectionText(c.value) ?? "",
      }))
      .filter((c) => c.value.length > 0),
    collections: facts.collections
      .map((name) => scrubPromptInjectionText(name))
      .filter((name): name is string => typeof name === "string" && name.length > 0),
    translations: facts.translations.map((t) => ({
      ...t,
      title: scrubPromptInjectionText(t.title) ?? "",
      shortDescription: scrubPromptInjectionText(t.shortDescription),
      description: scrubPromptInjectionText(t.description),
      materialLine: scrubPromptInjectionText(t.materialLine),
      seoTitle: scrubPromptInjectionText(t.seoTitle),
      seoDescription: scrubPromptInjectionText(t.seoDescription),
    })),
  };
}

/** Build prompt facts — product/catalog only; never reviews/orders/customers. */
export function buildProductContentFacts(product: ProductForFacts): ProductContentFacts {
  const details = parseProductDetails(product.details);
  return {
    productId: product.id,
    name: product.name,
    productType: product.productType,
    materialLine: product.materialLine,
    shortDescription: product.shortDescription,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    detailsAttributes: (details.attributes ?? []).map((a) => ({
      label: a.label,
      value: a.value,
    })),
    characteristics: product.characteristics
      .map((row) => ({
        key: row.key,
        label: row.label,
        value: characteristicValue(row),
      }))
      .filter((row) => row.value.length > 0),
    collections: product.collections.map((link) => link.collection.name).filter(Boolean),
    translations: product.translations.map((t) => ({
      locale: t.locale,
      title: t.title,
      shortDescription: t.shortDescription,
      description: t.description,
      materialLine: t.materialLine,
      seoTitle: t.seoTitle,
      seoDescription: t.seoDescription,
    })),
  };
}

/** Flatten facts into a single searchable string for claim/number guards (HTML stripped). */
export function factsCorpus(facts: ProductContentFacts): string {
  const chunks: string[] = [
    facts.name,
    facts.productType ?? "",
    facts.materialLine ?? "",
    facts.shortDescription ?? "",
    facts.description ?? "",
    facts.seoTitle ?? "",
    facts.seoDescription ?? "",
    ...facts.detailsAttributes.flatMap((a) => [a.label, a.value]),
    ...facts.characteristics.flatMap((c) => [c.key, c.label, c.value]),
    ...facts.collections,
    ...facts.translations.flatMap((t) => [
      t.title,
      t.shortDescription ?? "",
      t.description ?? "",
      t.materialLine ?? "",
      t.seoTitle ?? "",
      t.seoDescription ?? "",
    ]),
  ];
  // Strip HTML so measures inside <p>11 mm</p> match generated "11mm" / "11 мм".
  return plainTextFromRichText(chunks.join("\n")).toLowerCase();
}

export function measureFactsChars(facts: ProductContentFacts): number {
  return JSON.stringify(facts).length;
}

/** Truncate at paragraph / sentence boundary when possible. */
export function truncateAtParagraphBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  const breaks = ["\n\n", "\n", ". ", "。", "! ", "? "];
  let cut = -1;
  for (const marker of breaks) {
    const idx = slice.lastIndexOf(marker);
    if (idx > maxLen * 0.4) {
      cut = Math.max(cut, idx + marker.length);
    }
  }
  return (cut > 0 ? slice.slice(0, cut) : slice).trimEnd();
}

function essentialFactsSkeleton(facts: ProductContentFacts): ProductContentFacts {
  return {
    productId: facts.productId,
    name: facts.name,
    productType: facts.productType,
    materialLine: facts.materialLine,
    shortDescription: null,
    description: null,
    seoTitle: null,
    seoDescription: null,
    detailsAttributes: [],
    characteristics: facts.characteristics,
    collections: [],
    translations: [],
  };
}

export type FactsTruncateResult =
  | { ok: true; facts: ProductContentFacts; truncated: boolean; inputChars: number }
  | { ok: false; message: string };

/**
 * Fit facts under AI_MAX_INPUT_CHARS (default 12000).
 * Truncates long fields at paragraph boundaries. If name+characteristics alone
 * exceed the budget → invalid_output (caller must not invoke the provider).
 */
export function truncateFactsForPrompt(
  facts: ProductContentFacts,
  maxChars = getMaxInputChars(),
): FactsTruncateResult {
  if (measureFactsChars(facts) <= maxChars) {
    return { ok: true, facts, truncated: false, inputChars: measureFactsChars(facts) };
  }

  const essential = essentialFactsSkeleton(facts);
  if (measureFactsChars(essential) > maxChars) {
    return {
      ok: false,
      message: "Product facts exceed AI_MAX_INPUT_CHARS even after keeping only name and characteristics",
    };
  }

  let next: ProductContentFacts = {
    ...essential,
    collections: facts.collections,
    detailsAttributes: facts.detailsAttributes,
    shortDescription: facts.shortDescription,
    description: facts.description,
    seoTitle: facts.seoTitle,
    seoDescription: facts.seoDescription,
    translations: facts.translations,
  };

  const shrinkable: Array<() => void> = [
    () => {
      next = { ...next, translations: [] };
    },
    () => {
      next = { ...next, seoTitle: null, seoDescription: null };
    },
    () => {
      next = { ...next, detailsAttributes: [] };
    },
    () => {
      next = { ...next, collections: [] };
    },
    () => {
      if (next.shortDescription && next.shortDescription.length > 200) {
        next = {
          ...next,
          shortDescription: truncateAtParagraphBoundary(next.shortDescription, 200),
        };
      }
    },
    () => {
      if (next.description) {
        const budget = Math.max(400, maxChars - measureFactsChars({ ...next, description: null }));
        next = {
          ...next,
          description: truncateAtParagraphBoundary(next.description, budget),
        };
      }
    },
    () => {
      next = { ...next, shortDescription: null, description: null };
    },
  ];

  for (const step of shrinkable) {
    if (measureFactsChars(next) <= maxChars) break;
    step();
  }

  // Final hard clamp on description if still over.
  if (measureFactsChars(next) > maxChars && next.description) {
    const overhead = measureFactsChars({ ...next, description: "" });
    const room = Math.max(0, maxChars - overhead - 20);
    next = {
      ...next,
      description: room > 0 ? truncateAtParagraphBoundary(next.description, room) : null,
    };
  }

  if (measureFactsChars(next) > maxChars) {
    next = essentialFactsSkeleton(facts);
  }

  if (measureFactsChars(next) > maxChars) {
    return {
      ok: false,
      message: "Product facts exceed AI_MAX_INPUT_CHARS even after keeping only name and characteristics",
    };
  }

  return {
    ok: true,
    facts: next,
    truncated: true,
    inputChars: measureFactsChars(next),
  };
}
