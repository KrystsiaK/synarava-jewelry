import type { AdminFieldErrors } from "@/components/admin/shared/admin-form-validation";
import type { AdminLocale } from "@/components/admin/shared/admin-locale-workspace";

// Every PT-localized field in this codebase is named with a "pt" + capital
// prefix (ptTitle, ptMaterialSectionNoteLabel, ...) — see
// docs/translation-field-registry.md. Reusing that convention here means
// entity forms don't need to hand-maintain a second "which fields are PT"
// list just for validation-driven tab switching.
const PT_FIELD_NAME = /^pt[A-Z]/;

/**
 * Which locale tab should be open so the first validation error is visible.
 * Returns undefined when there are no errors (don't force either tab open).
 *
 * `translationLocales`, when given, generalizes this past the fixed EN/PT
 * pair: it matches the first error's field name against each locale's
 * `adminLocaleFieldName` prefix (e.g. "ruTitle" -> "ru") and falls back to
 * the source locale "en" for an unprefixed field. Omit it to keep the
 * original EN/PT-only behavior — still what `AdminLocaleWorkspace` (the
 * still-EN/PT-only 3-slot wrapper) needs.
 */
export function localeOfFirstError<FieldName extends string>(
  fieldErrors: AdminFieldErrors<FieldName>,
  translationLocales?: string[],
): AdminLocale | undefined {
  // `fieldErrors` is built by iterating form.elements in DOM order (see
  // collectNativeFieldErrors), so its first key is the first invalid field.
  const [firstName] = Object.keys(fieldErrors);
  if (!firstName) return undefined;
  if (translationLocales) {
    const match = translationLocales.find((code) => new RegExp(`^${code}[A-Z]`).test(firstName));
    return match ?? "en";
  }
  return PT_FIELD_NAME.test(firstName) ? "PT" : "EN";
}
