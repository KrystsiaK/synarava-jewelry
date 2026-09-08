# Admin and Shopify catalog refactor — September 2026

## Status

Completed on 8 September 2026. This document is the historical record of the
catalog-alignment and admin-component refactor that was previously tracked in
`docs/admin-refactor-plan.md`.

The work had two separate goals:

1. remove competing catalog concepts from the Synarava admin and align the
   editable commerce model with Shopify;
2. split the large admin CMS components into explicit, single-purpose modules
   without changing their public behavior.

## Catalog ownership decision

Shopify is the commerce system of record. Synarava keeps a local read model and
an editorial layer, but does not introduce a second lifecycle for concepts that
Shopify already owns.

| Concept | Resulting owner and behavior |
|---|---|
| Product category | Shopify Standard Product Taxonomy. The editor stores the category GID and full name and push/pull round-trips them. |
| Collection | Shopify collection identity and membership, projected locally for storefront copy, ordering, and navigation. Shopify pulls never overwrite local editorial fields. |
| Tags | Shopify product tags, edited on the product. The standalone local Tag CRUD surface was removed. Local `Tag`/`ProductTag` rows remain the synchronized read projection. |
| Department | No separate entity or JSON field. The legacy `department` URL/filter vocabulary is backed by collections marked `isPrimaryNav`. |
| Product type | Shopify free-form product type, stored losslessly as nullable text. |
| Category attributes | Shopify taxonomy attributes are displayed as reference. Mapping free text to Shopify controlled taxonomy values remains deferred until it can be verified against a live sandbox. |
| SKU, price, compare-at price | The primary `ProductVariant` is authoritative after it exists; product-level columns remain compatibility/identity fallbacks. |
| Publication | A public Synarava product must be active and published to Shopify's Online Store channel. Shopify `UNLISTED` is preserved. |

This was implemented as an expand → migrate → contract sequence so existing
data stayed readable during the cutover.

## Catalog-alignment work

### Shopify taxonomy became the category source

- `ae50910` added Shopify taxonomy search/selection, persistence of
  `shopifyCategoryId` and `shopifyCategoryName`, reconciliation, and tests.
- `63c7124` added read-only discovery of the selected category's Shopify
  taxonomy attributes and controlled values.
- The storefront and admin product filters now read the Shopify category
  projection rather than the legacy `ProductCategory` relation.

### Collections became the single grouping and navigation model

- `52b3396` expanded `Collection` with Shopify identity and synchronized
  product membership in both directions.
- Pull resolves collections by Shopify ID first, then by compatible local
  handle; it creates a projection only when neither matches. Existing local
  editorial fields are preserved.
- Push diffs membership and updates only Synarava's dedicated Shopify manual
  collection source. Shopify-authored condition sources are not modified.
- `c8ed854` added `isPrimaryNav` and `navSortOrder`, seeded the four legacy
  top-level groups as primary-navigation collections, and moved storefront
  navigation and `?department=<slug>` filtering onto collection membership.
- The idempotent `scripts/backfill-department-collections.mjs` migrated old
  product assignments before the read-path cutover and remains part of the
  Railway pre-deploy sequence.
- `005479d` removed `details.department` from the product JSON contract. The
  admin's Department control is now only a single-primary-navigation-collection
  selector; it does not write a second classification.
- `5ba2e83` hardened collection identity, source ownership, collision handling,
  async job waiting, and synchronization tests. Migrations added
  `shopifyCollectionId`, `shopifyHandle`, `lastSyncedAt`,
  `shopifyManualSourceId`, `isPrimaryNav`, and `navSortOrder`.

The product editor intentionally still exposes a single collection choice.
The data and synchronization layer support multiple memberships, but a
multi-collection editing UI was outside this refactor.

### Competing category and tag administration was contracted

- `9eddd9d` removed `/admin/categories`, `/admin/tags`, their CMS components,
  CRUD actions, and obsolete navigation entries.
- Tags continue to be normalized locally for the synchronized projection and
  pushed/pulled as Shopify product tags; they no longer have an independent
  admin lifecycle.
- Legacy category/tag history payload readers remain because old audit entries
  can still be restored or inspected.
- The legacy `ProductCategory` table, `Product.categoryId`, and CATEGORY/TAG
  audit type branches remain as deliberate compatibility debt. Removing them
  requires a separate destructive migration after production observation.

### Shopify field parity was hardened

- `da1d528` stopped replacing Shopify product type with a local enum, preserved
  `UNLISTED`, and required Online Store publication for public visibility.
- `2275092` added vendor and SEO title/description to Shopify push.
- `98769ca` made the primary variant authoritative for SKU, price, and
  compare-at price across the editor, storefront projection, and sync.
- Preview/reconciliation now reports product type, vendor, SEO, collection
  membership, category, and publication differences instead of silently
  ignoring them.

## Admin component refactor

### Phase 1 — mechanical grouping

Commits `67a81de` through `c71e5ab` grouped the flat admin directory into:

```text
components/admin/
  shared/
  products/
  collections/
  pages/
  issues/
  site-videos/
```

Moves were intentionally mechanical and landed per entity so each could be
reverted independently. Temporary category/tag folders were later removed by
the catalog contraction above.

### Phase 2 — split the three large CMS modules

The dependency direction is now:

```text
types -> helpers/fields -> forms -> CMS orchestrator
                         \-> route editor
```

Leaf modules do not import their CMS orchestrator.

- `9ce1d2a` split pages into types, helpers, create/edit forms, delete control,
  route editor, and a thin list orchestrator.
- `1c85403` split collections into types, helpers, fields, create/edit forms,
  route editor, and a thin list orchestrator.
- `4832d22` split products into types, helpers, form fields, media manager,
  sync strip, create/edit forms, route editor, and the remaining list/sync
  orchestrator.

Shared behavior stays in `components/admin/shared`; entity-specific fields and
helpers stay with their entity. No barrel modules or speculative common form
framework were introduced.

### Phase 3 — characterization and verification

- `14232a5` added helper characterization tests and action-wiring smoke tests
  for the six extracted create/edit forms.
- `41d5b3b` completed the remaining collection-form verification and recorded
  the authenticated browser smoke pass.
- The final refactor checkpoint passed TypeScript, lint, the full Vitest suite,
  production build, and authenticated browser checks for product, collection,
  and page create/edit routes.
- Graphify was refreshed after the module paths and tests changed.

## Post-refactor UI hardening

Follow-up fixes retained the same component boundaries:

- the idle product-save progress line no longer renders;
- the mobile admin drawer is portalled outside the filtered topbar, fills the
  dynamic viewport, locks page scrolling, and owns its internal scroll;
- tooltips portal into the nearest admin theme root, so their background,
  border, arrow, and text inherit valid admin design tokens instead of becoming
  transparent in `document.body`.

These behaviors have focused regression tests in
`components/admin/shared/__tests__/admin-mobile-menu.test.tsx` and
`components/ui/__tests__/tooltip.test.tsx`.

## Deliberate follow-ups

The following are not incomplete refactor phases; they are separately scoped
future changes:

1. remove `ProductCategory`, `Product.categoryId`, and unused CATEGORY/TAG
   history/routing branches in a dedicated destructive migration;
2. validate Shopify standard taxonomy metafield/metaobject definitions in a
   live sandbox before mapping Synarava free-text characteristics to controlled
   taxonomy values;
3. design a multi-collection product editor if administrators need to manage
   more than one membership locally;
4. add translations for newly created primary-navigation collections when a
   localized label must differ from the collection name.

## Source trail

The main implementation history runs from `67a81de` through `41d5b3b`. Git is
the authoritative line-level record; this document preserves the decisions,
sequence, boundaries, and known consequences that are not evident from a diff.

