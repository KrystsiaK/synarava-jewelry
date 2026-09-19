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
 */
export function localeOfFirstError<FieldName extends string>(
  fieldErrors: AdminFieldErrors<FieldName>,
): AdminLocale | undefined {
  // `fieldErrors` is built by iterating form.elements in DOM order (see
  // collectNativeFieldErrors), so its first key is the first invalid field.
  const [firstName] = Object.keys(fieldErrors);
  if (!firstName) return undefined;
  return PT_FIELD_NAME.test(firstName) ? "PT" : "EN";
}
