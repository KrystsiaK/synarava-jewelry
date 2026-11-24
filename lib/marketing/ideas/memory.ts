import type { LocalizedCopy } from "@/lib/marketing/ideas/localized";
import { normalizeLocalizedCopy } from "@/lib/marketing/ideas/localized";

export type PriorContentIdea = {
  id: string;
  status: string;
  hook: unknown;
  script: string;
  shotList: unknown;
  caption: unknown;
  whyRu?: string | null;
  productIds: string[];
};

export type PriorIdeaSummary = {
  id: string;
  status: "draft" | "approved" | "rejected" | string;
  hooks: LocalizedCopy;
  script: string;
  rejected: boolean;
};

const MAX_PRIOR = 30;

/** Keep at most `limit` prior ideas (default 30). */
export function takePriorIdeas<T>(ideas: readonly T[], limit = MAX_PRIOR): T[] {
  return ideas.slice(0, Math.max(0, limit));
}

export function summarizePriorIdea(row: PriorContentIdea): PriorIdeaSummary {
  return {
    id: row.id,
    status: row.status,
    hooks: normalizeLocalizedCopy(row.hook),
    script: row.script,
    rejected: row.status === "rejected",
  };
}

/**
 * Prompt section: already-planned hooks / locations / angles.
 * Rejected rows are marked so the model avoids that direction.
 */
export function formatPriorIdeasPromptSection(
  ideas: readonly PriorIdeaSummary[],
): string {
  if (ideas.length === 0) {
    return [
      "## Already planned — do NOT repeat hooks, locations or angles",
      "(none)",
    ].join("\n");
  }

  const lines = ideas.map((idea, index) => {
    const rejectTag = idea.rejected
      ? " [owner rejected — avoid this direction]"
      : "";
    const hooks = [`en: ${idea.hooks.en || "—"}`, `pt: ${idea.hooks.pt || "—"}`].join(
      " | ",
    );
    const scriptPreview = idea.script.trim().slice(0, 160);
    return `${index + 1}. (${idea.status})${rejectTag} hooks={${hooks}} script=${scriptPreview || "—"}`;
  });

  return [
    "## Already planned — do NOT repeat hooks, locations or angles",
    ...lines,
  ].join("\n");
}

/** Normalize hook text for exact / overlap comparison. */
export function normalizeHookText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  const normalized = normalizeHookText(text);
  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

/** Dice coefficient on token sets (2|A∩B| / (|A|+|B|)). */
export function tokenOverlapRatio(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection += 1;
  }
  return (2 * intersection) / (ta.size + tb.size);
}

function hooksNearDuplicate(
  a: LocalizedCopy,
  b: LocalizedCopy,
  threshold = 0.9,
): boolean {
  for (const left of [a.en, a.pt]) {
    if (!left) continue;
    for (const right of [b.en, b.pt]) {
      if (!right) continue;
      if (normalizeHookText(left) === normalizeHookText(right)) return true;
      if (tokenOverlapRatio(left, right) >= threshold) return true;
    }
  }
  return false;
}

export type IdeaWithHooks = {
  hook: LocalizedCopy;
};

/**
 * Drop ideas whose hooks duplicate a prior idea or an earlier keep in the batch.
 * Exact normalized match or ≥90% token overlap.
 */
export function dropNearDuplicateIdeas<T extends IdeaWithHooks>(input: {
  ideas: readonly T[];
  priorHooks: readonly LocalizedCopy[];
  threshold?: number;
}): { ideas: T[]; warnings: string[] } {
  const threshold = input.threshold ?? 0.9;
  const kept: T[] = [];
  const warnings: string[] = [];
  const seen: LocalizedCopy[] = [...input.priorHooks];

  for (const [index, idea] of input.ideas.entries()) {
    const dup = seen.some((prior) =>
      hooksNearDuplicate(idea.hook, prior, threshold),
    );
    if (dup) {
      warnings.push(
        `idea[${index}]: near-duplicate hook — dropped`,
      );
      continue;
    }
    kept.push(idea);
    seen.push(idea.hook);
  }

  return { ideas: kept, warnings };
}
