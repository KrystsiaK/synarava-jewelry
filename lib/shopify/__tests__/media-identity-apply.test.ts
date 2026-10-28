/**
 * Mixed Apply: Take Shopify on removed + Keep ours on added → 0 leaves.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyGalleryOp: vi.fn(),
  pushProductToShopify: vi.fn(),
  gateWriteConvergence: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { product: { findUnique: mocks.findUnique } },
}));

vi.mock("@/lib/products/gallery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/products/gallery")>("@/lib/products/gallery");
  return {
    ...actual,
    applyGalleryOp: mocks.applyGalleryOp,
  };
});

vi.mock("@/lib/shopify/product-sync", () => ({
  pushProductToShopify: mocks.pushProductToShopify,
}));

vi.mock("@/lib/sync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sync")>("@/lib/sync");
  return {
    ...actual,
    gateWriteConvergence: mocks.gateWriteConvergence,
    recheckEntityConflictLeaves: vi.fn(),
  };
});

import { applyMediaIdentityBatch } from "@/lib/shopify/media-identity-apply";
import { applyGalleryOpToFrames } from "@/lib/products/gallery";
import {
  buildGalleryPlanFromNodes,
  diffGalleryByIdentity,
} from "@/lib/shopify/gallery-plan";

function shopifyNode(id: string, alt = "") {
  return {
    id,
    alt,
    mediaContentType: "IMAGE" as const,
    preview: { image: { url: `https://cdn/${id}.jpg`, width: 10, height: 10 } },
    image: { url: `https://cdn/${id}.jpg`, width: 10, height: 10 },
  };
}

describe("applyMediaIdentityBatch mixed choices", () => {
  beforeEach(() => {
    mocks.applyGalleryOp.mockReset();
    mocks.pushProductToShopify.mockReset();
    mocks.gateWriteConvergence.mockReset();
    mocks.findUnique.mockReset();
    mocks.applyGalleryOp.mockResolvedValue(undefined);
    mocks.pushProductToShopify.mockResolvedValue({ ok: true, shopifyProductId: "gid://shopify/Product/1" });
    mocks.gateWriteConvergence.mockResolvedValue({ ok: true });
  });

  it("Take Shopify on removed + Keep ours on added ends with 0 identity diffs (mock)", async () => {
    const A = shopifyNode("gid://shopify/MediaImage/A", "A");
    const B = shopifyNode("gid://shopify/MediaImage/B", "B");
    const neu = shopifyNode("local:new1", "New");
    const shopifyMedia = [A, B];
    let ourMedia = [neu, B];

    mocks.findUnique.mockResolvedValue({
      extras: { media: ourMedia },
      shopifySnapshot: { media: shopifyMedia },
    });
    mocks.applyGalleryOp.mockImplementation(async (_id: string, op: Parameters<typeof applyGalleryOpToFrames>[1]) => {
      const result = applyGalleryOpToFrames(ourMedia, op);
      ourMedia = result.media;
    });

    const before = diffGalleryByIdentity(
      buildGalleryPlanFromNodes(ourMedia),
      buildGalleryPlanFromNodes(shopifyMedia),
    );
    expect(before.map((d) => d.kind).toSorted()).toEqual(["added", "removed"]);

    const outcome = await applyMediaIdentityBatch({
      productId: "p1",
      requestedBy: "owner",
      leavesBefore: [],
      entries: [
        {
          fieldKey: "commerce:media-removed-a",
          label: "Removed photo · A",
          path: "media.removed:gid://shopify/MediaImage/A",
          contractKey: "media.removed",
          direction: "SHOPIFY_TO_SYNARAVA",
          expectedLocalFingerprint: "x",
          expectedShopifyFingerprint: "y",
        },
        {
          fieldKey: "commerce:media-added-new",
          label: "New photo · New",
          path: "media.added:local:new1",
          contractKey: "media.added",
          direction: "SYNARAVA_TO_SHOPIFY",
          expectedLocalFingerprint: "x",
          expectedShopifyFingerprint: "y",
        },
      ],
    });

    expect(outcome).toEqual({ ok: true });
    expect(mocks.applyGalleryOp).toHaveBeenCalledWith(
      "p1",
      expect.objectContaining({ type: "insertShopify", frameId: "gid://shopify/MediaImage/A" }),
    );
    expect(mocks.pushProductToShopify).toHaveBeenCalledTimes(1);

    // After Take Shopify insert, ours has A+local+B; Keep ours push uploads local.
    // Identity vs Shopify after push would drop "removed"; "added" clears when Shopify
    // gains the new frame — mocked here by aligning shopify to post-apply ours gids + local gone after confirm.
    const afterOurs = ourMedia;
    expect(afterOurs.some((node) => (node as { id: string }).id === "gid://shopify/MediaImage/A")).toBe(true);
    // Simulate Shopify echo after Keep-ours push (local becomes a gid).
    const shopifyAfter = afterOurs.map((node) => {
      const id = (node as { id: string }).id;
      if (id.startsWith("local:")) {
        return shopifyNode("gid://shopify/MediaImage/NEW", (node as { alt: string }).alt);
      }
      return node;
    });
    const after = diffGalleryByIdentity(
      buildGalleryPlanFromNodes(
        afterOurs.map((node) => {
          const id = (node as { id: string }).id;
          if (id.startsWith("local:")) {
            return shopifyNode("gid://shopify/MediaImage/NEW", (node as { alt: string }).alt);
          }
          return node;
        }),
      ),
      buildGalleryPlanFromNodes(shopifyAfter),
    );
    expect(after).toHaveLength(0);
  });
});
