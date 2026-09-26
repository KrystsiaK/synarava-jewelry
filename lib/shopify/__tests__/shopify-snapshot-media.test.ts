import { describe, expect, it } from "vitest";

import {
  mediaFramesFromWorkingSnapshot,
  mediaFramesFromProductSnapshots,
} from "@/lib/shopify/shopify-snapshot-media";

describe("mediaFramesFromWorkingSnapshot", () => {
  it("reads preview URLs from OUR workingSnapshot media nodes", () => {
    expect(mediaFramesFromWorkingSnapshot({
      media: [{
        id: "gid://shopify/MediaImage/1",
        alt: "Ring",
        preview: { image: { url: "https://cdn.shopify.com/a.jpg", width: 100, height: 80 } },
      }],
    })).toEqual([{
      id: "gid://shopify/MediaImage/1",
      url: "https://cdn.shopify.com/a.jpg",
      alt: "Ring",
      width: 100,
      height: 80,
    }]);
  });

  it("never falls back to shopifySnapshot", () => {
    expect(mediaFramesFromProductSnapshots({
      shopifySnapshot: {
        media: [{
          id: "gid://shopify/MediaImage/1",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
        }],
      },
      workingSnapshot: { media: [] },
    })).toEqual([]);
  });

  it("returns empty when OUR tree has no usable media", () => {
    expect(mediaFramesFromWorkingSnapshot({ media: [] })).toEqual([]);
    expect(mediaFramesFromWorkingSnapshot({})).toEqual([]);
  });
});
