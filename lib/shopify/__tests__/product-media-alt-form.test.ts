import { describe, expect, it } from "vitest";

import {
  applyTreeMediaAltUpdates,
  isMediaAltFormField,
  mediaAltUpdatesFromForm,
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
});
