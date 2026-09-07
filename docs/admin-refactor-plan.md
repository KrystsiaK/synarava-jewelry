# Admin components refactor plan

## Why

`components/admin/` is a flat folder of 21 files mixing three unrelated
things with no separation: shared admin infra (toast, primitives, form
validation), per-entity CMS screens, and tiny route-editor widgets. Naming
gives no signal of what's shared vs. entity-specific. Three files are god
files that bundle list + form + subcomponents + helpers together:

| file | lines | importers |
|---|---|---|
| `products-cms.tsx` | 2136 | `app/admin/(studio)/products/page.tsx`, `product-route-editor.tsx` |
| `collections-cms.tsx` | 1006 | `app/admin/(studio)/collections/page.tsx`, `collection-route-editor.tsx` |
| `pages-cms.tsx` | 584 | `app/admin/(studio)/pages/page.tsx`, `page-route-editor.tsx` |

Every `*-cms.tsx` has 2 direct importers: its list page and its route editor.
Moving the route editors also changes their route-page imports. The total
app-level import updates are 3 for products, 3 for collections, and 5 for
pages, plus the route editor's import of the extracted forms. This is still a
small blast radius, but it must be verified per entity rather than treated as
a single two-import change.

## Target structure

```
components/admin/
  shared/
    admin-primitives.tsx        (unchanged: AdminThemeShell, AdminNav, LocaleTabStrip, ...)
    admin-toast.tsx
    admin-confirm-modal.tsx
    admin-record-meta.tsx
    admin-form-validation.tsx
    admin-help.tsx
    admin-issue-types.ts
    image-file-field.tsx        (cross-entity shared field)
    use-draft-autosave.ts
  products/
    products-cms.tsx            (ProductsCms orchestrator + list, thin)
    product-types.ts            (ProductDraft, ProductRecord, option/prop types)
    product-create-form.tsx     (CreateProductForm)
    product-edit-form.tsx       (EditProductForm)
    product-form-fields.tsx     (ProductDetailFields, ProductFormFields,
                                  OwnershipLabel)
    product-media-manager.tsx   (ProductMediaManager)
    product-sync-strip.tsx      (ProductSyncStrip, SaveButtons, ProgressBar)
    product-helpers.ts          (centsToPrice, getProductEditorDetails, emptyDraft,
                                  productToDraft, normalizeProducts, productStatusLabel,
                                  productActionCopy, issuesForField)
    product-route-editor.tsx
  collections/
    collections-cms.tsx         (CollectionsCms orchestrator + list)
    collection-types.ts         (AdminCollection, CollectionDraft, row-action types)
    collection-create-form.tsx  (CreateCollectionForm)
    collection-edit-form.tsx    (EditCollectionForm, DeleteCollectionForm)
    collection-fields.tsx       (CollectionFields, WorkflowStateField, FieldLabel, FieldError)
    collection-helpers.ts       (emptyCollectionDraft, generateCollectionCode,
                                  normalizeCollections, workflowStateFromCollection,
                                  collectionStatusLabel, collectionActionCopy, collectionToDraft)
    collection-route-editor.tsx
  pages/
    pages-cms.tsx                (PagesCms orchestrator + list)
    page-types.ts                (editable content and row-action types)
    page-editor-form.tsx         (PageEditor)
    page-create-form.tsx         (CreatePageForm)
    page-delete-button.tsx       (page-owned delete action)
    page-helpers.ts              (pageStatusLabel, isProtectedPage, pageActionCopy)
    page-route-editor.tsx
  categories/
    categories-cms.tsx           (moved as-is, 285 lines — not split)
  tags/
    tags-cms.tsx                 (moved as-is, 253 lines — not split)
  issues/
    admin-issues-cms.tsx         (moved as-is, 155 lines — not split)
  site-videos/
    site-videos-cms.tsx          (moved as-is, 135 lines — not split)
  __tests__/                     (mirror new paths; move tests with their source phase)
```

`categories-cms.tsx`, `tags-cms.tsx`, `admin-issues-cms.tsx`,
`site-videos-cms.tsx` are under 300 lines and already single-concern — they
get a folder for consistency, not a content split. Splitting them would be
churn without payoff (YAGNI).

## Non-goals

- No behavior changes. This is a pure move/split — same components, same
  props, same exports, same runtime behavior.
- No renaming of exported symbols (`ProductsCms`, `CreateProductForm`, etc.)
  — only file locations change. Types/helpers may become module exports solely
  for use inside their entity folder; they are not a new cross-entity API.
- No touching `admin-form-validation.tsx` internals — it already reviewed
  clean, it just moves into `shared/`.
- Not introducing barrel `index.ts` files — direct imports stay explicit,
  consistent with the rest of the codebase.

## Phases

Each phase must typecheck, pass focused tests, and build clean before moving to
the next. Use the repository's actual package manager and scripts:

```bash
pnpm exec tsc --noEmit
pnpm test:run
pnpm lint
pnpm build
```

Commit after each phase so a bad step is a single revert, not a lost
afternoon. Do not start the move while unrelated or unfinished work is mixed
into the same commit: first establish a named, reproducible baseline commit.

### Phase 0 — baseline
- Confirm the current feature work is committed separately, or explicitly
  record which existing changes form the refactor baseline.
- Run the four verification commands above before touching anything and record
  pass/fail so regressions are attributable to this work.
- Record a short manual smoke-test checklist for product create/edit (including
  media and sync controls), collection create/edit, and page create/edit/delete.

### Phase 1 — mechanical folder moves (no content split)
- Create `shared/`, `products/`, `collections/`, `pages/`, `categories/`,
  `tags/`, `issues/`, `site-videos/`.
- `git mv` each file into place, update all list-page and route-page importers,
  then update relative imports inside moved files
  (`@/components/admin/...` absolute imports need no change if the alias
  stays rooted at `components/admin`; paths below that root still change and
  must be updated).
- Move `admin-form-validation` and `use-draft-autosave` tests in the same
  shared-group commit as their source files. A phase must never leave tests
  pointing at an old relative path.
- One commit per entity group (shared, products, collections, pages, the
  four small ones) so failures are isolated.

### Phase 2 — split the three god files
Do these one at a time, verify build after each:

Within each entity, enforce one-way dependencies:

```text
types -> helpers/fields -> forms -> CMS orchestrator
                         \-> route editor
```

Forms and leaf components must not import from the CMS orchestrator; this keeps
the split from introducing circular dependencies.

1. **`pages-cms.tsx`** (smallest, 584 lines) — extract `PageEditor` into
   `page-editor-form.tsx`, `CreatePageForm` into `page-create-form.tsx`,
   and the three helpers into `page-helpers.ts`. `PagesCms` stays in
   `pages-cms.tsx` and imports the rest.
2. **`collections-cms.tsx`** (1006 lines) — extract per the table above.
   Watch `WorkflowStateField`/`CollectionFields`/`FieldLabel`/`FieldError`
   are used by both create and edit forms — they go in the shared
   `collection-fields.tsx`, not duplicated.
3. **`products-cms.tsx`** (2136 lines, do last — highest risk) — extract
   per the table above. `ProductDetailFields`/`ProductFormFields` are
   shared between `CreateProductForm` and `EditProductForm`, so they go in
   `product-form-fields.tsx` and both forms import from there.

### Phase 3 — characterization and final verification
- Add focused tests for pure extracted helpers (normalization, status/action
  copy, draft conversion) where behavior is currently unprotected.
- Add render/smoke coverage for each extracted public form sufficient to catch
  missing props, providers, and action wiring.
- Run the full verification command set and the Phase 0 manual smoke checklist.
- Run `graphify update .` after the final code move so the project graph matches
  the new paths.

## Explicitly out of scope for this pass

- Renaming `*-cms.tsx` naming convention itself (e.g. dropping "-cms").
  Not asked for, and renaming public-facing file naming without a reason
  is churn.
- Extracting a general-purpose "forms module" shared across entities —
  `admin-form-validation.tsx` already is that; each entity's form-fields
  file is entity-specific by nature (different fields), so there's nothing
  further to generalize without speculative abstraction.
