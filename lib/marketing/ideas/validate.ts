import {
  CLAIM_GUARD_TERMS,
  claimCoveredByFacts,
  claimTermPresent,
} from "@/lib/ai/product-content/validate";
import type { LocalizedCopy } from "@/lib/marketing/ideas/localized";
import {
  localizedCopyBlob,
  normalizeLocalizedCopy,
} from "@/lib/marketing/ideas/localized";
import {
  dropNearDuplicateIdeas,
  type PriorIdeaSummary,
} from "@/lib/marketing/ideas/memory";
import type { RawMarketingIdea } from "@/lib/marketing/ideas/schema";
import type { MarketSignal } from "@/lib/marketing/signals";

export type ValidatedMarketingIdea = {
  productIds: string[];
  signalIds: string[];
  whyRu: string;
  script: string;
  shotList: string[];
  hook: LocalizedCopy;
  caption: LocalizedCopy;
  weekSlot: 1 | 2 | 3 | 4;
};

export type IdeaValidationResult = {
  ideas: ValidatedMarketingIdea[];
  warnings: string[];
};

function isWeekSlot(value: number): value is 1 | 2 | 3 | 4 {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/**
 * Owner-facing RU fields: among letter characters, Cyrillic share must be ≥ 50%.
 * Latin product/brand names are OK under that threshold (no new deps).
 */
function hasMostlyCyrillicLetters(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  let cyrillic = 0;
  for (const ch of letters) {
    if (/^\p{Script=Cyrillic}$/u.test(ch)) cyrillic += 1;
  }
  return cyrillic / letters.length >= 0.5;
}

function parseLocalized(
  value: unknown,
): LocalizedCopy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.en !== "string" || typeof record.pt !== "string") return null;
  return normalizeLocalizedCopy(record);
}

/**
 * Drop invalid ideas with a warning — never silently fix.
 * - productIds ⊂ input
 * - signalIds ⊂ input
 * - owner fields (whyRu, script, shotList) required Russian text
 * - audience hook/caption require both en and pt
 * - claim-guard on all text in all languages
 * - near-duplicate hooks vs prior + within batch
 */
export function validateMarketingIdeas(input: {
  rawIdeas: unknown;
  allowedProductIds: ReadonlySet<string>;
  allowedSignalIds: ReadonlySet<string>;
  /** productId → lowercased facts corpus */
  productFactsCorpus: ReadonlyMap<string, string>;
  signals: readonly MarketSignal[];
  /** Prior ideas for duplicate filter (hooks already normalized). */
  priorIdeas?: readonly PriorIdeaSummary[];
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

  void input.signals;

  for (const [index, item] of list.entries()) {
    const label = `idea[${index}]`;
    if (!item || typeof item !== "object") {
      warnings.push(`${label}: not an object — dropped`);
      continue;
    }
    const raw = item as Partial<RawMarketingIdea>;
    if (!Array.isArray(raw.productIds) || raw.productIds.length === 0) {
      warnings.push(`${label}: productIds required — dropped`);
      continue;
    }
    if (!Array.isArray(raw.signalIds)) {
      warnings.push(`${label}: signalIds must be an array — dropped`);
      continue;
    }
    if (typeof raw.whyRu !== "string" || !raw.whyRu.trim()) {
      warnings.push(`${label}: whyRu required — dropped`);
      continue;
    }
    if (!hasMostlyCyrillicLetters(raw.whyRu)) {
      warnings.push(`${label}: whyRu must be Russian — dropped`);
      continue;
    }
    if (typeof raw.script !== "string" || !raw.script.trim()) {
      warnings.push(`${label}: script required — dropped`);
      continue;
    }
    if (!hasMostlyCyrillicLetters(raw.script)) {
      warnings.push(`${label}: script must be Russian — dropped`);
      continue;
    }
    if (
      !Array.isArray(raw.shotList) ||
      !raw.shotList.every((s) => typeof s === "string") ||
      raw.shotList.every((s) => !String(s).trim())
    ) {
      warnings.push(`${label}: shotList required — dropped`);
      continue;
    }
    if (
      raw.shotList.some(
        (s) => String(s).trim() && !hasMostlyCyrillicLetters(String(s)),
      )
    ) {
      warnings.push(`${label}: shotList must be Russian — dropped`);
      continue;
    }
    const hook = parseLocalized(raw.hook);
    const caption = parseLocalized(raw.caption);
    if (!hook || !hook.en.trim() || !hook.pt.trim()) {
      warnings.push(`${label}: hook.en and hook.pt required — dropped`);
      continue;
    }
    if (!caption || !caption.en.trim() || !caption.pt.trim()) {
      warnings.push(`${label}: caption.en and caption.pt required — dropped`);
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

    const textBlob = [
      raw.whyRu,
      raw.script,
      ...raw.shotList,
      localizedCopyBlob(hook),
      localizedCopyBlob(caption),
    ].join("\n");

    let claimFail: string | null = null;
    for (const { term, label: claimLabel } of CLAIM_GUARD_TERMS) {
      if (!claimTermPresent(textBlob, term)) continue;
      if (claimCoveredByFacts(productCorpus, term)) continue;
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
      productIds,
      signalIds,
      whyRu: raw.whyRu.trim(),
      script: raw.script.trim(),
      shotList: raw.shotList.map((s) => s.trim()).filter(Boolean),
      hook: { en: hook.en.trim(), pt: hook.pt.trim() },
      caption: { en: caption.en.trim(), pt: caption.pt.trim() },
      weekSlot: raw.weekSlot,
    });
  }

  const deduped = dropNearDuplicateIdeas({
    ideas,
    priorHooks: (input.priorIdeas ?? []).map((p) => p.hooks),
  });

  return {
    ideas: deduped.ideas,
    warnings: [...warnings, ...deduped.warnings],
  };
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
