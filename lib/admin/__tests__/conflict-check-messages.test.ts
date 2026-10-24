import { describe, expect, it } from "vitest";

import { CONFLICT_CHECK_ENTITY_NOUN } from "@/lib/admin/conflict-check-messages";

describe("conflict-check-messages", () => {
  it("exposes entity nouns for products and collections", () => {
    expect(CONFLICT_CHECK_ENTITY_NOUN.collection.plural).toBe("collections");
    expect(CONFLICT_CHECK_ENTITY_NOUN.product.plural).toBe("products");
  });
});
