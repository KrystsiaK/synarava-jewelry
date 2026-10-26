import { describe, expect, it } from "vitest";

import {
  applyTreeMediaAltUpdates,
  isMediaAltFormField,
  mediaAltUpdatesFromForm,
  mediaFramesFromOurWindow,
  mergeLocalMediaRowsIntoWorkingMedia,
  ourMediaNodes,
  rawMediaAltsFromOurWindow,
  removeOurMediaAtIndex,
  resolveGalleryMediaAlt,
  retainedShopifyMediaIds,
} from "@/lib/shopify/product-media-alt-form";

describe("isMediaAltFormField", () => {
  it("recognizes local and tree gallery alt names", () => {
    expect(isMediaAltFormField("media-alt-abc")).toBe(true);
    expect(isMediaAltFormField("media-alt-tree-0")).toBe(true);
    expect(isMediaAltFormField("name")).toBe(false);
  });
});

describe("mediaAltUpdatesFromForm", () => {
  it("reads local and tree alt fields without confusing tree ids for media ids", () => {
    const form = new FormData();
    form.set("media-alt-abc123", "Lava ring, front");
    form.set("media-alt-tree-0", "Tree cover alt");
    form.set("media-alt-tree-1", "Tree side alt");
    form.set("name", "Ring");

    expect(mediaAltUpdatesFromForm(form)).toEqual({
      local: [{ mediaId: "abc123", alt: "Lava ring, front" }],
      tree: [
        { index: 0, alt: "Tree cover alt" },
        { index: 1, alt: "Tree side alt" },
      ],
    });
  });

  it("keeps the first value when duplicate alt keys appear", () => {
    const form = new FormData();
    form.append("media-alt-m1", "First");
    form.append("media-alt-m1", "Second");
    expect(mediaAltUpdatesFromForm(form).local).toEqual([{ mediaId: "m1", alt: "First" }]);
  });

  it("preserves N distinct local alts (regression: identical product-title collapse)", () => {
    const form = new FormData();
    form.set("media-alt-m1", "Lemon charm, front on linen");
    form.set("media-alt-m2", "Lemon charm, side with pearls");
    form.set("media-alt-m3", "Lemon charm, detail aventurine");
    form.set("name", "Soleil Lemon Bag Charm");

    expect(mediaAltUpdatesFromForm(form).local).toEqual([
      { mediaId: "m1", alt: "Lemon charm, front on linen" },
      { mediaId: "m2", alt: "Lemon charm, side with pearls" },
      { mediaId: "m3", alt: "Lemon charm, detail aventurine" },
    ]);
  });

  it("preserves N distinct tree alts after Pull (no local ProductMedia rows)", () => {
    const form = new FormData();
    form.set("media-alt-tree-0", "Lemon charm, front on linen");
    form.set("media-alt-tree-1", "Lemon charm, side with pearls");
    form.set("media-alt-tree-2", "Lemon charm, detail aventurine");

    expect(mediaAltUpdatesFromForm(form).tree).toEqual([
      { index: 0, alt: "Lemon charm, front on linen" },
      { index: 1, alt: "Lemon charm, side with pearls" },
      { index: 2, alt: "Lemon charm, detail aventurine" },
    ]);
  });
});

describe("applyTreeMediaAltUpdates", () => {
  it("patches alt on matching indices without mutating the source", () => {
    const media = [
      { id: "a", alt: "Old" },
      { id: "b", alt: "Keep" },
    ];
    const next = applyTreeMediaAltUpdates(media, [{ index: 0, alt: "New cover" }]);
    expect(next).toEqual([
      { id: "a", alt: "New cover" },
      { id: "b", alt: "Keep" },
    ]);
    expect(media[0]).toEqual({ id: "a", alt: "Old" });
  });

  it("keeps sibling alts distinct when only one index is updated", () => {
    const media = [
      { id: "a", alt: "Soleil Lemon Bag Charm" },
      { id: "b", alt: "Soleil Lemon Bag Charm" },
      { id: "c", alt: "Soleil Lemon Bag Charm" },
    ];
    const next = applyTreeMediaAltUpdates(media, [
      { index: 0, alt: "Lemon charm, front" },
      { index: 2, alt: "Lemon charm, detail" },
    ]);
    expect(next.map((node) => (node as { alt: string }).alt)).toEqual([
      "Lemon charm, front",
      "Soleil Lemon Bag Charm",
      "Lemon charm, detail",
    ]);
  });
});

describe("rawMediaAltsFromOurWindow", () => {
  it("reads per-image alts from OUR tree without inventing product title", () => {
    expect(
      rawMediaAltsFromOurWindow({
        title: "Soleil Lemon Bag Charm",
        media: [
          { id: "gid://1", alt: "Lemon charm, front" },
          { id: "gid://2", alt: "Lemon charm, side" },
          { id: "gid://3", alt: "" },
        ],
      }),
    ).toEqual(["Lemon charm, front", "Lemon charm, side", ""]);
  });
});

describe("resolveGalleryMediaAlt", () => {
  it("prefers local, then OUR tree, then remote — never broadcasts product title", () => {
    expect(
      resolveGalleryMediaAlt({
        localAlt: "Local front",
        treeAlt: "Tree front",
        remoteAlt: "Remote front",
        productTitleFallback: "Soleil Lemon Bag Charm",
      }),
    ).toBe("Local front");

    expect(
      resolveGalleryMediaAlt({
        localAlt: null,
        treeAlt: "Tree side",
        remoteAlt: "Soleil Lemon Bag Charm",
        productTitleFallback: "Soleil Lemon Bag Charm",
      }),
    ).toBe("Tree side");

    expect(
      resolveGalleryMediaAlt({
        localAlt: "",
        treeAlt: "",
        remoteAlt: "Remote detail",
        productTitleFallback: "Soleil Lemon Bag Charm",
      }),
    ).toBe("Remote detail");

    // Blank stays blank — do not copy the product title onto every image.
    expect(
      resolveGalleryMediaAlt({
        localAlt: null,
        treeAlt: "",
        remoteAlt: null,
        productTitleFallback: "Soleil Lemon Bag Charm",
      }),
    ).toBe("");
  });
});

describe("mergeLocalMediaRowsIntoWorkingMedia", () => {
  it("keeps distinct tree alts when local ProductMedia alt is still empty", () => {
    const base = [
      { id: "gid://1", alt: "Lemon charm, front", preview: { image: { url: "https://cdn/a.jpg" } } },
      { id: "gid://2", alt: "Lemon charm, side", preview: { image: { url: "https://cdn/b.jpg" } } },
      { id: "gid://3", alt: "Lemon charm, detail", preview: { image: { url: "https://cdn/c.jpg" } } },
    ];
    const next = mergeLocalMediaRowsIntoWorkingMedia({
      baseMedia: base,
      localRows: [
        { assetId: "a1", alt: null, url: "https://cdn/a.jpg", width: 1, height: 1 },
        { assetId: "a2", alt: "Lemon charm, side (edited)", url: "https://cdn/b.jpg", width: 1, height: 1 },
        { assetId: "a3", alt: "", url: "https://cdn/c.jpg", width: 1, height: 1 },
      ],
    });
    expect(next.map((node) => (node as { alt: string }).alt)).toEqual([
      "Lemon charm, front",
      "Lemon charm, side (edited)",
      "Lemon charm, detail",
    ]);
  });

  it("keeps the correct Shopify media id when a middle staging row is removed", () => {
    const base = [
      { id: "gid://shopify/MediaImage/1", alt: "Front", preview: { image: { url: "https://cdn/a.jpg" } } },
      { id: "gid://shopify/MediaImage/2", alt: "Side", preview: { image: { url: "https://cdn/b.jpg" } } },
      { id: "gid://shopify/MediaImage/3", alt: "Detail", preview: { image: { url: "https://cdn/c.jpg" } } },
    ];
    const next = mergeLocalMediaRowsIntoWorkingMedia({
      baseMedia: base,
      localRows: [
        { assetId: "a1", alt: "Front", url: "https://cdn/a.jpg", width: 1, height: 1 },
        { assetId: "a3", alt: "Detail", url: "https://cdn/c.jpg", width: 1, height: 1 },
      ],
    });
    expect(next.map((node) => (node as { id: string }).id)).toEqual([
      "gid://shopify/MediaImage/1",
      "gid://shopify/MediaImage/3",
    ]);
  });
});

describe("removeOurMediaAtIndex", () => {
  it("splices one frame and rejects out-of-range indexes", () => {
    const media = [
      { id: "gid://1", alt: "A" },
      { id: "gid://2", alt: "B" },
      { id: "gid://3", alt: "C" },
    ];
    expect(removeOurMediaAtIndex(media, 1)).toEqual([
      { id: "gid://1", alt: "A" },
      { id: "gid://3", alt: "C" },
    ]);
    expect(media).toHaveLength(3);
    expect(removeOurMediaAtIndex(media, -1)).toBeNull();
    expect(removeOurMediaAtIndex(media, 3)).toBeNull();
  });
});

describe("ourMediaNodes / retainedShopifyMediaIds / mediaFramesFromOurWindow", () => {
  it("returns null when media key is absent, and nodes/GIDs when present", () => {
    expect(ourMediaNodes({ title: "Ring" })).toBeNull();
    expect(ourMediaNodes({ media: [] })).toEqual([]);
    expect(retainedShopifyMediaIds({ title: "Ring" })).toBeNull();
    expect(retainedShopifyMediaIds({ media: [] })).toEqual([]);
    expect(
      retainedShopifyMediaIds({
        media: [
          { id: "gid://shopify/MediaImage/1" },
          { id: "local:asset-2" },
          { id: "gid://shopify/MediaImage/3" },
        ],
      }),
    ).toEqual(["gid://shopify/MediaImage/1", "gid://shopify/MediaImage/3"]);
  });

  it("reads preview URLs from OUR extras/window media nodes", () => {
    expect(mediaFramesFromOurWindow({
      media: [{
        id: "gid://shopify/MediaImage/1",
        alt: "Front",
        preview: { image: { url: "https://cdn.shopify.com/a.webp?v=1", width: 800, height: 800 } },
      }],
    })).toEqual([{
      id: "gid://shopify/MediaImage/1",
      url: "https://cdn.shopify.com/a.webp?v=1",
      alt: "Front",
      width: 800,
      height: 800,
    }]);
    expect(mediaFramesFromOurWindow({ media: [] })).toEqual([]);
    expect(mediaFramesFromOurWindow({})).toEqual([]);
  });
});
