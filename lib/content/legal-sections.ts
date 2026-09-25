import { slugify } from "@/lib/text/slug";
import { hasContent } from "@/lib/i18n/localized-content";

export type LegalSectionMeta = { id: string; label: string };

export type LegalSectionContent = { label?: string; title?: string; body?: string };

export type LegalSectionDefault = { title: string; body: string };

/** Editable / persisted section row (order is array order). */
export type LegalSectionEntry = {
  id: string;
  label: string;
  title: string;
  body: string;
};

export type ResolvedLegalSection = { id: string; label: string; title: string; body: string };

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (
    Object.hasOwn(vars, key) ? vars[key] : match
  ));
}

export function buildLegalSectionEntries(
  sections: LegalSectionMeta[],
  defaults: Record<string, LegalSectionDefault>,
): LegalSectionEntry[] {
  return sections.map(({ id, label }) => ({
    id,
    label,
    title: defaults[id]?.title ?? "",
    body: defaults[id]?.body ?? "",
  }));
}

function asSectionEntry(value: unknown): LegalSectionEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!id) return null;
  return {
    id,
    label: typeof row.label === "string" ? row.label : "",
    title: typeof row.title === "string" ? row.title : "",
    body: typeof row.body === "string" ? row.body : "",
  };
}

/**
 * Accepts the new ordered array shape or the legacy Record<id, {title,body}>.
 * When `content` is missing, returns a copy of `fallback` (shipped seed).
 * When `content` is an array (including empty), that array is authoritative.
 * When `content` is a legacy record, structure/labels come from `fallback`
 * and title/body overlay from the record (empty stays empty).
 */
export function normalizeLegalSectionEntries(
  content: unknown,
  fallback: LegalSectionEntry[] = [],
): LegalSectionEntry[] {
  if (Array.isArray(content)) {
    return content.flatMap((item) => {
      const entry = asSectionEntry(item);
      return entry ? [entry] : [];
    });
  }

  if (content && typeof content === "object") {
    const record = content as Record<string, LegalSectionContent>;
    if (fallback.length > 0) {
      return fallback.map((shipped) => {
        const saved = record[shipped.id];
        return {
          id: shipped.id,
          label: saved?.label?.trim() || shipped.label,
          title: saved?.title ?? "",
          body: saved?.body ?? "",
        };
      });
    }
    return Object.entries(record).map(([id, saved]) => ({
      id,
      label: saved?.label?.trim() || id,
      title: saved?.title ?? "",
      body: saved?.body ?? "",
    }));
  }

  return fallback.map((entry) => ({ ...entry }));
}

/**
 * Admin draft seed: missing content → shipped defaults (useful first open).
 * Explicit array (including `[]`) is kept as saved. Legacy records keep
 * empty title/body rather than re-filling shipped copy.
 */
export function seedLegalSectionEntries(
  content: unknown,
  shipped: LegalSectionEntry[],
): LegalSectionEntry[] {
  if (content == null) {
    return shipped.map((entry) => ({ ...entry }));
  }
  if (Array.isArray(content)) {
    return normalizeLegalSectionEntries(content, []);
  }
  return normalizeLegalSectionEntries(
    content,
    shipped.map((entry) => ({ ...entry, title: "", body: "" })),
  );
}

export function uniqueLegalSectionId(label: string, existingIds: Iterable<string>): string {
  const used = new Set(existingIds);
  const base = slugify(label).replace(/^\d+-/, "") || "section";
  let id = base;
  let n = 2;
  while (used.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

/**
 * Legacy fixed-skeleton resolver. Prefer {@link resolveDocumentSections}
 * once section structure is admin-owned.
 */
export function resolveLegalSections(
  sections: LegalSectionMeta[],
  content: Record<string, LegalSectionContent> | LegalSectionEntry[] | undefined,
  defaults: Record<string, LegalSectionDefault>,
  vars: Record<string, string> = {},
): ResolvedLegalSection[] {
  if (Array.isArray(content)) {
    return content.map((entry) => ({
      id: entry.id,
      label: interpolate(entry.label, vars),
      title: interpolate(entry.title?.trim() || "", vars),
      body: interpolate(entry.body?.trim() || "", vars),
    }));
  }

  return sections.map(({ id, label }) => {
    const override = content?.[id];
    const fallback = defaults[id] ?? { title: "", body: "" };
    const title = override?.title?.trim() || fallback.title;
    const body = override?.body?.trim() || fallback.body;
    const resolvedLabel = override?.label?.trim() || label;
    return {
      id,
      label: interpolate(resolvedLabel, vars),
      title: interpolate(title, vars),
      body: interpolate(body, vars),
    };
  });
}

/**
 * Storefront resolver for admin-owned section lists.
 * - Document not saved yet → shipped entries (interpolated).
 * - Saved array → that array only (empty means empty).
 * - Saved legacy record → shipped skeleton for order/labels; empty title/body
 *   stay empty (no silent revert to today's shipped copy).
 */
export function resolveDocumentSections(
  content: unknown,
  shipped: LegalSectionEntry[],
  savedDocument: boolean,
  vars: Record<string, string> = {},
): ResolvedLegalSection[] {
  if (!savedDocument) {
    return shipped.map((entry) => ({
      id: entry.id,
      label: interpolate(entry.label, vars),
      title: interpolate(entry.title, vars),
      body: interpolate(entry.body, vars),
    }));
  }

  if (Array.isArray(content)) {
    return content.flatMap((item) => {
      const entry = asSectionEntry(item);
      if (!entry) return [];
      return [{
        id: entry.id,
        label: interpolate(entry.label, vars),
        title: interpolate(entry.title.trim(), vars),
        body: interpolate(entry.body.trim(), vars),
      }];
    });
  }

  const skeleton = shipped.map((entry) => ({ ...entry, title: "", body: "" }));
  return normalizeLegalSectionEntries(content, skeleton).map((entry) => ({
    id: entry.id,
    label: interpolate(entry.label, vars),
    title: interpolate(entry.title.trim(), vars),
    body: interpolate(entry.body.trim(), vars),
  }));
}

/**
 * Service pages (care/faq/…) keep field-level fallback to shipped defaults
 * for legacy records; once saved as an ordered array, that array is
 * authoritative (including empty).
 */
export function resolveServiceDocumentSections(
  content: unknown,
  shipped: LegalSectionEntry[],
): ResolvedLegalSection[] {
  if (Array.isArray(content)) {
    return resolveDocumentSections(content, shipped, true);
  }
  return resolveLegalSections(
    shipped.map(({ id, label }) => ({ id, label })),
    content as Record<string, LegalSectionContent> | undefined,
    Object.fromEntries(shipped.map((entry) => [entry.id, { title: entry.title, body: entry.body }])),
  );
}

export function resolveLegalText(
  override: string | undefined,
  fallback: string,
  vars: Record<string, string> = {},
): string {
  return interpolate(override?.trim() || fallback, vars);
}

/**
 * True once a Legal Document's Page row exists — the gate that decides
 * whether defaults may still fill empty fields on the storefront.
 */
export function isSavedLegalDocument<T>(page: T | null | undefined): page is T {
  return page != null;
}

/**
 * Section lists keep source order/ids (structure). Localized label/title/body
 * overlay field-by-field so a partial translation cannot delete sections.
 *
 * Returns an array when the source is an array; a record when the source is
 * still the legacy map shape.
 */
export function mergeLocalizedLegalSections(
  source: unknown,
  translation: unknown,
): LegalSectionEntry[] | Record<string, LegalSectionContent> | undefined {
  if (Array.isArray(source)) {
    const sourceEntries = normalizeLegalSectionEntries(source, []);
    const translationEntries = normalizeLegalSectionEntries(translation, []);
    const translationById = new Map(translationEntries.map((entry) => [entry.id, entry]));

    return sourceEntries.map((entry) => {
      const localized = translationById.get(entry.id);
      if (!localized) return { ...entry };
      return {
        id: entry.id,
        label: hasContent(localized.label) ? localized.label : entry.label,
        title: hasContent(localized.title) ? localized.title : entry.title,
        body: hasContent(localized.body) ? localized.body : entry.body,
      };
    });
  }

  if (!source || typeof source !== "object") return undefined;

  const sourceRecord = source as Record<string, LegalSectionContent>;
  const translationRecord = (
    Array.isArray(translation)
      ? Object.fromEntries(
          normalizeLegalSectionEntries(translation, []).map((entry) => [
            entry.id,
            { label: entry.label, title: entry.title, body: entry.body },
          ]),
        )
      : translation && typeof translation === "object"
        ? translation as Record<string, LegalSectionContent>
        : {}
  );

  return Object.fromEntries(
    Object.keys(sourceRecord).map((id) => {
      const entry = sourceRecord[id] ?? {};
      const localized = translationRecord[id] ?? {};
      return [id, {
        label: hasContent(localized.label) ? localized.label : entry.label,
        title: hasContent(localized.title) ? localized.title : entry.title,
        body: hasContent(localized.body) ? localized.body : entry.body,
      }];
    }),
  );
}
