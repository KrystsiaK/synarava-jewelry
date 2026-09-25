import { describe, expect, it } from "vitest";

import {
  findOnlineStorePublication,
  isPublishedToOnlineStore,
  publishedPublicationNames,
  type ShopifyResourcePublication,
} from "@/lib/shopify/product-publications";

const onlineStore: ShopifyResourcePublication = {
  isPublished: true,
  publishDate: "2024-01-01T00:00:00Z",
  publication: { id: "gid://shopify/Publication/1", name: "Online Store" },
};

const nullPublication: ShopifyResourcePublication = {
  isPublished: true,
  publishDate: null,
  publication: null,
};

const wholesale: ShopifyResourcePublication = {
  isPublished: true,
  publishDate: null,
  publication: { id: "gid://shopify/Publication/2", name: "Wholesale" },
};

describe("product-publications", () => {
  it("does not throw when publication is null (Catalog Conflicts pull crash)", () => {
    expect(() => findOnlineStorePublication([nullPublication, wholesale])).not.toThrow();
    expect(() => publishedPublicationNames([nullPublication, wholesale])).not.toThrow();
    expect(() => isPublishedToOnlineStore([nullPublication])).not.toThrow();
  });

  it("finds Online Store even when other nodes have null publication", () => {
    expect(findOnlineStorePublication([nullPublication, onlineStore, wholesale])).toEqual(onlineStore);
    expect(isPublishedToOnlineStore([nullPublication, onlineStore])).toBe(true);
  });

  it("treats missing Online Store as unpublished online", () => {
    expect(findOnlineStorePublication([nullPublication, wholesale])).toBeUndefined();
    expect(isPublishedToOnlineStore([nullPublication, wholesale])).toBe(false);
  });

  it("omits null publications from published names", () => {
    expect(publishedPublicationNames([nullPublication, wholesale, onlineStore])).toEqual([
      "Online Store",
      "Wholesale",
    ]);
  });
});
