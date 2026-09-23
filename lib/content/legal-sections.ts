export type LegalSectionMeta = { id: string; label: string };

export type LegalSectionContent = { title?: string; body?: string };

export type LegalSectionDefault = { title: string; body: string };

export type ResolvedLegalSection = { id: string; label: string; title: string; body: string };

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (
    Object.hasOwn(vars, key) ? vars[key] : match
  ));
}

/**
 * Admin content overrides a fixed set of code-defined sections (id, TOC
 * label, and order are not editable — this is a legal document, not a page
 * builder). An empty title/body falls back to `defaults`.
 *
 * For the four Legal Document pages (Privacy, Terms & Conditions, Legal
 * Notice, Public Offer Agreement) specifically: once a document exists,
 * admin-saved content is authoritative and `defaults` must never be the
 * live shipped copy — see isSavedLegalDocument below. Passing the real
 * `*_SECTION_DEFAULTS`/`*_DEFAULT` constants here is only correct while the
 * page row is null; once it exists, callers pass `{}` / `""` so an
 * admin-cleared field renders empty instead of silently reverting to
 * whatever the shipped copy says today. Service pages (care/faq/shipping/
 * returns/dispute-resolution) are not bound by this — they still resolve
 * against the live defaults every time.
 */
export function resolveLegalSections(
  sections: LegalSectionMeta[],
  content: Record<string, LegalSectionContent> | undefined,
  defaults: Record<string, LegalSectionDefault>,
  vars: Record<string, string> = {},
): ResolvedLegalSection[] {
  return sections.map(({ id, label }) => {
    const override = content?.[id];
    const fallback = defaults[id] ?? { title: "", body: "" };
    const title = override?.title?.trim() || fallback.title;
    const body = override?.body?.trim() || fallback.body;
    return { id, label, title: interpolate(title, vars), body: interpolate(body, vars) };
  });
}

export function resolveLegalText(
  override: string | undefined,
  fallback: string,
  vars: Record<string, string> = {},
): string {
  return interpolate(override?.trim() || fallback, vars);
}

/**
 * True once a Legal Document's Page row exists (getPageBySlug returned a
 * real, published row) — the gate that decides whether a Legal Document
 * page may still fall back to shipped defaults. Once true, callers must
 * stop passing the live `*_SECTION_DEFAULTS`/`*_DEFAULT` constants into
 * resolveLegalSections/resolveLegalText for that request, so an
 * admin-cleared field renders empty rather than reverting to today's
 * shipped copy.
 */
export function isSavedLegalDocument<T>(page: T | null | undefined): page is T {
  return page != null;
}
