/**
 * synarava-cms — shared Synarava admin form controls.
 *
 * Prefer importing from `@/components/synarava-cms`.
 * Implementation lives under `components/admin/shared/`; this module is the public API.
 *
 * Contract: docs/admin/synarava-cms.md
 */

export {
  AdminFieldShell,
  fieldClass,
  useAdminFieldIds,
  type AdminFieldShellProps,
} from "@/components/admin/shared/admin-field-shell";

export {
  AdminTextControl,
  AdminTextField,
  type AdminTextControlProps,
  type AdminTextFieldProps,
} from "@/components/admin/shared/admin-text-field";

export {
  AdminSelectControl,
  AdminSelectField,
  type AdminSelectControlProps,
  type AdminSelectFieldProps,
} from "@/components/admin/shared/admin-select-field";

export {
  AdminCheckboxControl,
  AdminCheckboxField,
  type AdminCheckboxControlProps,
  type AdminCheckboxFieldProps,
} from "@/components/admin/shared/admin-checkbox-field";

export { AdminLongTextField, type AdminLongTextFieldProps } from "@/components/admin/shared/admin-long-text-field";

export { AdminHelp } from "@/components/admin/shared/admin-help";

export {
  OwnershipLabel,
  type AdminFieldOwner,
} from "@/components/admin/shared/ownership-label";

export { FieldLabel } from "@/components/admin/shared/field-label";
