---
name: synarava-cms
description: >-
  synarava-cms — Synarava admin shared form library (AdminTextField,
  AdminSelectField, AdminHrefField/Control, AdminCheckboxField/Control, AdminLongTextField,
  AdminCollapsiblePanel, AdminPanel, AdminNavTree, AdminSectionTabs,
  AdminEntityList, AdminListWorkspace, AdminIconButton, AdminSignalChip, AdminSortChips,
  AdminStatusBadge, AdminOrderedList, AdminTextControl, AdminFieldShell). Import from @/components/synarava-cms.
  Use whenever editing admin UI, product/collection/page forms, CMS fields,
  validation chrome, labels, adornments, clearable inputs, shared/common
  controls, library migration, or anything under components/admin/.
  Mandatory: reuse synarava-cms; one shared control = identical chrome
  everywhere after apply — never invent parallel markup or dual render modes.
---

# synarava-cms

Canonical doc: [`docs/admin/synarava-cms.md`](../../../docs/admin/synarava-cms.md).  
Public API: `@/components/synarava-cms`.  
Implementation: `components/admin/shared/`. Tokens: `adm-field*`, `adm-check*`, `adm-collapse*`, `adm-panel*`, `adm-band*` / `--adm-rhythm*` / `--adm-z-*` (field < popover < sticky < modal < tooltip < toast) in `app/globals.css`. Absolute admin menus use `.adm-popover` — never elevate `.adm-help` into that band.

## Meaning of “общий / shared / library control”

When the user says **общий компонент**, **shared control**, or **library control**:

1. Build or extend **one** control in synarava-cms.
2. **Apply it everywhere** that control type is used (product, collections, pages, …).
3. After apply, instances must **look identical** — same border, radius, focus, label/owner row, error chrome.
4. Optional props (`clearable`, adornments, `owner`, `help`) add **slots inside** that chrome. They must **not** switch to a second outer chrome or bare `<input className="adm-field">`.
5. Import path cleanup alone is **not** done — if the UI still shows two looks, the work is incomplete.
6. Do not explain “same component, different modes” as success when the user sees two borders.

**Anti-pattern (text):** `AdminTextField` sometimes rendered bare `.adm-field`, sometimes `.adm-field-group` when `clearable`/adornments were set → Name/Slug looked unlike Tags. Fixed: text always uses one `.adm-field-group` chrome; × only when `clearable`.

**Anti-pattern (select):** `AdminSelectField` used bare `.adm-field` while text used `.adm-field-group` → Site state looked unlike Tags and lost padding. Fixed: select always uses the same `.adm-field-group` chrome + `.adm-field--select` padding.

## Hard rules

1. **Reuse synarava-cms.** New admin single-line text, select, or checkbox must come from `@/components/synarava-cms`. Raw `<input>` / `<select>` / `<textarea className="adm-field">` only for hidden mirrors, file inputs, or controls not yet in the library.
2. **One stack.** Extend `AdminFieldShell` / existing pieces under `admin/shared`, re-export from `components/synarava-cms`. Do not create a parallel field system.
3. **One chrome per control type.** No dual DOM/CSS paths that change the outer field look based on optional props.
4. **Errors stay absolute** under `.adm-field-unit` (`.adm-field-error`). **Warnings** use the same band (`.adm-field-warning`, orange) via the `warning` prop — error wins if both are set. Every unit **always** reserves a one-line message band so siblings never jump; long messages ellipsis + tooltip/`title`. No banners above the control for field-level validation. Issue links use `AdminFieldIssue` via the shell `issue` slot. **Tall media** (`ImageFileField`): keep `AdminFieldIssue` in normal flow (not a direct unit child) so it does not paint over the preview path. **Scroll to field:** `scrollAdminFieldIntoView` (`block: "start"` + scroll-margin) — never `block: "center"` under sticky chrome.
5. **Tall composites:** control inside the shell; extra panels (e.g. Shopify category attributes) **outside**. Media preview blocks follow the ProductMediaManager / collection-hero pattern.
6. **Help** is an `i` tooltip beside the label (`AdminHelp` / `help` prop).
7. **Owner badges** via `owner` (`Shopify` | `Synarava` | `Shopify push`).
8. After contract changes, update `docs/admin/synarava-cms.md` and this skill (keep `.agents` + `.claude` copies in sync); run `graphify update .`.

## Component map

| Need | Use |
|------|-----|
| Labeled text input | `AdminTextField` |
| Input without shell (combobox, embed) | `AdminTextControl` |
| Unit / affix inside one border | `endAdornment` / `startAdornment` |
| Clear (× on focus, non-empty) | `clearable` (+ `onClear` if controlled) |
| Select | `AdminSelectField` / `AdminSelectControl` |
| Storefront path combobox | `AdminHrefField` / `AdminHrefControl` |
| Checkbox + optional follow-on | `AdminCheckboxField` |
| Inline / ack / featured checkbox | `AdminCheckboxControl` |
| Long copy (preview + Edit modal) | `AdminLongTextField` |
| Collapsible section (chevron) | `AdminCollapsiblePanel` |
| Rounded shell + optional sticky header | `AdminPanel` (`.Root` / `.Header` / `.Body`) |
| Admin sidebar tree (config + router sync) | `AdminNavTree` / `buildAdminNavItems` |
| Section tabs + cool content well | `AdminSectionTabs` |
| Dense entity list shell | `AdminEntityList` (`.Root` / `.Header` / `.Row` / `.LoadMore`) |
| Sticky list chrome (title / filters / body) | `AdminListWorkspace` (`.Root` / `.Header` / `.Filters` / `.Body`) |
| Icon action + tooltip | `AdminIconButton` |
| Locale / problem / conflict glyph | `AdminSignalChip` |
| Compact sort chips | `AdminSortChips` |
| Status / workflow pill | `AdminStatusBadge` |
| Ordered rows (up/down; DnD later) | `AdminOrderedList` |
| Sticky band padding / vertical rhythm | `.adm-band` + `--adm-inset-x` (Tailwind `px-adm-inset`); `--sticky-radius` when first sticky under panel |
| Custom labeled block | `AdminFieldShell` + control |
| Home section on/off | Keep existing **switch** UI — not checkbox |

Material lexicon rows: `AdminOrderedList` + nested `AdminCollapsiblePanel` (new rows `defaultOpen`, header shows index / name / category).

## Migration / “apply shared control” workflow

When asked to move product (or any admin) fields onto the library:

1. Confirm the shared control exists and its **canonical chrome** (Storybook / Tags-like text field).
2. Replace call sites so they use that control from `@/components/synarava-cms`.
3. **Visually verify** side-by-side: same type of field must match (border/focus), not only share a React name.
4. If two looks remain → fix the library (one chrome), do not declare import-only migration done.
5. Update docs + this skill if the contract changed.

## Checklist before shipping admin form UI

- [ ] Imports from `@/components/synarava-cms` (or documented exception)
- [ ] Same control type → identical outer chrome on every screen
- [ ] Optional props only toggle inner slots (clear, affix), not alternate shells
- [ ] Invalid → red field chrome + absolute error / `issue`
- [ ] Labels aligned (`OwnershipLabel` / `FieldLabel` min-height with help icon)
- [ ] No duplicate field primitives left behind
- [ ] Docs + graphify updated if the library contract changed
