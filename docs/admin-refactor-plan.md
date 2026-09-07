# Admin components refactor plan

## Catalog ownership decision

The structural refactor must not preserve duplicate catalog concepts just
because they already exist in the code. Shopify is the commerce system of
record, so the admin should use Shopify's own concepts wherever Shopify has a
matching first-class field:

| Admin concept | Canonical owner | Direction |
|---|---|---|
| Product category | Shopify Standard Product Taxonomy | Search/select a Shopify taxonomy category; persist its GID and full name; push and pull it with the product. |
| Collection | Shopify collection | Keep one local projection for storefront presentation, linked by Shopify collection GID; synchronize membership instead of inventing a second grouping model. |
| Tags | Shopify product tags | Edit on the product; retire separate tag lifecycle/CRUD after compatibility consumers are migrated. |
| Department | None | Remove. Storefront top-level navigation must be derived from explicit collections/navigation configuration, not a second product classification. |
| Product type | Shopify free-form product type | Stop translating it through the local `ARTIFACT`/`JEWELRY`/`OBJECT` enum. Hide it until it is represented faithfully. |
| Category attributes | Shopify taxonomy/metafields | Prefer Shopify category attributes and metafield definitions; reserve `synarava.*` for genuinely editorial storefront content. |

This is an expand/migrate/contract change. Existing `ProductCategory`, `Tag`,
and `details.department` data stay readable until their consumers and stored
data have been migrated. They must not remain visible as competing choices in
the product editor once the Shopify-backed replacement for that choice works.

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

The earlier “no behavior changes” boundary applies to the component-splitting
phases only. The Shopify-alignment phase below is deliberately behavioral and
must land as separate, independently reversible commits.

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

### Phase A — Shopify-aligned catalog model (before further splitting)

This phase takes priority over Phase 2. Each numbered item is a vertical slice
with its own tests and commit; do not combine schema contraction with a new
integration.

1. **Canonical product category (expand) — complete.** The product editor now
   searches Shopify taxonomy, saves `shopifyCategoryId` +
   `shopifyCategoryName`, includes the category GID in `productSet`, compares
   it during reconciliation, and keeps the existing pull projection. The old
   `categoryId` relation remains readable but is no longer an editor choice.
2. **Collection identity and membership (expand) — complete.** `Collection`
   gained a nullable unique `shopifyCollectionId`, plus `shopifyHandle` and
   `lastSyncedAt` (migration `20260907212252_expand_collection_shopify_identity`).
   Pulling a product now resolves each of Shopify's
   `collections(first: 100)` entries to a local collection — matching by
   `shopifyCollectionId` first, then by `slug`/handle for a local-only
   collection that predates the link, creating one only if neither matches
   — and replaces that product's `ProductCollection` rows to mirror Shopify
   exactly (`lib/shopify/product-sync.ts`: `upsertCollectionIdentity`,
   `syncProductCollectionMembership`). Only identity columns are written on
   an existing match; presentation fields (name, subtitle, hero, etc.) are
   never touched by pull. Pushing a product now diffs its local collections'
   `shopifyCollectionId`s against Shopify's current membership
   (`diffCollectionMembership` in `lib/shopify/reconciliation.ts`, unit
   tested) and calls `collectionAddProductsV2`/`collectionRemoveProducts`
   for the difference; a collection with no `shopifyCollectionId` is
   excluded from push rather than erroring. The admin product editor's
   collection picker is unchanged (still a single local `collectionSlug`)
   — multi-collection editing UX is not in scope for this item and is
   still open.
3. **Storefront navigation migration — complete.** `Collection` gained
   `isPrimaryNav`/`navSortOrder` (migration
   `20260907223000_add_collection_primary_navigation`, which also seeds the
   four legacy departments as `isPrimaryNav` collections, upserted by slug
   so a Shopify-linked collection at one of these slugs is promoted rather
   than duplicated). `scripts/backfill-department-collections.mjs`
   (idempotent — safe to re-run) links every existing product to its
   department collection using the same classification the storefront used
   to compute it on the fly, then `getStorefrontNavigation()` in
   `lib/content/catalog.ts` replaces `SHOP_DEPARTMENTS` as the read path:
   `toSummary`'s `departmentSlug`/`departmentName` now come from the
   product's `isPrimaryNav` `ProductCollection` membership, not from
   `details.department`/keyword inference. `?department=<slug>` URLs are
   unchanged — a department is simply a collection slug now. The admin
   department `<select>` (`components/admin/products/products-cms.tsx`)
   now lists `isPrimaryNav` collections instead of a hardcoded array, and
   `saveProductAction` syncs the corresponding `ProductCollection` row
   (`syncDepartmentCollectionMembership`) whenever department changes, so
   the admin's existing single-department UX and the new collection-backed
   read path stay consistent without a UI rebuild. `details.department`
   itself is untouched in the schema (still the admin's write-side intent
   field) — pure contraction of it is item 4's job, not this one.
   `lib/catalog/taxonomy.ts` keeps `SHOP_DEPARTMENTS`/`isShopDepartmentSlug`/
   `shopDepartmentName`/`inferDepartment` only because `lib/shopify/products.ts`
   (an already-dead, zero-importer legacy Storefront-API client) still
   imports them — deleting both was attempted but blocked by this session's
   sandbox; deleting `lib/shopify/products.ts` and its test, then removing
   those four `@deprecated` exports from `taxonomy.ts`, is safe and still
   pending.
   Only the four original department slugs have translated nav labels; a
   primary-nav collection added later without a translation falls back to
   its own `name` (`hasDepartmentTranslation` in `taxonomy.ts`) — a real
   but pre-existing i18n gap, not a regression.
   Verified in-browser (not just tests): `/shop`, `/`, header dropdown
   (desktop + mobile), and department filtering all work in both `en` and
   `pt` locales after a dev-server + `.next` cache restart (Turbopack had
   cached the pre-migration Prisma Client and needed a clean restart to
   pick up the new columns).
4. **Contract obsolete entities.** After verifying no active read/write paths,
   remove Department controls/data and local Product Category CRUD/relation.
   Retire standalone Tag CRUD when all filters read the Shopify-backed tag
   projection. Destructive schema changes land separately from the cutover.
5. **Complete Shopify field parity.** Represent Shopify product type as a
   string or omit it; align status/publication behavior; move SKU, price, and
   inventory ownership fully to variants; map vendor and SEO without lossy
   defaults.
6. **Taxonomy attributes.** Discover the selected category's attributes and
   map supported values through Shopify metafield definitions. Keep only
   editorial, non-commerce fields under the `synarava` namespace.

Checkpoint after items 1–3:

- A product has one visible category choice, sourced from Shopify taxonomy.
- Selecting a collection never requires selecting a Department.
- Push → pull preserves category and collection identity and memberships.
- Existing storefront URLs remain valid during the migration.
- Focused tests, full tests, typecheck, lint, build, and browser smoke checks
  pass before any legacy column/table is removed.

### Phase 0 — baseline
- Confirm the current feature work is committed separately, or explicitly
  record which existing changes form the refactor baseline.
- Run the four verification commands above before touching anything and record
  pass/fail so regressions are attributable to this work.
- Record a short manual smoke-test checklist for product create/edit (including
  media and sync controls), collection create/edit, and page create/edit/delete.

### Phase 1 — mechanical folder moves (complete)
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

Completed in commits `67a81de` through `c71e5ab`; verification passed before
the Shopify-alignment work began.

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
- Reproducing Shopify's private category recommendation model. The supported
  integration is search/browse over Shopify Standard Product Taxonomy. An
  optional Synarava-side suggestion may be added later, but it must always be
  presented as a suggestion that the administrator confirms.
