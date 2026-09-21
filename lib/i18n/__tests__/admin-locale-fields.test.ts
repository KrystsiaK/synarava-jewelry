import { describe, expect, it } from "vitest";

import { adminLocaleFieldName, readLocaleField } from "@/lib/i18n/admin-locale-fields";

describe("adminLocaleFieldName", () => {
  it("uses the bare key for the source locale", () => {
    expect(adminLocaleFieldName("en", "title")).toBe("title");
  });

  it("prefixes and capitalizes for every other locale", () => {
    expect(adminLocaleFieldName("pt", "title")).toBe("ptTitle");
    expect(adminLocaleFieldName("ru", "localizedHandle")).toBe("ruLocalizedHandle");
  });

  it("capitalizes only the first character, keeping the rest of the key intact", () => {
    expect(adminLocaleFieldName("pt", "legal:x:title")).toBe("ptLegal:x:title");
  });

  it("honors a custom source locale", () => {
    expect(adminLocaleFieldName("pt", "title", "pt")).toBe("title");
    expect(adminLocaleFieldName("en", "title", "pt")).toBe("enTitle");
  });
});

describe("readLocaleField", () => {
  it("reads the source locale's bare-named field", () => {
    const formData = new FormData();
    formData.set("title", " Lava Ring ");
    expect(readLocaleField(formData, "en", "title")).toBe("Lava Ring");
  });

  it("reads a translation's prefixed field", () => {
    const formData = new FormData();
    formData.set("ptTitle", "Anel de Lava");
    expect(readLocaleField(formData, "pt", "title")).toBe("Anel de Lava");
  });

  it("returns an empty string for a missing or non-string field", () => {
    const formData = new FormData();
    expect(readLocaleField(formData, "ru", "title")).toBe("");
  });
});
