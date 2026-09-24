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

export {
  AdminCollapsiblePanel,
  type AdminCollapsiblePanelProps,
} from "@/components/admin/shared/admin-collapsible-panel";

export {
  AdminPanel,
  AdminPanelRoot,
  AdminPanelHeader,
  AdminPanelBody,
  type AdminPanelRootProps,
  type AdminPanelHeaderProps,
  type AdminPanelBodyProps,
} from "@/components/admin/shared/admin-panel";

export { AdminHelp } from "@/components/admin/shared/admin-help";

export {
  AdminSectionTabs,
  type AdminSectionTabItem,
  type AdminSectionTabsProps,
  type AdminSectionTabTone,
} from "@/components/admin/shared/admin-section-tabs";

export {
  AdminNavTree,
  type AdminNavTreeProps,
} from "@/components/admin/shared/admin-nav-tree";

export {
  buildAdminNavItems,
  type AdminNavChildConfig,
  type AdminNavItemConfig,
  type AdminNavPageRef,
  type AdminNavSignal,
} from "@/components/admin/shared/admin-nav-config";

export {
  OwnershipLabel,
  type AdminFieldOwner,
} from "@/components/admin/shared/ownership-label";

export { FieldLabel } from "@/components/admin/shared/field-label";
