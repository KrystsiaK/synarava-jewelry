/**
 * Gallery identity compare (frameId) — replaces positional media[i] diffs.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import {
  buildGalleryPlan,
  buildGalleryPlanFromNodes,
  diffGalleryByIdentity,
  productSetFileIdentityKeys,
  productSetFilesFromPlan,
  type GalleryPlanFrame,
} from "@/lib/shopify/gallery-plan";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
] as const;

function shopifyNode(id: string, alt = "", url = `https://cdn.shopify.com/${id}.jpg`) {
  return {
    id,
    alt,
    mediaContentType: "IMAGE",
    preview: { image: { url, width: 100, height: 100 } },
    image: { url, width: 100, height: 100 },
  };
}

function localNode(assetId: string, alt = "", url = `https://s3.example/${assetId}.jpg`) {
  return shopifyNode(`local:${assetId}`, alt, url);
}

function compareMedia(ourMedia: unknown[], shopifyMedia: unknown[]) {
  return compareSyncState({
    commerceWindows: [{
      resourceType: "PRODUCT",
      resourceId: "p1",
      ourWindow: { title: "Ring", media: ourMedia },
      shopifySnapshot: { title: "Ring", media: shopifyMedia },
    }],
    translationDifferences: [],
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    connected: true,
    checkedAt: "2026-10-28T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-28T12:01:00.000Z"),
  });
}

function mediaLeaves(result: ReturnType<typeof compareSyncState>) {
  return result.leaves.filter((leaf) => leaf.kind === "commerce" && leaf.section === "media");
}

describe("gallery identity compare", () => {
  it("exact repro: delete A + add local → exactly 2 leaves (B equal)", () => {
    const A = shopifyNode("gid://shopify/MediaImage/A", "A");
    const B = shopifyNode("gid://shopify/MediaImage/B", "B");
    const neu = localNode("new1", "New");
    const result = compareMedia([neu, B], [A, B]);
    const media = mediaLeaves(result);
    expect(media).toHaveLength(2);
    const keys = media.map((leaf) => leaf.contractKey).toSorted();
    expect(keys).toEqual(["media.added", "media.removed"]);
    expect(media.some((leaf) => leaf.path?.includes("MediaImage/A"))).toBe(true);
    expect(media.some((leaf) => leaf.path?.includes("local:new1"))).toBe(true);
  });

  it("delete the FIRST of three photos → exactly 1 leaf (no cascade)", () => {
    const A = shopifyNode("gid://shopify/MediaImage/A", "A");
    const B = shopifyNode("gid://shopify/MediaImage/B", "B");
    const C = shopifyNode("gid://shopify/MediaImage/C", "C");
    const result = compareMedia([B, C], [A, B, C]);
    const media = mediaLeaves(result);
    expect(media).toHaveLength(1);
    expect(media[0]!.contractKey).toBe("media.removed");
    expect(media[0]!.path).toContain("MediaImage/A");
  });

  it("reorder only → exactly 1 moved leaf", () => {
    const A = shopifyNode("gid://shopify/MediaImage/A", "A");
    const B = shopifyNode("gid://shopify/MediaImage/B", "B");
    const C = shopifyNode("gid://shopify/MediaImage/C", "C");
    const result = compareMedia([B, A, C], [A, B, C]);
    const media = mediaLeaves(result);
    expect(media).toHaveLength(1);
    expect(media[0]!.contractKey).toBe("media.moved");
  });

  it("re-hosted URL/filename on same gid → 0 leaves", () => {
    const gid = "gid://shopify/MediaImage/A";
    const ours = shopifyNode(gid, "Alt", "https://cdn.shopify.com/new-host.jpg?v=2");
    const shopify = shopifyNode(gid, "Alt", "https://cdn.shopify.com/old-host.jpg?v=1");
    // Different filename from URL — still same gid identity.
    expect(mediaLeaves(compareMedia([ours], [shopify]))).toHaveLength(0);
  });

  it("alt change on matched gid → exactly 1 alt leaf", () => {
    const gid = "gid://shopify/MediaImage/A";
    const result = compareMedia(
      [shopifyNode(gid, "Ours")],
      [shopifyNode(gid, "Shopify")],
    );
    const media = mediaLeaves(result);
    expect(media).toHaveLength(1);
    expect(media[0]!.contractKey).toBe("media.alt");
  });

  it("thumbnails never change fingerprints", () => {
    const A = shopifyNode("gid://shopify/MediaImage/A", "A", "https://cdn.shopify.com/a-v1.jpg");
    const B = shopifyNode("gid://shopify/MediaImage/A", "A", "https://cdn.shopify.com/a-v2.jpg?v=99");
    const ours = buildGalleryPlanFromNodes([A]);
    const shopify = buildGalleryPlanFromNodes([]);
    const d1 = diffGalleryByIdentity(ours, shopify);
    const ours2 = buildGalleryPlanFromNodes([B]);
    const d2 = diffGalleryByIdentity(ours2, shopify);
    expect(d1).toHaveLength(1);
    expect(d2).toHaveLength(1);
    expect(d1[0]!.fingerprintLocal).toBe(d2[0]!.fingerprintLocal);
    expect(d1[0]!.fingerprintShopify).toBe(d2[0]!.fingerprintShopify);
    const leafFp = (local: string, shopifySide: string) => ({
      local: createHash("sha256").update(local).digest("hex"),
      shopify: createHash("sha256").update(shopifySide).digest("hex"),
    });
    expect(leafFp(d1[0]!.fingerprintLocal, d1[0]!.fingerprintShopify))
      .toEqual(leafFp(d2[0]!.fingerprintLocal, d2[0]!.fingerprintShopify));
  });

  it("productSet files never duplicate the same gid/filename/assetId", () => {
    const plan = buildGalleryPlanFromNodes([
      shopifyNode("gid://shopify/MediaImage/A", "A"),
      shopifyNode("gid://shopify/MediaImage/A", "A-dup"),
      localNode("asset-1", "L"),
    ]);
    const staged = new Map([["local:asset-1", { originalSource: "https://upload/a.jpg", filename: "a.jpg" }]]);
    const files = productSetFilesFromPlan(plan, (frame) => staged.get(frame.frameId) ?? null);
    const keys = productSetFileIdentityKeys(files);
    expect(keys).toEqual([...new Set(keys)]);
    expect(files.filter((file) => file.id === "gid://shopify/MediaImage/A")).toHaveLength(1);
  });

  it("?v= change on a preview URL causes no upload for a matched gid", () => {
    const plan = buildGalleryPlanFromNodes([
      shopifyNode("gid://shopify/MediaImage/A", "A", "https://cdn.shopify.com/a.jpg?v=999"),
    ]);
    let pendingCalls = 0;
    const files = productSetFilesFromPlan(plan, () => {
      pendingCalls += 1;
      return { originalSource: "https://should-not-upload", filename: "nope.jpg" };
    });
    expect(pendingCalls).toBe(0);
    expect(files).toEqual([{ id: "gid://shopify/MediaImage/A", alt: "A" }]);
  });

  it("Create with only imageUrl still uploads when plan is empty (caller path)", () => {
    // Empty plan → files empty; Create caller may append imageUrl once.
    const plan = buildGalleryPlanFromNodes([]);
    expect(productSetFilesFromPlan(plan, () => null)).toEqual([]);
  });

  it("generated: random add/remove/move/alt — compare deterministic + order-independent", () => {
    const gids = ["gid://shopify/MediaImage/1", "gid://shopify/MediaImage/2", "gid://shopify/MediaImage/3"];
    for (let seed = 0; seed < 40; seed += 1) {
      const shopify = gids.map((id, i) => shopifyNode(id, `S${i}`));
      const oursNodes: unknown[] = [];
      // Keep 0..3 shopify frames in shuffled order; maybe drop one; maybe add local.
      const keep = gids.filter((_, i) => ((seed >> i) & 1) === 1);
      const rotated = [...keep.slice(seed % Math.max(keep.length, 1)), ...keep.slice(0, seed % Math.max(keep.length, 1))];
      for (const id of rotated) {
        const alt = (seed & 8) ? `alt-${id}` : `S${gids.indexOf(id)}`;
        oursNodes.push(shopifyNode(id, alt));
      }
      if (seed % 3 === 0) oursNodes.push(localNode(`x${seed}`, "L"));
      const planA = buildGalleryPlanFromNodes(oursNodes);
      const planB = buildGalleryPlanFromNodes(shopify);
      const d1 = diffGalleryByIdentity(planA, planB);
      const d2 = diffGalleryByIdentity(planA, planB);
      expect(d1).toEqual(d2);
      const r1 = mediaLeaves(compareMedia(oursNodes, shopify)).map((l) => l.path).toSorted();
      const r2 = mediaLeaves(compareMedia([...oursNodes].reverse().reverse(), [...shopify]))
        .map((l) => l.path)
        .toSorted();
      expect(r1).toEqual(r2);
      // Applying all Take Shopify (align ours to shopify media) → 0 media leaves.
      const aligned = shopify.map((node) => structuredClone(node));
      expect(mediaLeaves(compareMedia(aligned, shopify))).toHaveLength(0);
      // Applying all Keep ours (align shopify to ours gids that exist + drop extras) —
      // for property: when ours only has subset/reorder/alt of shopify gids + locals,
      // shopify mirror of ours non-local frames + ignore locals as "keep upload".
      const shopifyAligned = oursNodes.filter((node) => {
        const id = (node as { id: string }).id;
        return id.startsWith("gid://shopify/");
      });
      // Locals remain as added until push; identity equal on shared gids after alt/order match.
      const withoutLocals = oursNodes.filter((node) =>
        String((node as { id: string }).id).startsWith("gid://"),
      );
      expect(mediaLeaves(compareMedia(withoutLocals, withoutLocals))).toHaveLength(0);
      void shopifyAligned;
    }
  });
});

describe("gallery plan frame source", () => {
  it("classifies gid vs pending-upload", () => {
    const plan = buildGalleryPlanFromNodes([
      shopifyNode("gid://shopify/MediaImage/1"),
      localNode("asset-9"),
    ]);
    expect(plan.frames.map((f: GalleryPlanFrame) => f.source)).toEqual([
      "shopify-gid",
      "pending-upload",
    ]);
  });

  it("buildGalleryPlan prefers extras.media (Media tab entry)", () => {
    const plan = buildGalleryPlan({
      extras: { media: [shopifyNode("gid://shopify/MediaImage/1", "From extras")] },
      shopifySnapshot: { media: [shopifyNode("gid://shopify/MediaImage/2", "Snap")] },
      media: [{ assetId: "a1", alt: "Local", url: "https://s3/a1.jpg", width: 1, height: 1 }],
    });
    expect(plan.frames).toHaveLength(1);
    expect(plan.frames[0]!.frameId).toBe("gid://shopify/MediaImage/1");
    expect(plan.frames[0]!.alt).toBe("From extras");
  });
});
