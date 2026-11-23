import { normalizeRichTextForStorage } from "@/lib/content/rich-text";
import { readLocaleField } from "@/lib/i18n/admin-locale-fields";
import { readCharacteristicTextOverlayFromForm } from "@/lib/products/characteristics";
import {
  PRODUCT_CORE_TRANSLATABLE_FIELDS,
  PRODUCT_DETAILS_LOOKBOOK_SLOTS,
  PRODUCT_DETAILS_MATERIAL_SLOTS,
  PRODUCT_DETAILS_PROCESS_STAT_SLOTS,
} from "@/lib/products/product-locale-text-fields";

/**
 * Locale FormData readers shared by `saveProductAction` and guard tests.
 * Slot counts come only from `PRODUCT_DETAILS_*_SLOTS` — never parallel literals.
 */

/** Flat ProductTranslation columns for one locale. */
export function readProductTranslationFields(formData: FormData, locale: string) {
  const fields = Object.fromEntries(
    PRODUCT_CORE_TRANSLATABLE_FIELDS.map((key) => [key, readLocaleField(formData, locale, key)]),
  ) as Record<(typeof PRODUCT_CORE_TRANSLATABLE_FIELDS)[number], string>;
  return {
    ...fields,
    // Shared product.slug is the only URL path — no per-locale handle overrides.
    localizedHandle: "",
    reviewedFlag: readLocaleField(formData, locale, "reviewed"),
  };
}

/**
 * One locale's `details` (materials/process/lookbook) text — images/src/
 * mediaImage are shared with English and never re-uploaded per locale.
 */
export function readProductTranslationDetails(formData: FormData, locale: string) {
  const materials = Array.from({ length: PRODUCT_DETAILS_MATERIAL_SLOTS }, (_, offset) => {
    const index = offset + 1;
    return {
      title: readLocaleField(formData, locale, `materialTitle${index}`),
      body: normalizeRichTextForStorage(readLocaleField(formData, locale, `materialBody${index}`)),
    };
  });
  const stats = Array.from({ length: PRODUCT_DETAILS_PROCESS_STAT_SLOTS }, (_, offset) => {
    const index = offset + 1;
    return {
      value: readLocaleField(formData, locale, `processStatValue${index}`),
      label: readLocaleField(formData, locale, `processStatLabel${index}`),
    };
  }).filter((item) => item.value && item.label);
  const lookbook = Array.from({ length: PRODUCT_DETAILS_LOOKBOOK_SLOTS }, (_, offset) => {
    const index = offset + 1;
    return { label: readLocaleField(formData, locale, `lookbookLabel${index}`) };
  }).filter((item) => item.label);
  const characteristics = readCharacteristicTextOverlayFromForm(formData, locale);
  return {
    characteristics,
    materialsEyebrow: readLocaleField(formData, locale, "materialsEyebrow"),
    materialsTitle: readLocaleField(formData, locale, "materialsTitle"),
    materials: materials.filter((item) => item.title && item.body),
    process: {
      eyebrow: readLocaleField(formData, locale, "processEyebrow"),
      title: readLocaleField(formData, locale, "processTitle"),
      stats,
    },
    lookbookEyebrow: readLocaleField(formData, locale, "lookbookEyebrow"),
    lookbookTitle: readLocaleField(formData, locale, "lookbookTitle"),
    lookbook,
  };
}
