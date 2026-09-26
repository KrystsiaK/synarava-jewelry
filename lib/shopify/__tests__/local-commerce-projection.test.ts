import { describe, expect, it } from "vitest";

import { localCommerceMatchesProjection } from "@/lib/shopify/local-commerce-projection";
import { writeThroughLocalCommerceToProjection } from "@/lib/shopify/shopify-projection-diff";
import { classifyProjectionMerge } from "@/lib/shopify/projection-merge";

describe("localCommerceMatchesProjection", () => {
  it("detects price column drift from snapshot", () => {
    const snapshot = {
      title: "Ring",
      variants: [{ id: "v1", price: "10.00", taxable: true }],
    };
    expect(
      localCommerceMatchesProjection(snapshot, {
        title: "Ring",
        variant: { shopifyVariantId: "v1", priceCents: 1100, taxable: true },
      }),
    ).toBe(false);

    const aligned = writeThroughLocalCommerceToProjection(snapshot, {
      title: "Ring",
      variant: { shopifyVariantId: "v1", priceCents: 1100, taxable: true },
    });
    expect(
      localCommerceMatchesProjection(aligned, {
        title: "Ring",
        variant: { shopifyVariantId: "v1", priceCents: 1100, taxable: true },
      }),
    ).toBe(true);
  });

  it("after write-through of local 11 vs Shopify 11 → synced; vs Shopify 10 → ahead", () => {
    const snapshot = {
      title: "Ring",
      variants: [{ id: "v1", price: "10.00", taxable: true }],
    };
    const local = writeThroughLocalCommerceToProjection(snapshot, {
      title: "Ring",
      variant: { shopifyVariantId: "v1", priceCents: 1100, taxable: true },
    });
    const base = snapshot;

    expect(
      classifyProjectionMerge({
        base,
        local,
        remote: { title: "Ring", variants: [{ id: "v1", price: "11.00", taxable: true }] },
      }).state,
    ).toBe("SYNCED");

    expect(
      classifyProjectionMerge({
        base,
        local,
        remote: { title: "Ring", variants: [{ id: "v1", price: "10.00", taxable: true }] },
      }).state,
    ).toBe("LOCAL_CHANGES");
  });

  it("write-through of tags updates the compare projection", () => {
    const next = writeThroughLocalCommerceToProjection(
      { title: "Ring", tags: ["old"] },
      { tags: ["bracelet", "heritage"] },
    );
    expect(next).toEqual({ title: "Ring", tags: ["bracelet", "heritage"] });
  });

  it("write-through of custom metafields updates OUR window without touching synarava", () => {
    const next = writeThroughLocalCommerceToProjection(
      {
        title: "Ring",
        metafields: [
          { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Gold" },
          { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "1 year" },
        ],
      },
      {
        customMetafields: [
          { namespace: "custom", key: "warranty", type: "single_line_text_field", value: "2 years" },
        ],
      },
    );
    expect(next).toMatchObject({ title: "Ring" });
    const metafields = (next as { metafields: Array<{ namespace: string; key: string; value: string }> }).metafields;
    expect(metafields).toEqual(expect.arrayContaining([
      expect.objectContaining({ namespace: "synarava", key: "material", value: "Gold" }),
      expect.objectContaining({ namespace: "custom", key: "warranty", value: "2 years" }),
    ]));
    expect(metafields).toHaveLength(2);
  });
});
