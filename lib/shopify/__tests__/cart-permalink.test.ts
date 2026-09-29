import { describe, expect, it } from "vitest";

import {
  CART_PERMALINK_LIMITS,
  numericIdFromVariantGid,
  parseCartPermalink,
  variantGidFromNumericId,
} from "@/lib/shopify/cart-permalink";

describe("parseCartPermalink", () => {
  it("parses a single variant line", () => {
    expect(parseCartPermalink("70881412:1")).toEqual({
      ok: true,
      lines: [{ variantId: "70881412", quantity: 1 }],
      canonical: "70881412:1",
    });
  });

  it("merges duplicate variant ids and sorts deterministically", () => {
    expect(parseCartPermalink("9:1,2:2,9:3")).toEqual({
      ok: true,
      lines: [
        { variantId: "2", quantity: 2 },
        { variantId: "9", quantity: 4 },
      ],
      canonical: "2:2,9:4",
    });
  });

  it("rejects empty, syntax, and property payloads", () => {
    expect(parseCartPermalink("").ok).toBe(false);
    expect(parseCartPermalink("abc:1")).toEqual({ ok: false, code: "invalid_syntax" });
    expect(parseCartPermalink("1:1?properties[foo]=bar")).toEqual({
      ok: false,
      code: "invalid_syntax",
    });
    expect(parseCartPermalink("1:0")).toEqual({ ok: false, code: "invalid_quantity" });
    expect(parseCartPermalink("01:1")).toEqual({ ok: false, code: "invalid_syntax" });
  });

  it("enforces line and total quantity limits", () => {
    const tooMany = Array.from({ length: CART_PERMALINK_LIMITS.maxLines + 1 }, (_, i) => `${i + 1}:1`).join(",");
    expect(parseCartPermalink(tooMany)).toEqual({ ok: false, code: "too_many_lines" });

    expect(parseCartPermalink(`1:${CART_PERMALINK_LIMITS.maxQuantityPerLine + 1}`)).toEqual({
      ok: false,
      code: "invalid_quantity",
    });
  });

  it("maps numeric ids to GIDs", () => {
    expect(variantGidFromNumericId("42")).toBe("gid://shopify/ProductVariant/42");
    expect(numericIdFromVariantGid("gid://shopify/ProductVariant/42")).toBe("42");
    expect(numericIdFromVariantGid("gid://shopify/Product/42")).toBeNull();
  });
});
