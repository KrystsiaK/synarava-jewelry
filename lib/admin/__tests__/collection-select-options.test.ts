import { describe, expect, it } from "vitest";

import {
  collectionSelectOptionLabel,
  filterCollectionsForProductSelect,
  isPublishedCollection,
  liveProductRequiresPublishedCollectionMessage,
  productLiveInUnpublishedCollection,
} from "../collection-select-options";

const published = {
  id: "1",
  slug: "lava",
  name: "Lava",
  isStorefrontDefault: false,
  status: "ACTIVE" as const,
  visibility: "PUBLIC" as const,
};

const draft = {
  id: "2",
  slug: "obsidian",
  name: "Obsidian",
  isStorefrontDefault: false,
  status: "DRAFT" as const,
  visibility: "PRIVATE" as const,
};

const archived = {
  id: "3",
  slug: "legacy",
  name: "Legacy",
  isStorefrontDefault: false,
  status: "ARCHIVED" as const,
  visibility: "PRIVATE" as const,
};

const featured = {
  id: "4",
  slug: "featured",
  name: "Featured",
  isStorefrontDefault: true,
  status: "ACTIVE" as const,
  visibility: "PUBLIC" as const,
};

describe("collection select options", () => {
  it("treats ACTIVE+PUBLIC as published", () => {
    expect(isPublishedCollection(published)).toBe(true);
    expect(isPublishedCollection(draft)).toBe(false);
  });

  it("labels draft and archived options for the select", () => {
    expect(collectionSelectOptionLabel(published)).toBe("Lava");
    expect(collectionSelectOptionLabel(draft)).toBe("Obsidian (Draft)");
    expect(collectionSelectOptionLabel(archived)).toBe("Legacy (Archived)");
  });

  it("keeps draft collections pickable and hides Featured / non-current archived", () => {
    const options = filterCollectionsForProductSelect(
      [published, draft, archived, featured],
      "",
    );
    expect(options.map((item) => item.slug)).toEqual(["lava", "obsidian"]);
  });

  it("keeps the current archived assignment so edit does not clear it", () => {
    const options = filterCollectionsForProductSelect(
      [published, draft, archived, featured],
      "legacy",
    );
    expect(options.map((item) => item.slug)).toEqual(["lava", "obsidian", "legacy"]);
  });

  it("blocks live product save when collection is draft", () => {
    expect(liveProductRequiresPublishedCollectionMessage(draft, true)).toMatch(/is draft/i);
    expect(liveProductRequiresPublishedCollectionMessage(draft, false)).toBeNull();
    expect(liveProductRequiresPublishedCollectionMessage(published, true)).toBeNull();
    expect(liveProductRequiresPublishedCollectionMessage(null, true)).toBeNull();
  });

  it("flags Shopify-pull recovery: live product whose marketing collections are all unpublished", () => {
    expect(
      productLiveInUnpublishedCollection({
        status: "ACTIVE",
        collections: [
          { collection: { isStorefrontDefault: true, status: "ACTIVE", visibility: "PUBLIC" } },
          { collection: { isStorefrontDefault: false, status: "DRAFT", visibility: "PRIVATE" } },
        ],
      }),
    ).toBe(true);

    expect(
      productLiveInUnpublishedCollection({
        status: "DRAFT",
        collections: [
          { collection: { isStorefrontDefault: false, status: "DRAFT", visibility: "PRIVATE" } },
        ],
      }),
    ).toBe(false);

    expect(
      productLiveInUnpublishedCollection({
        status: "ACTIVE",
        collections: [
          { collection: { isStorefrontDefault: false, status: "ACTIVE", visibility: "PUBLIC" } },
        ],
      }),
    ).toBe(false);
  });
});
