import type {
  AiField,
  AiLocale,
  ProductContentDraft,
} from "@/lib/ai/product-content/contract";
import { adminLocaleFieldName } from "@/lib/i18n/admin-locale-fields";
import type { ProductDraft, ProductLocaleDraft } from "@/components/admin/products/product-types";

export const AI_FIELDS: readonly AiField[] = [
  "title",
  "shortDescription",
  "description",
  "seoTitle",
  "seoDescription",
] as const;

export const AI_LOCALES: readonly AiLocale[] = ["en", "pt", "ru"] as const;

export type AiFieldSelectionKey = `${AiLocale}:${AiField}`;

export function selectionKey(locale: AiLocale, field: AiField): AiFieldSelectionKey {
  return `${locale}:${field}`;
}

export function parseSelectionKey(key: string): { locale: AiLocale; field: AiField } | null {
  const [locale, field] = key.split(":") as [AiLocale, AiField];
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

function withLocaleField(
  localeDraft: ProductLocaleDraft,
  field: AiField,
  value: string,
): ProductLocaleDraft {
  if (field === "title") return { ...localeDraft, title: value };
  if (field === "shortDescription") return { ...localeDraft, shortDescription: value };
  if (field === "description") return { ...localeDraft, description: value };
  if (field === "seoTitle") return { ...localeDraft, seoTitle: value };
  return { ...localeDraft, seoDescription: value };
}

function writeDraftField(
  base: ProductDraft,
  locale: AiLocale,
  field: AiField,
  value: string,
): ProductDraft {
  if (isEnTitle(locale, field)) return base;
  if (locale === "en") {
    if (field === "shortDescription") return { ...base, shortDescription: value };
    if (field === "description") return { ...base, description: value };
    if (field === "seoTitle") return { ...base, seoTitle: value };
    if (field === "seoDescription") return { ...base, seoDescription: value };
    return base;
  }
  const existing = base.translations[locale];
  if (!existing) return base;
  return {
    ...base,
    translations: {
      ...base.translations,
      [locale]: withLocaleField(existing, field, value),
    },
  };
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
  };
  for (const locale of locales) {
    for (const field of AI_FIELDS) {
      if (isEnTitle(locale, field)) continue;
      if (locale !== "en" && !next.translations[locale]) continue;
      next = writeDraftField(next, locale, field, readCurrentAiField(form, locale, field));
    }
  }
  return next;
}

/** Immutable merge of checked AI fields into the product form draft. Never writes EN title. */
export function applyAiSelectionsToDraft(
  base: ProductDraft,
  draft: ProductContentDraft,
  selected: ReadonlySet<AiFieldSelectionKey>,
): ProductDraft {
  let next: ProductDraft = {
    ...base,
    translations: { ...base.translations },
  };

  for (const key of selected) {
    const parsed = parseSelectionKey(key);
    if (!parsed) continue;
    const { locale, field } = parsed;
    if (isEnTitle(locale, field)) continue;
    const proposed = draft.locales[locale]?.[field];
    if (proposed == null) continue;
    next = writeDraftField(next, locale, field, proposed);
  }

  return next;
}

export function formatUsageLine(usage: ProductContentDraft["usage"]): string {
  const cost = usage.costUsd.toFixed(4);
  return `${usage.model} · ${usage.inputTokens}+${usage.outputTokens} tok · $${cost} · ${usage.latencyMs}ms`;
}

export function fieldLabel(field: AiField): string {
  switch (field) {
    case "title":
      return "Title";
    case "shortDescription":
      return "Short description";
    case "description":
      return "Description";
    case "seoTitle":
      return "SEO title";
    case "seoDescription":
      return "SEO description";
  }
}
