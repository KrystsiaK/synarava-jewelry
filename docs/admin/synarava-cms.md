# synarava-cms

Shared Synarava admin form controls (**synarava-cms**).

**Default for all admin forms:** import from `@/components/synarava-cms` and reuse
these primitives — do not invent parallel markup.

**“Общий / shared control” means:** one library control, applied everywhere that
type is used, with **identical** outer chrome (border, radius, focus, label row).
Optional props (`clearable`, adornments) only add slots **inside** that chrome —
they must not switch to a second look. Import-path cleanup alone is not done if
two visual variants remain. Agent skill encodes this contract.

| | |
|--|--|
| Public API | `@/components/synarava-cms` (`components/synarava-cms/index.ts`) |
| Implementation | `components/admin/shared/` |
| Tokens | `.adm-field*`, `.adm-field-group*`, `.adm-check*` in `app/globals.css` |
| Agent skill | `synarava-cms` (`.agents/skills/synarava-cms/`, `.claude/skills/synarava-cms/`) |

| Export | Role |
|--------|------|
| `AdminFieldShell` | Label + owner + help + absolute error/`issue` (`.adm-field-unit`) |
| `AdminTextField` / `AdminTextControl` | Labeled text / embeddable control |
| `AdminSelectField` / `AdminSelectControl` | Select / embeddable select |
| `AdminCheckboxField` / `AdminCheckboxControl` | Bordered checkbox / inline row |
| `AdminLongTextField` | Full-width text preview + Edit modal (+ error chrome) |
| `OwnershipLabel` / `FieldLabel` / `AdminHelp` | Label chrome |
| `fieldClass` / `useAdminFieldIds` | Shared helpers |

## Contracts

### Shell

- `AdminFieldShell` owns `adm-field-unit`, `label`/`owner`/`help`/`required`, `error`, optional `issue`, optional `unitId`.
- Field-level errors are **absolute** inside the unit (reserved padding when an error node is present). They must not push sibling rows or paint over the next section.
- `invalid` forces error chrome without copy (issue-linked fields).

### Text

```tsx
import { AdminTextField } from "@/components/synarava-cms";

<AdminTextField label="SKU" owner="Shopify" name="sku" required error={…} />
<AdminTextField label="Length" endAdornment="mm" name="length" />
<AdminTextField label="Tags" clearable name="tags" />
```

- Every text control uses one `.adm-field-group` chrome (same border/focus).
- Affixes and clear are optional slots **inside** that border.
- `clearable`: × visible on `:focus-within` when the value is non-empty.
- Embed / combobox: `AdminTextControl` (same group chrome; optional `clearable`).
- Product single-line fields consume `AdminTextField` / `AdminTextControl` via
  `@/components/synarava-cms`. Story: `synarava-cms/AdminTextField`.

### Select

```tsx
import { AdminSelectField } from "@/components/synarava-cms";

<AdminSelectField label="Collection" owner="Synarava" name="collectionSlug" invalid={…} issue={…}>
  <option value="">No collection</option>
</AdminSelectField>
```

- Same outer chrome as text: one `.adm-field-group` + `.adm-field--select` inside
  (padding matches text inputs; caret reserved on the right).
- Embed: `AdminSelectControl` (same group chrome).
- All admin dropdowns (product Site state / Collection, pages publishing, CMS
  filters) use this control via `@/components/synarava-cms`.
  Story: `synarava-cms/AdminSelectField`.

### Checkbox

```tsx
import { AdminCheckboxControl, AdminCheckboxField } from "@/components/synarava-cms";

<AdminCheckboxField name="washable" label="Washable" />
<AdminCheckboxControl label="PT translation reviewed" checked={…} onChange={…} />
```

- `AdminCheckboxField` = bordered band (characteristic-style).
- `AdminCheckboxControl` = row only (featured, reviewed, acknowledgements).
- Home “site sections” stay **switches**, not these checkboxes.

### Long text

`AdminLongTextField` — full-width **text** preview + Edit opens a modal
(not a raw `textarea.adm-field` on the form). Modal editor is plain textarea for
now; WYSIWYG can replace it later without changing the preview contract.

```tsx
import { AdminLongTextField } from "@/components/synarava-cms";

<AdminLongTextField label="Fit notes" name="fit_notes" error={…} />
<AdminLongTextField label="Description" owner="Shopify" value={…} onChange={…} />
```

- Always `w-full` (use `className="col-span-full"` inside multi-column grids).
- Error / invalid → `.adm-long-text-preview--error` + absolute shell error.
- Applied across product, collections, pages, storefront copy, and site SEO
  (no raw `textarea.adm-field` for long copy in admin forms).
- Story: `synarava-cms/AdminLongTextField`.

### Tall / composite fields

Example: Shopify product category — `ShopifyCategoryControl` inside the shell,
`ShopifyCategoryAttributes` **outside** (`components/admin/products/shopify-category-field.tsx`).
Never put tall follow-on panels inside the same `adm-field-unit` as the absolute error.

## Out of library (for now)

- File / image pickers (`ImageFileField`)
- Native hidden mirrors for locale tabs
- Home section visibility switches

When adding a new control type, extend **synarava-cms** first (implementation under `admin/shared`, re-export from `components/synarava-cms`); update this doc and the skill in the same change.

## Graphify

After changing synarava-cms modules, run `graphify update .`.
Query: `graphify query "synarava-cms AdminTextField AdminSelectField AdminCheckboxField"`.
