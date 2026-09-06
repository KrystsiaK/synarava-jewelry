import { slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates plain ASCII text", () => {
    expect(slugify("Oak Bracelet")).toBe("oak-bracelet");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Oak & Lava  Bracelet!!")).toBe("oak-lava-bracelet");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Oak Bracelet- ")).toBe("oak-bracelet");
  });

  it("drops Portuguese diacritics instead of the letters carrying them", () => {
    expect(slugify("Coração de Lava")).toBe("coracao-de-lava");
    expect(slugify("Ámbar & Prata")).toBe("ambar-prata");
  });

  it("never returns empty for text that has any letters at all", () => {
    expect(slugify("São")).not.toBe("");
  });
});
