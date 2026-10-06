import { describe, expect, it } from "vitest";

import {
  formatCollectionEyebrow,
  shippedCollectionEyebrowLabel,
} from "@/lib/content/collection-eyebrow";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

describe("formatCollectionEyebrow", () => {
  it("localizes the Collection word for EN / PT / RU", () => {
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("en"))).toBe("Collection 02");
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("pt"))).toBe("Coleção 02");
    expect(formatCollectionEyebrow(2, shippedCollectionEyebrowLabel("ru"))).toBe("Коллекция 02");
  });

  it("falls back to the bare label when sort order is missing", () => {
    expect(formatCollectionEyebrow(null, "Коллекция")).toBe("Коллекция");
    expect(formatCollectionEyebrow(0, "Collection")).toBe("Collection");
  });
});

describe("home.archive messages (PR #102)", () => {
  it("ships RU VIEW COLLECTION chrome", () => {
    expect(ru.home.archive.viewCollection).toBe("Смотреть коллекцию");
    expect(ru.home.archive.collectionNote).toBe("Заметка о коллекции");
    expect(ru.home.archive.edition).toBe("Выпуск");
    expect(en.home.archive.viewCollection).toBe("View collection");
  });
});
