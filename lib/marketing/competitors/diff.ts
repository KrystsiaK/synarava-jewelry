import { observationContentHash } from "@/lib/marketing/competitors/hash";

export type PriorObservation = {
  id: string;
  contentHash: string;
  kind: string;
};

export type DiffDecision =
  | { write: false }
  | {
      write: true;
      kind: "initial" | "changed" | "removed";
      previousId: string | null;
      contentHash: string;
    };

/** Decide whether an observation row should be written for a URL. Unchanged → no row. */
export function decideObservationDiff(input: {
  prior: PriorObservation | null | undefined;
  removed: boolean;
  name?: string | null;
  price?: number | null;
  currency?: string | null;
  availability?: string | null;
}): DiffDecision {
  if (input.removed) {
    if (!input.prior || input.prior.kind === "removed") return { write: false };
    return {
      write: true,
      kind: "removed",
      previousId: input.prior.id,
      contentHash: observationContentHash({
        name: null,
        price: null,
        currency: null,
        availability: null,
      }),
    };
  }

  const contentHash = observationContentHash({
    name: input.name ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    availability: input.availability ?? null,
  });

  if (!input.prior || input.prior.kind === "removed") {
    return { write: true, kind: "initial", previousId: null, contentHash };
  }
  if (input.prior.contentHash !== contentHash) {
    return {
      write: true,
      kind: "changed",
      previousId: input.prior.id,
      contentHash,
    };
  }
  return { write: false };
}
