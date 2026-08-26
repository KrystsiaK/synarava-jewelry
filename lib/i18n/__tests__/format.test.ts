import { formatCurrency, localeTag, shopifyLanguage } from "@/lib/i18n/format";

describe("locale-aware commerce formatting", () => {
  it("formats EUR for English and Portuguese conventions", () => {
    expect(formatCurrency(12.5, "EUR", "en")).toBe("€12.50");
    expect(formatCurrency(12.5, "EUR", "pt")).toMatch(/12,50\s*€/);
  });

  it("maps storefront locales to regional and Shopify language codes", () => {
    expect(localeTag("en")).toBe("en-IE");
    expect(localeTag("pt")).toBe("pt-PT");
    expect(shopifyLanguage("en")).toBe("EN");
    expect(shopifyLanguage("pt")).toBe("PT");
  });
});
