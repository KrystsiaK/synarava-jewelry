# synarava-cms

Shared Synarava admin form controls (**synarava-cms**).

**Default for all admin forms:** import from `@/components/synarava-cms` and reuse
these primitives — do not invent parallel markup.

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
| `AdminSelectField` | Select |
| `AdminCheckboxField` / `AdminCheckboxControl` | Bordered checkbox / inline row |
| `AdminLongTextField` | Modal long text |
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

- Affixes and clear live **inside** one `.adm-field-group` border.
- `clearable`: × visible on `:focus-within` when the value is non-empty.
- Embed / combobox: `AdminTextControl` (+ `clearable`).

### Select

```tsx
import { AdminSelectField } from "@/components/synarava-cms";

<AdminSelectField label="Collection" owner="Synarava" name="collectionSlug" invalid={…} issue={…}>
  <option value="">No collection</option>
</AdminSelectField>
```

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

`AdminLongTextField` — preview + modal editor (not a raw `textarea.adm-field`).

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
