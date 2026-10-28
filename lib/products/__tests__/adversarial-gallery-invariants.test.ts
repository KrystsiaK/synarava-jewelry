/**
 * Phase 1 adversarial gallery invariants (GID retention / uniqueness).
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { describe, expect, it } from "vitest";

import {
  applyGalleryOpToFrames,
  galleryFrameId,
} from "@/lib/products/gallery";
import { retainedShopifyMediaIds } from "@/lib/shopify/product-media-alt-form";

function shopifyFrame(id: string, url: string, alt = "") {
  return {
    id,
    alt,
    mediaContentType: "IMAGE",
    preview: { image: { url, width: 800, height: 800 } },
    image: { url, width: 800, height: 800 },
  };
}

describe("adversarial: gallery GID retention", () => {
  it("reorder keeps the same Shopify gids (no silent remapping)", () => {
    const base = [
      shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/a.jpg", "Front"),
      shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/b.jpg", "Side"),
    ];
    const reordered = applyGalleryOpToFrames(base, {
      type: "move",
      frameId: "gid://shopify/MediaImage/1",
      toIndex: 1,
    });
    expect(reordered.media.map((node) => galleryFrameId(node))).toEqual([
      "gid://shopify/MediaImage/2",
      "gid://shopify/MediaImage/1",
    ]);
  });

  it("frame ids stay unique after add", () => {
    const base = [
      shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/a.jpg"),
      shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/b.jpg"),
    ];
    const after = applyGalleryOpToFrames(base, {
      type: "add",
      assetId: "asset-new",
      url: "/media/c.webp",
      width: 640,
      height: 640,
      alt: "",
    });
    const ids = after.media.map((node) => galleryFrameId(node));
    expect(ids).toEqual([...new Set(ids)]);
  });

  /**
   * SYNC-ADV-004 — retainedShopifyMediaIds dedupes repeated gids (order preserved).
   * @see docs/audits/2026-10-28-sync-adversarial.md#SYNC-ADV-004
   */
  it("retainedShopifyMediaIds dedupes repeated gids (SYNC-ADV-004)", () => {
    const ids = retainedShopifyMediaIds({
      media: [
        { id: "gid://shopify/MediaImage/1", alt: "A" },
        { id: "gid://shopify/MediaImage/1", alt: "A-dup" },
        { id: "gid://shopify/MediaImage/2", alt: "B" },
      ],
    });
    expect(ids).not.toBeNull();
    expect(ids).toEqual([
      "gid://shopify/MediaImage/1",
      "gid://shopify/MediaImage/2",
    ]);
    expect(ids).toEqual([...new Set(ids!)]);
  });
});
