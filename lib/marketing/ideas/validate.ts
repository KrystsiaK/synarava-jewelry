import {
  CLAIM_GUARD_TERMS,
  claimTermPresent,
} from "@/lib/ai/product-content/validate";
import type { MarketSignal } from "@/lib/marketing/signals";
import type { RawMarketingIdea } from "@/lib/marketing/ideas/schema";

export type ValidatedMarketingIdea = {
  locale: "en" | "pt";
  productIds: string[];
  signalIds: string[];
  hook: string;
  script: string;
  shotList: string[];
  caption: string;
  weekSlot: 1 | 2 | 3 | 4;
};

export type IdeaValidationResult = {
  ideas: ValidatedMarketingIdea[];
  warnings: string[];
};

function isLocale(value: string): value is "en" | "pt" {
  return value === "en" || value === "pt";
}

function isWeekSlot(value: number): value is 1 | 2 | 3 | 4 {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function corpusHasClaim(corpus: string, term: string): boolean {
  return claimTermPresent(corpus, term);
}

/**
 * Drop invalid ideas with a warning — never silently fix.
 * - productIds ⊂ input
 * - signalIds ⊂ input
 * - claim-guard against referenced products' factsCorpus
 * - competitor claims only if a cited signal contains them
 */
export function validateMarketingIdeas(input: {
  rawIdeas: unknown;
  allowedProductIds: ReadonlySet<string>;
  allowedSignalIds: ReadonlySet<string>;
  /** productId → lowercased facts corpus */
  productFactsCorpus: ReadonlyMap<string, string>;
  signals: readonly MarketSignal[];
}): IdeaValidationResult {
  const warnings: string[] = [];
  const ideas: ValidatedMarketingIdea[] = [];

  const list =
    input.rawIdeas &&
    typeof input.rawIdeas === "object" &&
    Array.isArray((input.rawIdeas as { ideas?: unknown }).ideas)
      ? ((input.rawIdeas as { ideas: unknown[] }).ideas)
      : Array.isArray(input.rawIdeas)
        ? input.rawIdeas
        : null;

  if (!list) {
    return { ideas: [], warnings: ["ideas response missing ideas array"] };
  }

  const signalCorpus = new Map(
    input.signals.map((s) => [
      s.id,
      `${s.summary} ${JSON.stringify(s.data)}`.toLowerCase(),
    ]),
  );

  for (const [index, item] of list.entries()) {
    const label = `idea[${index}]`;
    if (!item || typeof item !== "object") {
      warnings.push(`${label}: not an object — dropped`);
      continue;
    }
    const raw = item as Partial<RawMarketingIdea>;
    const localeRaw = String(raw.locale ?? "");
    if (!isLocale(localeRaw)) {
      warnings.push(`${label}: invalid locale — dropped`);
      continue;
    }
    const locale = localeRaw;
    if (!Array.isArray(raw.productIds) || raw.productIds.length === 0) {
      warnings.push(`${label}: productIds required — dropped`);
      continue;
    }
    if (!Array.isArray(raw.signalIds)) {
      warnings.push(`${label}: signalIds must be an array — dropped`);
      continue;
    }
    if (
      typeof raw.hook !== "string" ||
      typeof raw.script !== "string" ||
      typeof raw.caption !== "string" ||
      !Array.isArray(raw.shotList) ||
      !raw.shotList.every((s) => typeof s === "string")
    ) {
      warnings.push(`${label}: missing text fields — dropped`);
      continue;
    }
    if (typeof raw.weekSlot !== "number" || !isWeekSlot(raw.weekSlot)) {
      warnings.push(`${label}: weekSlot must be 1–4 — dropped`);
      continue;
    }

    const productIds = raw.productIds.map(String);
    const signalIds = raw.signalIds.map(String);

    if (productIds.some((id) => !input.allowedProductIds.has(id))) {
      warnings.push(`${label}: unknown productId — dropped`);
      continue;
    }
    if (signalIds.some((id) => !input.allowedSignalIds.has(id))) {
      warnings.push(`${label}: unknown signalId — dropped`);
      continue;
    }

    const productCorpus = productIds
      .map((id) => input.productFactsCorpus.get(id) ?? "")
      .join("\n")
      .toLowerCase();
    const citedSignalCorpus = signalIds
      .map((id) => signalCorpus.get(id) ?? "")
      .join("\n");

    const textBlob = [raw.hook, raw.script, raw.caption, ...raw.shotList].join(
      "\n",
    );
    let claimFail: string | null = null;
    for (const { term, label: claimLabel } of CLAIM_GUARD_TERMS) {
      if (!claimTermPresent(textBlob, term)) continue;
      if (corpusHasClaim(productCorpus, term)) continue;
      // Competitor claims allowed only when a cited signal carries them.
      if (signalIds.length > 0 && corpusHasClaim(citedSignalCorpus, term)) continue;
      claimFail = claimLabel;
      break;
    }
    if (claimFail) {
      warnings.push(
        `${label}: invented claim "${claimFail}" not in product facts — dropped`,
      );
      continue;
    }

    ideas.push({
      locale,
      productIds,
      signalIds,
      hook: raw.hook.trim(),
      script: raw.script.trim(),
      shotList: raw.shotList.map((s) => s.trim()).filter(Boolean),
      caption: raw.caption.trim(),
      weekSlot: raw.weekSlot,
    });
  }

  return { ideas, warnings };
}

/** Map weekSlot 1–4 → a calendar day within the next 4 weeks (UTC noon). */
export function plannedForFromWeekSlot(
  weekSlot: 1 | 2 | 3 | 4,
  now = new Date(),
): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0),
  );
  const dayOffset = (weekSlot - 1) * 7 + 1;
  return new Date(start.getTime() + dayOffset * 24 * 60 * 60 * 1000);
}
