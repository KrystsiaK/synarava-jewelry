import { describe, expect, it } from "vitest";

import { normalizeRichTextForStorage } from "@/lib/content/rich-text";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import { characteristicFormKey } from "@/lib/products/characteristics";
import {
  readProductTranslationDetails,
  readProductTranslationFields,
} from "@/lib/products/product-locale-form-read";
import {
  PRODUCT_CORE_TRANSLATABLE_FIELDS,
  PRODUCT_DETAILS_LOOKBOOK_SLOTS,
  PRODUCT_DETAILS_MATERIAL_SLOTS,
  PRODUCT_DETAILS_PROCESS_STAT_SLOTS,
  productLocaleTextFieldsForSection,
} from "@/lib/products/product-locale-text-fields";

const LOCALE = "ru";

/** Registry keys Save readers own (product core + details — not specs overlays). */
function saveOwnedRegistryKeys(): string[] {
  return [
    ...PRODUCT_CORE_TRANSLATABLE_FIELDS,
    ...productLocaleTextFieldsForSection("details").map((field) => field.key),
  ];
}

function uniqueValue(key: string): string {
  return `uniq-${LOCALE}-${key}`;
}

function buildRuFormData(keys: string[]): FormData {
  const form = new FormData();
  for (const key of keys) {
    form.set(adminLocaleFieldName(LOCALE, key), uniqueValue(key));
  }
  return form;
}

function expectedStored(key: string): string {
  const raw = uniqueValue(key);
  if (key.startsWith("materialBody") || key === "description" || key === "shortDescription"
    || key === "symbolismBody" || key === "symbolismBody2" || key === "seoDescription") {
    return normalizeRichTextForStorage(raw) || raw;
  }
  return raw;
}

function flattenDetailsResult(
  details: ReturnType<typeof readProductTranslationDetails>,
): Record<string, string> {
  const out: Record<string, string> = {
    materialsEyebrow: details.materialsEyebrow,
    materialsTitle: details.materialsTitle,
    processEyebrow: details.process.eyebrow,
    processTitle: details.process.title,
    lookbookEyebrow: details.lookbookEyebrow,
    lookbookTitle: details.lookbookTitle,
  };
  details.materials.forEach((material, index) => {
    out[`materialTitle${index + 1}`] = material.title;
    out[`materialBody${index + 1}`] = material.body;
  });
  details.process.stats.forEach((stat, index) => {
    out[`processStatValue${index + 1}`] = stat.value;
    out[`processStatLabel${index + 1}`] = stat.label;
  });
  details.lookbook.forEach((item, index) => {
    out[`lookbookLabel${index + 1}`] = item.label;
  });
  for (const [key, value] of Object.entries(details.characteristics)) {
    out[characteristicFormKey(key)] = value;
  }
  return out;
}

describe("product-locale-form-read ↔ registry (Save guard)", () => {
  it("reads every registry product+details key for ru from FormData", () => {
    const keys = saveOwnedRegistryKeys();
    const form = buildRuFormData(keys);
    const fields = readProductTranslationFields(form, LOCALE);
    const details = readProductTranslationDetails(form, LOCALE);
    const flatDetails = flattenDetailsResult(details);

    for (const key of PRODUCT_CORE_TRANSLATABLE_FIELDS) {
      expect(fields[key], key).toBe(expectedStored(key));
    }
    for (const key of productLocaleTextFieldsForSection("details").map((f) => f.key)) {
      expect(flatDetails[key], key).toBe(expectedStored(key));
    }
  });

  it("does not read details slot N+1 (inverse of registry length)", () => {
    const keys = saveOwnedRegistryKeys();
    const form = buildRuFormData(keys);
    const beyond = PRODUCT_DETAILS_MATERIAL_SLOTS + 1;
    const beyondTitle = `materialTitle${beyond}`;
    const beyondBody = `materialBody${beyond}`;
    form.set(adminLocaleFieldName(LOCALE, beyondTitle), uniqueValue(beyondTitle));
    form.set(adminLocaleFieldName(LOCALE, beyondBody), uniqueValue(beyondBody));

    const details = readProductTranslationDetails(form, LOCALE);
    expect(details.materials).toHaveLength(PRODUCT_DETAILS_MATERIAL_SLOTS);
    expect(details.materials.some((m) => m.title === uniqueValue(beyondTitle))).toBe(false);
    expect(details.materials.some((m) => m.body === uniqueValue(beyondBody))).toBe(false);

    const beyondStat = PRODUCT_DETAILS_PROCESS_STAT_SLOTS + 1;
    form.set(
      adminLocaleFieldName(LOCALE, `processStatValue${beyondStat}`),
      uniqueValue(`processStatValue${beyondStat}`),
    );
    form.set(
      adminLocaleFieldName(LOCALE, `processStatLabel${beyondStat}`),
      uniqueValue(`processStatLabel${beyondStat}`),
    );
    const details2 = readProductTranslationDetails(form, LOCALE);
    expect(details2.process.stats).toHaveLength(PRODUCT_DETAILS_PROCESS_STAT_SLOTS);

    const beyondLook = PRODUCT_DETAILS_LOOKBOOK_SLOTS + 1;
    form.set(
      adminLocaleFieldName(LOCALE, `lookbookLabel${beyondLook}`),
      uniqueValue(`lookbookLabel${beyondLook}`),
    );
    const details3 = readProductTranslationDetails(form, LOCALE);
    expect(details3.lookbook).toHaveLength(PRODUCT_DETAILS_LOOKBOOK_SLOTS);
  });

  /**
   * Mutation proof (manual): bump PRODUCT_DETAILS_MATERIAL_SLOTS to 4 while
   * leaving Save on a hardcoded [1,2,3] → first test fails (materialTitle4
   * missing from result). Restoring Save to `Array.from({ length:
   * PRODUCT_DETAILS_MATERIAL_SLOTS })` makes it pass again.
   */
  it("material slot count in registry matches Save materials length", () => {
    const keys = saveOwnedRegistryKeys();
    const form = buildRuFormData(keys);
    const details = readProductTranslationDetails(form, LOCALE);
    expect(details.materials).toHaveLength(PRODUCT_DETAILS_MATERIAL_SLOTS);
    expect(keys).toContain(`materialTitle${PRODUCT_DETAILS_MATERIAL_SLOTS}`);
    expect(keys).not.toContain(`materialTitle${PRODUCT_DETAILS_MATERIAL_SLOTS + 1}`);
  });
});
