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
| Tokens | `.adm-field*`, `.adm-field-group*`, `.adm-check*`, `.adm-collapse*`, `.adm-panel*`, `.adm-band*` / `--adm-rhythm*` in `app/globals.css` |
| Agent skill | `synarava-cms` (`.agents/skills/synarava-cms/`, `.claude/skills/synarava-cms/`) |

| Export | Role |
|--------|------|
| `AdminFieldShell` | Label + owner + help + absolute error/`issue` (`.adm-field-unit`) |
| `AdminTextField` / `AdminTextControl` | Labeled text / embeddable control |
| `AdminSelectField` / `AdminSelectControl` | Select / embeddable select |
| `AdminCheckboxField` / `AdminCheckboxControl` | Checkbox row (+ optional follow-on) / inline row |
| `AdminLongTextField` | Full-width text preview + Edit modal (+ error chrome) |
| `AdminCollapsiblePanel` | Titled collapsible panel (chevron; header/body divider) |
| `AdminPanel` | Rounded shell (`Root` / `Header` / `Body`); sticky header lifts by −radius |
| `AdminNavTree` / `buildAdminNavItems` | Config-driven admin sidebar tree (expand, show-more, router sync) |
| `AdminSectionTabs` | Card section tabs + cool content well (issue/conflict tones) |
| `AdminEntityList` | Dense list shell (header / row / infinite-scroll load more) |
| `AdminIconButton` | Square icon action + tooltip (`adm-icon-btn`, fixed 2rem, no wrap) |
| `AdminSignalChip` | Locale / problem / conflict glyph + tooltip (`empty`/`partial`/`progress`/`ok`; `danger` only for real errors) |
| `AdminSortChips` | Compact sort chip bar |
| `AdminStatusBadge` | Workflow / sync status pill (`published`/`draft`/`archived`/`unlisted`/…; `error` only for real faults) |
| `OwnershipLabel` / `FieldLabel` / `AdminHelp` | Label chrome |
| `fieldClass` / `useAdminFieldIds` | Shared helpers |

## Contracts

### Shell

- `AdminFieldShell` owns `adm-field-unit`, `label`/`owner`/`help`/`required`, `error`, optional `issue`, optional `unitId`.
- Field-level errors are **absolute** inside the unit. Every `.adm-field-unit`
  **always** reserves a one-line error band (`padding-bottom`) so siblings never
  jump when validation appears. Long messages **ellipsis** in that band; full
  copy is available via tooltip / `title`. They must not push sibling rows or
  paint over the next section.
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

- One chrome: square control + label only — **no** outer bordered field band.
- Checked mark is **light** (`#f8f7f4`) on `--adm-accent` so it stays readable in
  light theme (`#7b5b1c`) and dark theme (`#d8b66a`).
- `AdminCheckboxField` without children = same as `AdminCheckboxControl` (no wrapper).
- `AdminCheckboxField` with children = `.adm-check-stack` under the row (e.g. certificate URL).
- `AdminCheckboxControl` = row only (featured, reviewed, acknowledgements).
- Home “site sections” stay **switches**, not these checkboxes.
- Applied across product characteristics, lookbook featured, translation reviewed,
  and conflict/apply acknowledgements via `@/components/synarava-cms`.

### Panel shell

```tsx
import { AdminPanel } from "@/components/synarava-cms";

<AdminPanel.Root stickyAbove="var(--adm-product-workspace-sticky-height, 5.5rem)">
  <AdminPanel.Header sticky stickyBand="locale">…</AdminPanel.Header>
  <AdminPanel.Body>…</AdminPanel.Body>
</AdminPanel.Root>
```

- Rounded container (`--adm-panel-radius`, default `0.75rem`). Overflow stays **visible** so sticky pins to `.admin-content`.
- Sticky header `top: calc(stickyAbove - radius)` — header **occupies** the rounded top; it is not inset below the crescents.
- Sticky headers automatically get `.adm-band` + `.adm-band--sticky-radius`: `padding-top = band-pad-y + radius` so optical vertical padding stays equal after the −radius lift.
- Nested sticky bands (tabs, section title) subtract the same radius once from the stack; they use equal `.adm-band` padding (no sticky-radius) because they sit flush under the previous band.
- Applied on the product locale workspace.

### Vertical rhythm + inset (sticky bands)

All admin panel chrome padding comes from one token scale on `.admin-terminal` /
`.admin-modal-root`, bridged into Tailwind `@theme` as `--spacing-adm-*`:

| Token | Default | Use |
|-------|---------|-----|
| `--adm-rhythm` … `--adm-rhythm-6` | 4px steps | Generic spacing |
| `--adm-inset-x` / `--spacing-adm-inset` | 16px | **One** horizontal gutter for every band/body inside a panel |
| `--adm-band-pad-y` / `--spacing-adm-band-y` | 12px | Single-row chrome (locale, section title) |
| `--adm-band-pad-y-lg` | 16px | Multi-line workspace title (Y only) |

| Class / utility | Role |
|-----------------|------|
| `.adm-band` | Flex + band-y + **inset-x** |
| `.adm-band--lg` | Larger Y; same inset-x |
| `.adm-band--sticky-radius` | Extra top pad = `--adm-panel-radius` (first sticky under rounded panel) |
| `.adm-inset-x` or Tailwind `px-adm-inset` | Horizontal gutter alone (body, description) |

Do **not** invent per-screen `px-5` / `px-6` / `pad-x-lg` on panel chrome — change `--adm-inset-x` once.

### Collapsible panel

```tsx
import { AdminCollapsiblePanel } from "@/components/synarava-cms";

<AdminCollapsiblePanel title="Dimensions & fit">
  {/* fields */}
</AdminCollapsiblePanel>
```

- One chrome: bordered panel, title left, **one** chevron right (rotates when open).
- Implemented as a **button** + animated panel (not native `&lt;details&gt;` — avoids double markers).
- Open/close uses `grid-template-rows` 0fr→1fr (~220ms ease-out); chevron rotates with the same curve.
- When open, soft header + **one** `.adm-collapse__rule` hairline (no inset/border-bottom on the header).
- Applied to product characteristic groups and Shopify snapshot mirror.
- Story: `synarava-cms/AdminCollapsiblePanel`.

### Admin nav tree

Config-driven sidebar navigation (`AdminNavTree` + `buildAdminNavItems`).

```tsx
import { AdminNavTree, buildAdminNavItems } from "@/components/synarava-cms";

<AdminNavTree
  items={buildAdminNavItems({ pages, issueCount, syncCount })}
  issueNavHrefs={issueNavHrefs}
  syncNavHrefs={syncNavHrefs}
/>
```

- **Expand in place:** Pages (DB titles) and Header & Footer (storefront copy groups). Catalog stays a leaf.
- **Router sync:** pathname + hash open the matching branch; deep links past “Show more” auto-reveal.
- **Signals:** left marker shows issue (red) / sync (gold) / both; badges on Problems / Localization; muted child count when Pages is collapsed.
- **Truncation:** long labels ellipsize; tooltip on long titles.
- **Focus:** no outline ring on nav items — soft background only.
- Story: `synarava-cms/AdminNavTree`.

### Admin section tabs

Reusable card-strip tabs with a cool content well (`AdminSectionTabs`).

```tsx
import { AdminSectionTabs } from "@/components/synarava-cms";

<AdminSectionTabs
  items={[
    { id: "content", label: "Content", detail: "Copy & search", icon: FileText },
    { id: "catalog", label: "Catalog", tone: "issue" },
    { id: "shopify", label: "Shopify", tone: "conflict", dirty: true },
  ]}
  active={active}
  onChange={setActive}
>
  {/* Title + fields — share the cool well so “inside tab” is obvious */}
</AdminSectionTabs>
```

| State | Look |
|-------|------|
| Idle | Warm/white (`--adm-tab-idle`) |
| Idle hover | Cool lift (`--adm-tab-idle-hover`) |
| Selected (+ hover) | Cool well (`--adm-tab-well`) + cool underline |
| Issue (+ hover / selected) | Danger tint; issue wins over conflict |
| Conflict (+ hover / selected) | Amber conflict tint |
| Dirty | Amber dot only (does not replace tone) |

Tokens: `--adm-cool`, `--adm-cool-soft`, `--adm-tab-well`, `--adm-conflict-soft`.  
Product editor uses this via `ProductEditorTabs`. Story: `synarava-cms/AdminSectionTabs`.

### Entity list (tables)

Shared dense list primitives for products / pages / collections:

```tsx
import {
  AdminEntityList,
  AdminIconButton,
  AdminSignalChip,
  AdminSortChips,
} from "@/components/synarava-cms";

<AdminSortChips value={sort} options={options} onChange={setSort} />
<AdminEntityList.Root>
  <AdminEntityList.Header columns={…} gridClassName="xl:grid-cols-[…]" />
  <AdminEntityList.Row gridClassName="…">…</AdminEntityList.Row>
  <AdminEntityList.LoadMore hasMore={…} onLoadMore={…} />
</AdminEntityList.Root>
```

| Export | Role |
|--------|------|
| `AdminIconButton` | Square icon action + tooltip + `aria-label` (optional badge) |
| `AdminSignalChip` | Locale / problem / conflict glyph with explanatory tooltip |
| `AdminSortChips` | Compact single-select sort bar (Problems / Conflicts first) |
| `AdminEntityList` | Header + dense rows + infinite-scroll sentinel |

Products list loads via `listAdminProductsPage` + `GET /admin/api/products` (cursor, filters, sort including problems/conflicts). Do not load the full catalog into the client for browsing.

Filter bars stay composed from `AdminTextField` / `AdminSelectField` — no separate filter library control for now.

### Status badge

```tsx
import { AdminStatusBadge } from "@/components/synarava-cms";

<AdminStatusBadge status="PUBLISHED" />
<AdminStatusBadge status="ARCHIVED" />
<AdminStatusBadge tone="pending">SHOPIFY: PENDING</AdminStatusBadge>
```

- One pill chrome (`.adm-badge` + `.adm-badge--*`).
- `status` maps workflow labels; `tone` for sync / custom copy.
- `error` only for real faults (failed sync, open problems) — never for “not filled yet”.

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
Query: `graphify query "synarava-cms AdminTextField AdminSelectField AdminCheckboxField AdminCollapsiblePanel"`.
