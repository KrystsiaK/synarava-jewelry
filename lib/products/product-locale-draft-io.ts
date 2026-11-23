import type {
  ProductDraft,
  ProductLocaleDetailsDraft,
  ProductLocaleDraft,
} from "@/components/admin/products/product-types";
import { emptyLocaleDraft } from "@/components/admin/products/product-helpers";
import {
  PRODUCT_CORE_TRANSLATABLE_FIELDS,
  PRODUCT_DETAILS_LOOKBOOK_SLOTS,
  PRODUCT_DETAILS_MATERIAL_SLOTS,
  PRODUCT_DETAILS_PROCESS_STAT_SLOTS,
  getProductLocaleTextField,
  shopifySpecKeyFromLocaleFieldKey,
  type ProductCoreTranslatableField,
} from "@/lib/products/product-locale-text-fields";
import { characteristicFormKey } from "@/lib/products/characteristics";

const CORE_SET = new Set<string>(PRODUCT_CORE_TRANSLATABLE_FIELDS);

function padMaterials(details: ProductLocaleDetailsDraft): ProductLocaleDetailsDraft["materials"] {
  return Array.from({ length: PRODUCT_DETAILS_MATERIAL_SLOTS }, (_, index) =>
    details.materials[index] ?? { title: "", body: "" },
  );
}

function padStats(details: ProductLocaleDetailsDraft): ProductLocaleDetailsDraft["process"]["stats"] {
  return Array.from({ length: PRODUCT_DETAILS_PROCESS_STAT_SLOTS }, (_, index) =>
    details.process.stats[index] ?? { value: "", label: "" },
  );
}

function padLookbook(details: ProductLocaleDetailsDraft): ProductLocaleDetailsDraft["lookbook"] {
  return Array.from({ length: PRODUCT_DETAILS_LOOKBOOK_SLOTS }, (_, index) =>
    details.lookbook[index] ?? { label: "" },
  );
}

export function readDetailsLocaleField(details: ProductLocaleDetailsDraft, field: string): string {
  if (field === "materialsEyebrow") return details.materialsEyebrow;
  if (field === "materialsTitle") return details.materialsTitle;
  if (field === "processEyebrow") return details.process.eyebrow;
  if (field === "processTitle") return details.process.title;
  if (field === "lookbookEyebrow") return details.lookbookEyebrow;
  if (field === "lookbookTitle") return details.lookbookTitle;

  const materialTitle = /^materialTitle(\d+)$/.exec(field);
  if (materialTitle) {
    const index = Number(materialTitle[1]) - 1;
    return padMaterials(details)[index]?.title ?? "";
  }
  const materialBody = /^materialBody(\d+)$/.exec(field);
  if (materialBody) {
    const index = Number(materialBody[1]) - 1;
    return padMaterials(details)[index]?.body ?? "";
  }
  const statValue = /^processStatValue(\d+)$/.exec(field);
  if (statValue) {
    const index = Number(statValue[1]) - 1;
    return padStats(details)[index]?.value ?? "";
  }
  const statLabel = /^processStatLabel(\d+)$/.exec(field);
  if (statLabel) {
    const index = Number(statLabel[1]) - 1;
    return padStats(details)[index]?.label ?? "";
  }
  const lookbookLabel = /^lookbookLabel(\d+)$/.exec(field);
  if (lookbookLabel) {
    const index = Number(lookbookLabel[1]) - 1;
    return padLookbook(details)[index]?.label ?? "";
  }
  if (field.startsWith("characteristic_")) {
    const key = field.slice("characteristic_".length);
    return details.characteristics[key] ?? "";
  }
  return "";
}

export function writeDetailsLocaleField(
  details: ProductLocaleDetailsDraft,
  field: string,
  value: string,
): ProductLocaleDetailsDraft {
  if (field === "materialsEyebrow") return { ...details, materialsEyebrow: value };
  if (field === "materialsTitle") return { ...details, materialsTitle: value };
  if (field === "processEyebrow") {
    return { ...details, process: { ...details.process, eyebrow: value } };
  }
  if (field === "processTitle") {
    return { ...details, process: { ...details.process, title: value } };
  }
  if (field === "lookbookEyebrow") return { ...details, lookbookEyebrow: value };
  if (field === "lookbookTitle") return { ...details, lookbookTitle: value };

  const materialTitle = /^materialTitle(\d+)$/.exec(field);
  if (materialTitle) {
    const index = Number(materialTitle[1]) - 1;
    const materials = padMaterials(details).map((item, i) =>
      i === index ? { ...item, title: value } : item,
    );
    return { ...details, materials };
  }
  const materialBody = /^materialBody(\d+)$/.exec(field);
  if (materialBody) {
    const index = Number(materialBody[1]) - 1;
    const materials = padMaterials(details).map((item, i) =>
      i === index ? { ...item, body: value } : item,
    );
    return { ...details, materials };
  }
  const statValue = /^processStatValue(\d+)$/.exec(field);
  if (statValue) {
    const index = Number(statValue[1]) - 1;
    const stats = padStats(details).map((item, i) =>
      i === index ? { ...item, value } : item,
    );
    return { ...details, process: { ...details.process, stats } };
  }
  const statLabel = /^processStatLabel(\d+)$/.exec(field);
  if (statLabel) {
    const index = Number(statLabel[1]) - 1;
    const stats = padStats(details).map((item, i) =>
      i === index ? { ...item, label: value } : item,
    );
    return { ...details, process: { ...details.process, stats } };
  }
  const lookbookLabel = /^lookbookLabel(\d+)$/.exec(field);
  if (lookbookLabel) {
    const index = Number(lookbookLabel[1]) - 1;
    const lookbook = padLookbook(details).map((item, i) =>
      i === index ? { ...item, label: value } : item,
    );
    return { ...details, lookbook };
  }
  if (field.startsWith("characteristic_")) {
    const key = field.slice("characteristic_".length);
    return {
      ...details,
      characteristics: { ...details.characteristics, [key]: value },
    };
  }
  return details;
}

function readCoreFromLocaleDraft(localeDraft: ProductLocaleDraft, field: ProductCoreTranslatableField): string {
  if (field === "title") return localeDraft.title;
  if (field === "shortDescription") return localeDraft.shortDescription;
  if (field === "description") return localeDraft.description;
  if (field === "materialLine") return localeDraft.materialLine;
  if (field === "symbolismLabel") return localeDraft.symbolismLabel;
  if (field === "symbolismTitle") return localeDraft.symbolismTitle;
  if (field === "symbolismBody") return localeDraft.symbolismBody;
  if (field === "symbolismBody2") return localeDraft.symbolismBody2;
  if (field === "seoTitle") return localeDraft.seoTitle;
  return localeDraft.seoDescription;
}

function writeCoreToLocaleDraft(
  localeDraft: ProductLocaleDraft,
  field: ProductCoreTranslatableField,
  value: string,
): ProductLocaleDraft {
  if (field === "title") return { ...localeDraft, title: value };
  if (field === "shortDescription") return { ...localeDraft, shortDescription: value };
  if (field === "description") return { ...localeDraft, description: value };
  if (field === "materialLine") return { ...localeDraft, materialLine: value };
  if (field === "symbolismLabel") return { ...localeDraft, symbolismLabel: value };
  if (field === "symbolismTitle") return { ...localeDraft, symbolismTitle: value };
  if (field === "symbolismBody") return { ...localeDraft, symbolismBody: value };
  if (field === "symbolismBody2") return { ...localeDraft, symbolismBody2: value };
  if (field === "seoTitle") return { ...localeDraft, seoTitle: value };
  return { ...localeDraft, seoDescription: value };
}

function readCoreFromEnDraft(draft: ProductDraft, field: ProductCoreTranslatableField): string {
  if (field === "title") return draft.name;
  if (field === "shortDescription") return draft.shortDescription;
  if (field === "description") return draft.description;
  if (field === "materialLine") return draft.materialLine;
  if (field === "symbolismLabel") return draft.symbolismLabel;
  if (field === "symbolismTitle") return draft.symbolismTitle;
  if (field === "symbolismBody") return draft.symbolismBody;
  if (field === "symbolismBody2") return draft.symbolismBody2;
  if (field === "seoTitle") return draft.seoTitle;
  return draft.seoDescription;
}

function writeCoreToEnDraft(
  draft: ProductDraft,
  field: ProductCoreTranslatableField,
  value: string,
): ProductDraft {
  if (field === "title") return draft; // EN title never applied
  if (field === "shortDescription") return { ...draft, shortDescription: value };
  if (field === "description") return { ...draft, description: value };
  if (field === "materialLine") return { ...draft, materialLine: value };
  if (field === "symbolismLabel") return { ...draft, symbolismLabel: value };
  if (field === "symbolismTitle") return { ...draft, symbolismTitle: value };
  if (field === "symbolismBody") return { ...draft, symbolismBody: value };
  if (field === "symbolismBody2") return { ...draft, symbolismBody2: value };
  if (field === "seoTitle") return { ...draft, seoTitle: value };
  return { ...draft, seoDescription: value };
}

function ensureLocale(base: ProductDraft, locale: string): ProductDraft {
  if (locale === "en" || base.translations[locale]) return base;
  return {
    ...base,
    translations: {
      ...base.translations,
      [locale]: emptyLocaleDraft(),
    },
  };
}

/** Read one AI/Save locale field from the product form draft. */
export function readProductDraftLocaleField(
  draft: ProductDraft,
  locale: string,
  field: string,
): string {
  const def = getProductLocaleTextField(field);
  if (!def) return "";

  if (def.section === "specs") {
    const specKey = shopifySpecKeyFromLocaleFieldKey(field);
    if (!specKey) return "";
    if (locale === "en") return draft.enSpecs[specKey] ?? "";
    return draft.specOverlays[locale]?.[specKey] ?? "";
  }

  if (def.section === "details") {
    if (locale === "en") return readDetailsLocaleField(draft.details, field);
    const localeDraft = draft.translations[locale];
    if (!localeDraft) return "";
    return readDetailsLocaleField(localeDraft.details, field);
  }

  // product (core)
  if (!CORE_SET.has(field)) return "";
  const coreField = field as ProductCoreTranslatableField;
  if (locale === "en") return readCoreFromEnDraft(draft, coreField);
  const localeDraft = draft.translations[locale];
  if (!localeDraft) return "";
  return readCoreFromLocaleDraft(localeDraft, coreField);
}

/** Immutable write of one AI/Save locale field into the product form draft. */
export function writeProductDraftLocaleField(
  draft: ProductDraft,
  locale: string,
  field: string,
  value: string,
): ProductDraft {
  const def = getProductLocaleTextField(field);
  if (!def) return draft;
  if (locale === "en" && field === "title") return draft;

  if (def.section === "specs") {
    const specKey = shopifySpecKeyFromLocaleFieldKey(field);
    if (!specKey) return draft;
    if (locale === "en") {
      return { ...draft, enSpecs: { ...draft.enSpecs, [specKey]: value } };
    }
    const withLocale = ensureLocale(draft, locale);
    return {
      ...withLocale,
      specOverlays: {
        ...withLocale.specOverlays,
        [locale]: {
          ...(withLocale.specOverlays[locale] ?? {}),
          [specKey]: value,
        },
      },
    };
  }

  if (def.section === "details") {
    if (locale === "en") {
      return {
        ...draft,
        details: writeDetailsLocaleField(draft.details, field, value),
      };
    }
    const withLocale = ensureLocale(draft, locale);
    const existing = withLocale.translations[locale] ?? emptyLocaleDraft();
    return {
      ...withLocale,
      translations: {
        ...withLocale.translations,
        [locale]: {
          ...existing,
          details: writeDetailsLocaleField(existing.details, field, value),
        },
      },
    };
  }

  if (!CORE_SET.has(field)) return draft;
  const coreField = field as ProductCoreTranslatableField;
  if (locale === "en") return writeCoreToEnDraft(draft, coreField, value);
  const withLocale = ensureLocale(draft, locale);
  const existing = withLocale.translations[locale] ?? emptyLocaleDraft();
  return {
    ...withLocale,
    translations: {
      ...withLocale.translations,
      [locale]: writeCoreToLocaleDraft(existing, coreField, value),
    },
  };
}

/** Overlay EN text details onto editor details (keeps shared images/media). */
export function mergeEditorDetailsText<T extends {
  materialsEyebrow: string;
  materialsTitle: string;
  materials: Array<{ title: string; body: string; image?: string }>;
  process: { eyebrow: string; title: string; stats: Array<{ value: string; label: string }>; mediaImage?: string };
  lookbookEyebrow: string;
  lookbookTitle: string;
  lookbook: Array<{ label: string; src?: string; featured?: boolean }>;
}>(editor: T, text: ProductLocaleDetailsDraft): T {
  return {
    ...editor,
    materialsEyebrow: text.materialsEyebrow,
    materialsTitle: text.materialsTitle,
    materials: editor.materials.map((material, index) => ({
      ...material,
      title: text.materials[index]?.title ?? material.title,
      body: text.materials[index]?.body ?? material.body,
    })),
    process: {
      ...editor.process,
      eyebrow: text.process.eyebrow,
      title: text.process.title,
      stats: editor.process.stats.map((stat, index) => ({
        ...stat,
        value: text.process.stats[index]?.value ?? stat.value,
        label: text.process.stats[index]?.label ?? stat.label,
      })),
    },
    lookbookEyebrow: text.lookbookEyebrow,
    lookbookTitle: text.lookbookTitle,
    lookbook: editor.lookbook.map((item, index) => ({
      ...item,
      label: text.lookbook[index]?.label ?? item.label,
    })),
  };
}

export { characteristicFormKey };
