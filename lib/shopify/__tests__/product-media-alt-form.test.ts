import { describe, expect, it } from "vitest";

import {
  mediaFramesFromOurWindow,
  ourMediaNodes,
  rawMediaAltsFromOurWindow,
  resolveGalleryMediaAlt,
  retainedShopifyMediaIds,
} from "@/lib/shopify/product-media-alt-form";

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
