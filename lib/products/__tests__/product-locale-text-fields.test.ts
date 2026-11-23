import { describe, expect, it } from "vitest";

import {
  PRODUCT_CORE_TRANSLATABLE_FIELDS,
  PRODUCT_LOCALE_TEXT_FIELDS,
  PRODUCT_LOCALE_TEXT_FIELD_KEYS,
  getProductLocaleTextField,
  modelTranslatableProductLocaleFields,
  productLocaleTextFieldsForSection,
  shopifySpecKeyFromLocaleFieldKey,
  shopifySpecLocaleFieldKey,
} from "@/lib/products/product-locale-text-fields";
import { SHOPIFY_PRODUCT_SPEC_FIELDS } from "@/lib/products/shopify-product-specs";

describe("product-locale-text-fields (shared Save + AI list)", () => {
  it("includes every core ProductTranslation flat key once", () => {
    for (const key of PRODUCT_CORE_TRANSLATABLE_FIELDS) {
      expect(PRODUCT_LOCALE_TEXT_FIELD_KEYS).toContain(key);
      expect(getProductLocaleTextField(key)?.section).toBe("product");
    }
  });

  it("includes details slot keys used by readProductTranslationDetails", () => {
    for (const key of [
      "materialsEyebrow",
      "materialsTitle",
      "materialTitle1",
      "materialBody1",
      "materialTitle3",
      "materialBody3",
      "processEyebrow",
      "processTitle",
      "processStatValue1",
      "processStatLabel4",
      "lookbookEyebrow",
      "lookbookTitle",
      "lookbookLabel1",
      "lookbookLabel4",
    ]) {
      expect(PRODUCT_LOCALE_TEXT_FIELD_KEYS).toContain(key);
      expect(getProductLocaleTextField(key)?.section).toBe("details");
    }
  });

  it("includes every Shopify product-spec free-text overlay as model-translatable", () => {
    for (const spec of SHOPIFY_PRODUCT_SPEC_FIELDS) {
      const key = shopifySpecLocaleFieldKey(spec.key);
      expect(PRODUCT_LOCALE_TEXT_FIELD_KEYS).toContain(key);
      expect(shopifySpecKeyFromLocaleFieldKey(key)).toBe(spec.key);
      expect(getProductLocaleTextField(key)?.section).toBe("specs");
      expect(getProductLocaleTextField(key)?.translationMode).toBe("model");
    }
  });

  it("keeps unique keys and stable section buckets", () => {
    expect(new Set(PRODUCT_LOCALE_TEXT_FIELD_KEYS).size).toBe(PRODUCT_LOCALE_TEXT_FIELD_KEYS.length);
    expect(productLocaleTextFieldsForSection("product").length).toBe(PRODUCT_CORE_TRANSLATABLE_FIELDS.length);
    expect(productLocaleTextFieldsForSection("specs").length).toBe(SHOPIFY_PRODUCT_SPEC_FIELDS.length);
    expect(PRODUCT_LOCALE_TEXT_FIELDS.length).toBeGreaterThan(30);
  });

  it("modelTranslatableProductLocaleFields excludes taxonomy-mode entries", () => {
    for (const field of modelTranslatableProductLocaleFields()) {
      expect(field.translationMode).toBe("model");
    }
  });
});
