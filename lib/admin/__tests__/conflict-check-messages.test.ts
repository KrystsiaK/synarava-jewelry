import { describe, expect, it } from "vitest";

import {
  CONFLICT_CHECK_ENTITY_NOUN,
  conflictCheckSuccessMessage,
  publicConflictCheckWarning,
} from "@/lib/admin/conflict-check-messages";

describe("conflict-check-messages", () => {
  it("uses one short success line for both entities", () => {
    expect(conflictCheckSuccessMessage("product", 0)).toBe("Conflict check finished");
    expect(conflictCheckSuccessMessage("collection", 3)).toBe("Conflict check finished");
    expect(CONFLICT_CHECK_ENTITY_NOUN.collection.plural).toBe("collections");
    expect(CONFLICT_CHECK_ENTITY_NOUN.product.plural).toBe("products");
  });

  it("strips Markets and PR jargon from warnings", () => {
    expect(
      publicConflictCheckWarning(
        "Portuguese (pt-PT), Russian (ru) are not enabled/published in Shopify Markets; translation sync will be skipped",
      ),
    ).toBeUndefined();
    expect(
      publicConflictCheckWarning("Collection commerce refresh awaits sync-unification PR4 (#245)."),
    ).toBeUndefined();
    expect(publicConflictCheckWarning("Shopify timed out.")).toBe("Shopify timed out.");
  });
});
