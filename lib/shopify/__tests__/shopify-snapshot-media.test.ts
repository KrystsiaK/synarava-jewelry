import { describe, expect, it } from "vitest";

import { mediaFramesFromProductSnapshots } from "@/lib/shopify/shopify-snapshot-media";

describe("mediaFramesFromProductSnapshots", () => {
  it("reads preview URLs from shopifySnapshot media nodes", () => {
    expect(mediaFramesFromProductSnapshots({
      shopifySnapshot: {
        media: [{
          id: "gid://shopify/MediaImage/1",
          alt: "Ring",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg", width: 100, height: 80 } },
        }],
      },
    })).toEqual([{
      id: "gid://shopify/MediaImage/1",
      url: "https://cdn.shopify.com/a.jpg",
      alt: "Ring",
      width: 100,
      height: 80,
    }]);
  });

  it("returns empty when snapshots have no usable media", () => {
    expect(mediaFramesFromProductSnapshots({ shopifySnapshot: { media: [] } })).toEqual([]);
    expect(mediaFramesFromProductSnapshots({})).toEqual([]);
  });
});
