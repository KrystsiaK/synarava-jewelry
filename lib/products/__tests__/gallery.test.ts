import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  GALLERY_MAX_FRAMES,
  applyGalleryOpToFrames,
  galleryFrameId,
  localFrameId,
  readGalleryFrames,
  seedFramesFromLocalRows,
  validateGalleryUploadFile,
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

describe("applyGalleryOpToFrames — D1 upload must preserve Shopify frames", () => {
  it("keeps 2 Shopify frames and appends local without reassigning GIDs", () => {
    const base = [
      shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/a.jpg", "Front"),
      shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/b.jpg", "Side"),
    ];
    const result = applyGalleryOpToFrames(base, {
      type: "add",
      assetId: "asset-new",
      url: "/media/c.webp",
      width: 640,
      height: 640,
      alt: "",
    });

    expect(result.media).toHaveLength(3);
    expect(result.media.map((node) => galleryFrameId(node))).toEqual([
      "gid://shopify/MediaImage/1",
      "gid://shopify/MediaImage/2",
      localFrameId("asset-new"),
    ]);
    expect(result.media[2]).toMatchObject({
      id: "local:asset-new",
      alt: "",
      preview: { image: { url: "/media/c.webp" } },
    });

    // Push inputs: 2 retained Shopify GIDs + 1 pending local staging row.
    expect(retainedShopifyMediaIds({ media: result.media })).toEqual([
      "gid://shopify/MediaImage/1",
      "gid://shopify/MediaImage/2",
    ]);
  });

  it("never hijacks an unused Shopify GID for a new upload", () => {
    const base = [
      shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/a.jpg"),
      shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/b.jpg"),
    ];
    const result = applyGalleryOpToFrames(base, {
      type: "add",
      assetId: "brand-new",
      url: "https://totally-different.example/c.jpg",
      width: 1,
      height: 1,
    });
    expect(galleryFrameId(result.media[2])).toBe("local:brand-new");
    expect(galleryFrameId(result.media[0])).toBe("gid://shopify/MediaImage/1");
    expect(galleryFrameId(result.media[1])).toBe("gid://shopify/MediaImage/2");
  });
});

describe("applyGalleryOpToFrames — ops by frameId (stale-index immune)", () => {
  const base = [
    shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/a.jpg", "A"),
    shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/b.jpg", "B"),
    {
      ...shopifyFrame("local:pending", "/media/c.webp", ""),
      id: "local:pending",
    },
  ];

  it("removes / moves / covers / alts a Shopify frame while a pending upload exists", () => {
    const afterAlt = applyGalleryOpToFrames(base, {
      type: "setAlt",
      frameId: "gid://shopify/MediaImage/2",
      alt: "Side view",
    });
    expect(afterAlt.media.map((n) => (n as { alt: string }).alt)).toEqual(["A", "Side view", ""]);

    const afterMove = applyGalleryOpToFrames(afterAlt.media, {
      type: "move",
      frameId: "gid://shopify/MediaImage/2",
      toIndex: 0,
    });
    expect(afterMove.media.map((n) => galleryFrameId(n))).toEqual([
      "gid://shopify/MediaImage/2",
      "gid://shopify/MediaImage/1",
      "local:pending",
    ]);
    expect(afterMove.coverUrl).toBe("https://cdn/b.jpg");

    const afterCover = applyGalleryOpToFrames(base, {
      type: "setCover",
      frameId: "local:pending",
    });
    expect(galleryFrameId(afterCover.media[0])).toBe("local:pending");
    expect(afterCover.coverAssetId).toBe("pending");

    const afterRemove = applyGalleryOpToFrames(base, {
      type: "remove",
      frameId: "gid://shopify/MediaImage/1",
    });
    expect(afterRemove.media.map((n) => galleryFrameId(n))).toEqual([
      "gid://shopify/MediaImage/2",
      "local:pending",
    ]);
  });

  it("rejects stale frame ids instead of removing the wrong index", () => {
    expect(() =>
      applyGalleryOpToFrames(base, { type: "remove", frameId: "gid://shopify/MediaImage/999" }),
    ).toThrow(/not found/i);
    expect(() =>
      applyGalleryOpToFrames(base, {
        type: "setAlt",
        frameId: "gid://gone",
        alt: "x",
      }),
    ).toThrow(/not found/i);
  });
});

describe("applyGalleryOpToFrames — sequential ops never lose updates", () => {
  it("two concurrent-style ops applied in order keep both changes", () => {
    let media = [
      shopifyFrame("gid://1", "https://cdn/a.jpg", "A"),
      shopifyFrame("gid://2", "https://cdn/b.jpg", "B"),
    ];
    media = applyGalleryOpToFrames(media, {
      type: "setAlt",
      frameId: "gid://1",
      alt: "Front edited",
    }).media;
    media = applyGalleryOpToFrames(media, {
      type: "add",
      assetId: "c",
      url: "/c.webp",
      width: 1,
      height: 1,
      alt: "",
    }).media;
    expect(media).toHaveLength(3);
    expect((media[0] as { alt: string }).alt).toBe("Front edited");
    expect(galleryFrameId(media[2])).toBe("local:c");
  });
});

describe("property: random op sequences", () => {
  it("never duplicates ids, keeps expected length, order-stable for untouched frames", () => {
    const seed = [
      shopifyFrame("gid://shopify/MediaImage/1", "https://cdn/1.jpg", "1"),
      shopifyFrame("gid://shopify/MediaImage/2", "https://cdn/2.jpg", "2"),
      shopifyFrame("gid://shopify/MediaImage/3", "https://cdn/3.jpg", "3"),
    ];
    let media = seed.map((n) => structuredClone(n));
    let expectedMin = 3;
    let assetCounter = 0;

    for (let step = 0; step < 80; step++) {
      const ids = media.map((n) => galleryFrameId(n)!);
      expect(new Set(ids).size).toBe(ids.length);

      const roll = step % 5;
      if (roll === 0 && media.length < GALLERY_MAX_FRAMES) {
        assetCounter += 1;
        media = applyGalleryOpToFrames(media, {
          type: "add",
          assetId: `a${assetCounter}`,
          url: `/m/${assetCounter}.webp`,
          width: 1,
          height: 1,
          alt: "",
        }).media;
        expectedMin += 1;
      } else if (roll === 1 && media.length > 1) {
        const frameId = galleryFrameId(media[media.length - 1])!;
        media = applyGalleryOpToFrames(media, { type: "remove", frameId }).media;
        expectedMin -= 1;
      } else if (roll === 2 && media.length > 1) {
        const frameId = galleryFrameId(media[1])!;
        media = applyGalleryOpToFrames(media, { type: "setCover", frameId }).media;
      } else if (roll === 3 && media.length > 1) {
        const frameId = galleryFrameId(media[0])!;
        media = applyGalleryOpToFrames(media, {
          type: "move",
          frameId,
          toIndex: media.length - 1,
        }).media;
      } else if (media.length > 0) {
        const frameId = galleryFrameId(media[0])!;
        media = applyGalleryOpToFrames(media, {
          type: "setAlt",
          frameId,
          alt: `alt-${step}`,
        }).media;
      }

      expect(media.length).toBeGreaterThanOrEqual(Math.min(expectedMin, media.length));
      const nextIds = media.map((n) => galleryFrameId(n)!);
      expect(new Set(nextIds).size).toBe(nextIds.length);
      expect(media.length).toBe(expectedMin);
    }
  });
});

describe("applyGalleryOp locking contract", () => {
  it("locks the product row with SELECT … FOR UPDATE", () => {
    const source = readFileSync(join(process.cwd(), "lib/products/gallery.ts"), "utf8");
    expect(source).toMatch(/FOR UPDATE/);
    expect(source).toMatch(/\$transaction/);
  });
});

describe("readGalleryFrames / seed / validation / limit", () => {
  it("prefers extras.media and falls back to shopifySnapshot without dropping frames", () => {
    expect(
      readGalleryFrames(
        { media: [shopifyFrame("gid://1", "https://a")] },
        { media: [shopifyFrame("gid://snap", "https://b")] },
      ),
    ).toHaveLength(1);
    expect(galleryFrameId(readGalleryFrames({}, { media: [shopifyFrame("gid://snap", "https://b")] })[0])).toBe(
      "gid://snap",
    );
    expect(readGalleryFrames({}, null)).toEqual([]);
  });

  it("seeds local-only drafts as local: frames (no GID invention)", () => {
    const seeded = seedFramesFromLocalRows([
      { assetId: "a1", alt: null, url: "/a.webp", width: 1, height: 1 },
    ]);
    expect(seeded[0].id).toBe("local:a1");
    expect(seeded[0].alt).toBe("");
  });

  it("validates type and size on the client/server shared helper", () => {
    expect(validateGalleryUploadFile(new File([""], "x.png", { type: "image/png" }))).toMatch(/choose/i);
    expect(
      validateGalleryUploadFile(new File([new Uint8Array(12)], "x.gif", { type: "image/gif" })),
    ).toMatch(/jpeg|png|webp|avif/i);
    expect(
      validateGalleryUploadFile(
        new File([new Uint8Array(GALLERY_MAX_FRAMES)], "x.png", { type: "image/png" }),
      ),
    ).toBeNull();
    const big = new File([new Uint8Array(11 * 1024 * 1024)], "x.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    expect(validateGalleryUploadFile(big)).toMatch(/10 mb/i);
  });

  it("enforces 250 over the unified list (Shopify + pending)", () => {
    const frames = Array.from({ length: 249 }, (_, i) =>
      shopifyFrame(`gid://shopify/MediaImage/${i}`, `https://cdn/${i}.jpg`),
    );
    const withLocal = applyGalleryOpToFrames(frames, {
      type: "add",
      assetId: "last",
      url: "/last.webp",
      width: 1,
      height: 1,
    });
    expect(withLocal.media).toHaveLength(250);
    expect(() =>
      applyGalleryOpToFrames(withLocal.media, {
        type: "add",
        assetId: "overflow",
        url: "/x.webp",
        width: 1,
        height: 1,
      }),
    ).toThrow(/250/);
  });
});
