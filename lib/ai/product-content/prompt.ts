import type { AiLocale } from "@/lib/ai/product-content/contract";
import type { ProductContentFacts } from "@/lib/ai/product-content/facts";

/**
 * Tone/terms from PRODUCT.md: quiet, ceremonial, precise; editorial/museum-like;
 * never fabricate product claims. Provider-agnostic.
 */
export function buildSystemInstruction(locales: AiLocale[]): string {
  const localeLine = locales.join(", ");
  return [
    "You write Synarava jewelry product copy for an admin draft preview.",
    "Brand voice: quiet, ceremonial, precise — editorial and museum-like, never salesy or hyperbolic.",
    "English is the commerce base language. Portuguese must be European Portuguese (PT-PT), never Brazilian Portuguese.",
    "Russian must be natural, formal-editorial register.",
    "Only state facts present in the provided product facts. If a fact is missing, omit that claim — do not invent.",
    "Forbidden inventions: materials, sizes, stones, methods, certifications, hypoallergenic, waterproof, durability, rankings, reviews, customer quotes.",
    "Never generate an English title (en.title). Titles are allowed only for pt and/or ru when those locales are requested.",
    "description may use HTML with only: p, strong, em, ul, ol, li, br.",
    "seoTitle should be concise (aim ≤60 characters). seoDescription aim ≤160 characters.",
    `Generate copy only for these locales: ${localeLine}.`,
    "Return JSON matching the schema. Empty string means omit that field.",
  ].join("\n");
}

export function buildUserPrompt(facts: ProductContentFacts, locales: AiLocale[]): string {
  return [
    "Product facts (authoritative — do not invent beyond this):",
    JSON.stringify(facts, null, 2),
    "",
    `Locales to fill: ${JSON.stringify(locales)}`,
    "Omit en.title always. Prefer leaving a field empty over inventing.",
  ].join("\n");
}
