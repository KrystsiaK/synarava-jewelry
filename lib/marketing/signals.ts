import { scrubPromptInjectionText } from "@/lib/ai/product-content/facts";

/**
 * Normalized market signal — AI layer reads only this shape.
 * @see docs/research/task-002/social-data-stack.md
 */
export type MarketSignal = {
  id: string;
  source:
    | "website"
    | "manual"
    | "metricool"
    | "meta_business_discovery"
    | "meta_insights"
    | "ad_library";
  kind: "product_observation" | "account_snapshot" | "ad" | "own_post" | "note";
  brand: string;
  url: string;
  observedAt: string;
  change: "initial" | "changed" | "removed" | null;
  summary: string;
  data: Record<string, string | number | boolean | null>;
};

export type CompetitorObservationLike = {
  id: string;
  domain: string;
  url: string;
  fetchedAt: Date | string;
  httpStatus: number;
  source: string;
  name: string | null;
  price: { toString(): string } | number | string | null;
  currency: string | null;
  availability: string | null;
  kind: string;
};

function priceNumber(
  price: CompetitorObservationLike["price"],
): number | null {
  if (price == null) return null;
  const n = typeof price === "number" ? price : Number(price.toString());
  return Number.isFinite(n) ? n : null;
}

export function fromCompetitorObservation(
  row: CompetitorObservationLike,
  brandLabel?: string,
): MarketSignal {
  const price = priceNumber(row.price);
  const name = scrubPromptInjectionText(row.name) ?? row.name ?? "";
  const parts = [
    name,
    price != null ? `${price}${row.currency ? ` ${row.currency}` : ""}` : null,
    row.availability,
    row.kind,
  ].filter(Boolean);
  const summary =
    scrubPromptInjectionText(parts.join(" · ")) ?? parts.join(" · ");

  return {
    id: `web:${row.id}`,
    source: "website",
    kind: "product_observation",
    brand: brandLabel ?? row.domain,
    url: row.url,
    observedAt:
      typeof row.fetchedAt === "string"
        ? row.fetchedAt
        : row.fetchedAt.toISOString(),
    change:
      row.kind === "initial" || row.kind === "changed" || row.kind === "removed"
        ? row.kind
        : null,
    summary,
    data: {
      domain: row.domain,
      httpStatus: row.httpStatus,
      extractSource: row.source,
      name: name || null,
      price,
      currency: row.currency,
      availability: row.availability,
    },
  };
}

export function fromManualNote(input: {
  id: string;
  url: string;
  text: string;
  brand?: string;
  observedAt?: string;
}): MarketSignal {
  const scrubbed = scrubPromptInjectionText(input.text) ?? "";
  let brand = input.brand ?? "manual";
  try {
    brand = input.brand ?? new URL(input.url).hostname;
  } catch {
    // keep default
  }
  return {
    id: `manual:${input.id}`,
    source: "manual",
    kind: "note",
    brand,
    url: input.url,
    observedAt: input.observedAt ?? new Date().toISOString(),
    change: null,
    summary: scrubbed,
    data: { text: scrubbed },
  };
}
