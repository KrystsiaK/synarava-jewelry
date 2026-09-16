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
 * builder). An empty title/body falls back to the shipped default text.
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
