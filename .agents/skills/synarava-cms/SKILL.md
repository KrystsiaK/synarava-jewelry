---
name: synarava-cms
description: >-
  synarava-cms — Synarava admin shared form library (AdminTextField,
  AdminSelectField, AdminCheckboxField/Control, AdminLongTextField,
  AdminTextControl, AdminFieldShell). Import from @/components/synarava-cms.
  Use whenever editing admin UI, product/collection/page forms, CMS fields,
  validation chrome, labels, adornments, clearable inputs, or anything under
  components/admin/. Mandatory default: reuse synarava-cms — never invent
  parallel raw input/select/checkbox markup.
---

# synarava-cms

Canonical doc: [`docs/admin/synarava-cms.md`](../../../docs/admin/synarava-cms.md).  
Public API: `@/components/synarava-cms`.  
Implementation: `components/admin/shared/`. Tokens: `adm-field*`, `adm-check*` in `app/globals.css`.

## Hard rules

1. **Reuse synarava-cms.** New admin single-line text, select, or checkbox must come from `@/components/synarava-cms`. Raw `<input>` / `<select>` / `<textarea className="adm-field">` only for hidden mirrors, file inputs, or controls not yet in the library.
2. **One stack.** Extend `AdminFieldShell` / existing pieces under `admin/shared`, re-export from `components/synarava-cms`. Do not create a parallel field system.
3. **Errors stay absolute** under `.adm-field-unit` (`.adm-field-error`). No banners above the control for field-level validation. Issue links use `AdminFieldIssue` via the shell `issue` slot.
4. **Tall composites:** control inside the shell; extra panels (e.g. Shopify category attributes) **outside**.
5. **Help** is an `i` tooltip beside the label (`AdminHelp` / `help` prop).
6. **Owner badges** via `owner` (`Shopify` | `Synarava` | `Shopify push`).
7. After contract changes, update `docs/admin/synarava-cms.md` and this skill; run `graphify update .`.

## Component map

| Need | Use |
|------|-----|
| Labeled text input | `AdminTextField` |
| Input without shell (combobox, embed) | `AdminTextControl` |
| Unit / affix inside one border | `endAdornment` / `startAdornment` |
| Clear (× on focus, non-empty) | `clearable` (+ `onClear` if controlled) |
| Select | `AdminSelectField` |
| Checkbox in bordered band | `AdminCheckboxField` |
| Inline / ack / featured checkbox | `AdminCheckboxControl` |
| Long copy | `AdminLongTextField` |
| Custom labeled block | `AdminFieldShell` + control |
| Home section on/off | Keep existing **switch** UI — not checkbox |

## Checklist before shipping admin form UI

- [ ] Imports from `@/components/synarava-cms` (or documented exception)
- [ ] Invalid → red field chrome + absolute error / `issue`
- [ ] Labels aligned (`OwnershipLabel` / `FieldLabel` min-height with help icon)
- [ ] No duplicate field primitives left behind
- [ ] Docs + graphify updated if the library contract changed
