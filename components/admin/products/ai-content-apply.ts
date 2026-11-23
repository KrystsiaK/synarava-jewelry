import type {
  AiField,
  AiLocale,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";
import { AI_FIELDS } from "@/lib/ai/product-content/contract";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import {
  readProductDraftLocaleField,
  writeProductDraftLocaleField,
} from "@/lib/products/product-locale-draft-io";
import {
  getProductLocaleTextField,
  PRODUCT_LOCALE_TEXT_SECTION_LABELS,
  type ProductLocaleTextSection,
} from "@/lib/products/product-locale-text-fields";
import type { ProductDraft } from "@/components/admin/products/product-types";

export { AI_FIELDS };

export const AI_LOCALES: readonly AiLocale[] = ["en", "pt", "ru"] as const;

export type AiFieldSelectionKey = `${AiLocale}:${AiField}`;

export function selectionKey(locale: AiLocale, field: AiField): AiFieldSelectionKey {
  return `${locale}:${field}`;
}

export function parseSelectionKey(key: string): { locale: AiLocale; field: AiField } | null {
  const colon = key.indexOf(":");
  if (colon < 0) return null;
  const locale = key.slice(0, colon) as AiLocale;
  const field = key.slice(colon + 1) as AiField;
  if (!AI_LOCALES.includes(locale) || !AI_FIELDS.includes(field)) return null;
  return { locale, field };
}

/** EN title is never proposed or applied. */
export function isEnTitle(locale: AiLocale, field: AiField): boolean {
  return locale === "en" && field === "title";
}

export function formFieldNameForAi(locale: AiLocale, field: AiField): string {
  if (locale === "en" && field === "title") return "name";
  return adminLocaleFieldName(locale, field, "en");
}

export function readCurrentAiField(
  form: HTMLFormElement | null,
  locale: AiLocale,
  field: AiField,
): string {
  if (!form) return "";
  const value = new FormData(form).get(formFieldNameForAi(locale, field));
  return typeof value === "string" ? value : "";
}

/** Snapshot of AI-target fields used for stale-guard after generate. */
export function fingerprintAiSourceFields(
  form: HTMLFormElement | null,
  locales: readonly AiLocale[],
): string {
  if (!form) return "";
  const parts: string[] = [];
  for (const locale of locales) {
    for (const field of AI_FIELDS) {
      if (isEnTitle(locale, field)) continue;
      parts.push(`${selectionKey(locale, field)}=${readCurrentAiField(form, locale, field)}`);
    }
  }
  return parts.join("\n");
}

export function isAiDraftStale(args: {
  productUpdatedAt: string;
  draftSourceUpdatedAt: string;
  fingerprintAtGenerate: string;
  fingerprintNow: string;
}): boolean {
  if (args.productUpdatedAt !== args.draftSourceUpdatedAt) return true;
  return args.fingerprintAtGenerate !== args.fingerprintNow;
}

export const STALE_APPLY_MESSAGE = "Товар изменился, сгенерируйте заново";

/**
 * Default checkbox: empty current → checked; non-empty current → unchecked;
 * warnings → unchecked (explicit ack); EN title → never.
 */
export function defaultFieldChecked(args: {
  locale: AiLocale;
  field: AiField;
  current: string;
  proposed: string;
  hasWarning: boolean;
}): boolean {
  if (isEnTitle(args.locale, args.field)) return false;
  if (!args.proposed.trim()) return false;
  if (args.hasWarning) return false;
  if (args.current.trim()) return false;
  return true;
}

export function buildDefaultSelections(
  draft: ProductContentDraft,
  getCurrent: (locale: AiLocale, field: AiField) => string,
): Set<AiFieldSelectionKey> {
  const selected = new Set<AiFieldSelectionKey>();
  const warningSet = new Set(
    draft.warnings.map((warning) => selectionKey(warning.locale, warning.field)),
  );

  for (const locale of AI_LOCALES) {
    const localeDraft = draft.locales[locale];
    if (!localeDraft) continue;
    for (const field of AI_FIELDS) {
      if (isEnTitle(locale, field)) continue;
      const proposed = localeDraft[field];
      if (proposed == null) continue;
      const key = selectionKey(locale, field);
      if (
        defaultFieldChecked({
          locale,
          field,
          current: getCurrent(locale, field),
          proposed,
          hasWarning: warningSet.has(key),
        })
      ) {
        selected.add(key);
      }
    }
  }
  return selected;
}

/** Pull current AI-target field values from the live form into a draft copy. */
export function syncAiFieldsFromForm(
  form: HTMLFormElement | null,
  base: ProductDraft,
  locales: readonly AiLocale[] = AI_LOCALES,
): ProductDraft {
  if (!form) return base;
  let next: ProductDraft = {
    ...base,
    translations: { ...base.translations },
    enSpecs: { ...base.enSpecs },
    specOverlays: { ...base.specOverlays },
    details: { ...base.details },
  };
  for (const locale of locales) {
    for (const field of AI_FIELDS) {
      if (isEnTitle(locale, field)) continue;
      next = writeProductDraftLocaleField(
        next,
        locale,
        field,
        readCurrentAiField(form, locale, field),
      );
    }
  }
  return next;
}

export type ApplyAiSelectionsResult = {
  draft: ProductDraft;
  applied: AiFieldSelectionKey[];
  failed: AiFieldSelectionKey[];
};

/** Immutable merge of checked AI fields into the product form draft. Never writes EN title. */
export function applyAiSelectionsToDraft(
  base: ProductDraft,
  draft: ProductContentDraft,
  selected: ReadonlySet<AiFieldSelectionKey>,
): ApplyAiSelectionsResult {
  let next: ProductDraft = {
    ...base,
    translations: { ...base.translations },
    enSpecs: { ...base.enSpecs },
    specOverlays: { ...base.specOverlays },
    details: { ...base.details },
  };
  const applied: AiFieldSelectionKey[] = [];
  const failed: AiFieldSelectionKey[] = [];

  for (const key of selected) {
    const parsed = parseSelectionKey(key);
    if (!parsed) {
      failed.push(key as AiFieldSelectionKey);
      continue;
    }
    const { locale, field } = parsed;
    if (isEnTitle(locale, field)) continue;
    const proposed = draft.locales[locale]?.[field];
    if (proposed == null) {
      failed.push(key);
      continue;
    }
    next = writeProductDraftLocaleField(next, locale, field, proposed);
    if (readProductDraftLocaleField(next, locale, field) === proposed) {
      applied.push(key);
    } else {
      failed.push(key);
    }
  }

  return { draft: next, applied, failed };
}

/** Human-readable list for apply failure toasts. */
export function formatFailedApplyMessage(failed: readonly AiFieldSelectionKey[]): string {
  const labels = failed.map((key) => {
    const parsed = parseSelectionKey(key);
    if (!parsed) return key;
    return `${parsed.locale.toUpperCase()} ${fieldLabel(parsed.field)}`;
  });
  return `Could not apply: ${labels.join(", ")}`;
}

export function formatUsageLine(usage: ProductContentDraft["usage"]): string {
  const cost = usage.costUsd.toFixed(4);
  return `${usage.model} · ${usage.inputTokens}+${usage.outputTokens} tok · $${cost} · ${usage.latencyMs}ms`;
}

export function fieldLabel(field: AiField): string {
  return getProductLocaleTextField(field)?.label ?? field;
}

export function fieldSection(field: AiField): ProductLocaleTextSection {
  return getProductLocaleTextField(field)?.section ?? "product";
}

export function sectionLabel(section: ProductLocaleTextSection): string {
  return PRODUCT_LOCALE_TEXT_SECTION_LABELS[section];
}

/** Group AI fields that appear in a locale draft by preview section. */
export function groupAiFieldsBySection(
  fields: readonly AiField[],
): Array<{ section: ProductLocaleTextSection; fields: AiField[] }> {
  const order: ProductLocaleTextSection[] = ["product", "details", "specs"];
  const buckets = new Map<ProductLocaleTextSection, AiField[]>();
  for (const section of order) buckets.set(section, []);
  for (const field of fields) {
    const section = fieldSection(field);
    buckets.get(section)?.push(field);
  }
  return order
    .map((section) => ({ section, fields: buckets.get(section) ?? [] }))
    .filter((group) => group.fields.length > 0);
}
