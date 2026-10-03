# Commerce sync — current freeze (main)

**Status:** shipped foundation on main. Later work continues on **separate feature branches**.  
**Date:** 2026-09-26

This is the only admin sync architecture doc for the current model. Older drafts
(`shopify-sync-architecture*`, target-architecture, dual-snapshot, marker-propagation)
were removed; do not resurrect them as parallel sources of truth.

UX dialogs / field spines: [`catalog-conflict-resolution-ux.md`](./catalog-conflict-resolution-ux.md).  
Field ownership: [`../product-data-ownership.md`](../product-data-ownership.md).  
Agent rule: [`.agents/skills/shopify-commerce-compare/SKILL.md`](../../.agents/skills/shopify-commerce-compare/SKILL.md).

---

## What is live

| Piece | Behavior |
| --- | --- |
| Dual catalog store | `CommerceSyncStore.ourSnapshot` + `shopifySnapshot`; compare → `conflictReport` |
| Per-product windows | `Product.workingSnapshot` (OUR) + `Product.shopifySnapshot` (last Shopify) |
| Per-collection windows | `Collection.workingSnapshot` + `Collection.shopifySnapshot` (title/handle/description/seo V1). Pull replaces those local columns, including an empty Shopify value. Choosing Shopify for a Synarava-only collection deletes it. Hero, manifesto, symbolism, and site state stay Synarava. |
| Detect | One normalize → deep-diff windows. **No** commerce field allowlists for detection |
| Local Save | Write-through columns into `workingSnapshot`, patch OUR store slice, **re-inspect** so tab markers refresh |
| Markers | Shared commerce facts (e.g. price) light **Price** under **every** locale shell (EN/PT/RU), not EN-only |
| Cost / compare-at | Read from Shopify-shaped snapshot projection, not stale Prisma-only guesses |
| Console | DevTools filter `commerce-store` — full OUR + Shopify + conflicts on `/admin/products` and `/admin/collections` entry |

```text
On /admin/products or /admin/collections entry → refresh both stores → console flow
On product/collection Save → patch OUR + re-inspect → markers from fresh diffs
On push / pull / apply  → refresh windows + reload editor
```

Shopify catalog fetch for the full store is **paginated** (products + collections — not N× single-entity fetch).

Collection **membership** (which products belong to a collection) stays product-driven push/pull; it is not part of the collection commerce window yet.

---

## Marker tree (short)

Language is a **shell** over the same product. Shared commerce (price, …) is one
payload shown under every language. One price conflict → catalog row + product +
all locale shells + **Price** tab only (not every section).

Opening conflicts from a **section** chip opens only that section’s fields.
Product and language chrome open the full product / locale set.

Code: `commerce-conflict-section.ts`, `filterSignalsForView` / `filterConflictFieldsForView`
(`product` · `productLocale` · `productSection`), `AdminLocaleTabs` / section conflict chips.

---

## Code map

| Piece | Path |
| --- | --- |
| Dual store types / setProductWindow | `lib/commerce-store/types.ts` |
| Compare | `lib/commerce-store/compare.ts` |
| Build OUR / fetch Shopify / refresh | `lib/commerce-store/build-our-store.ts`, `fetch-shopify-store.ts`, `refresh.ts` |
| Projection / merge / diff | `lib/shopify/local-commerce-projection.ts`, `projection-merge.ts`, `shopify-projection-diff.ts` |
| Inspect / write-through | `lib/shopify/product-sync.ts` |
| Admin refresh action | `refreshCommerceSyncStoreAction` in `app/admin/actions/sync.ts` |
| Editor re-inspect after save | `components/admin/products/product-edit-form.tsx` |

Migrations: `product_shopify_base_snapshot`, `product_working_snapshot`, `commerce_sync_store`, `collection_commerce_windows`.

Collection projection: `lib/shopify/collection-commerce-projection.ts`, fetch `collection-commerce-fetch.ts`, push/pull windows in `collection-presence-server.ts`.

---

## Product tab (first Shopify section)

Mirror Shopify Admin product header + Product organization:

- Title, handle/slug, description, SEO
- Vendor / Product type / Tags — suggestions from Shopify `productVendors`,
  `productTypes`, `productTags` (store-wide used values; free text still allowed)
- Category + Collections + site publish live on the Product tab (Shopify organization);
  Media stays separate
- Jewelry passport (synarava.*) lives on Synarava → Passport

Local Save write-through includes title, vendor, productType, tags into
`workingSnapshot` so conflict markers refresh after save.

---

## Media tab

Gallery is part of the dual commerce windows — **not** a parallel ProductMedia world.

| Piece | Behavior |
| --- | --- |
| SoT for detect / Media UI | `workingSnapshot.media` (OUR tree) |
| Local upload / reorder / remove | `ProductMedia` staging → write-through into `workingSnapshot.media` |
| After Pull with no local rows | Media tab shows OUR tree frames (CDN URLs from Shopify adopt) |
| Field Decisions | Media labels are choosable: Pull adopts whole `media`; Push runs product media pipeline |
| Whole-record fallback | Status / tags still use inline **Pull from Shopify** / **Push to Shopify** in the same dialog (no “Go to Sync”) |

Code: `shopify-snapshot-media.ts`, `finishProductMediaMutation` write-through,
`isMediaGalleryFieldLabel` in `catalog-conflict-policy.ts`,
`applyCommerceField` media branch.

---

## Inventory tab

Shopify Inventory + Shipping cards for the **primary variant**:

| Field | Behavior |
| --- | --- |
| SKU, Available quantity | Editable → Save → Push |
| Location quantities, barcode, tracked, sell-when-out-of-stock, weight, origin, HS | Pull projections (`AdminReadonlyField`); edit in Shopify Admin for now |

No separate Variants tab yet — multi-variant detail remains on Sync.

---

## Metafields tab

Shopify-native custom product fields (not the `synarava.*` passport):

| Step | Behavior |
| --- | --- |
| Edit values | Form fields → **Save** write-through into `workingSnapshot.metafields` |
| Sync to Shopify | **Push** / conflict resolve (same dual-window model as Price) |
| List definitions | `metafieldDefinitions(ownerType: PRODUCT)` |
| Add definition | `metafieldDefinitionCreate` (shop-wide schema only; not product sync) |

Passport stays on **Synarava → Passport**. Category / collection / publish stay on
**Product**. Managed namespaces (`synarava`, `shopify`, `global`) are excluded from
the Metafields editor.

Code: `lib/shopify/product-metafields-*.ts`,
`ProductMetafieldsPanel`, write-through in `shopify-projection-diff.ts`,
Push merges custom values from `workingSnapshot`.

---

## Product locale translations (sync protection)

| Rule | Behavior |
| --- | --- |
| `reviewStatus` vs `syncStatus` | Reviewed = ready to Push. Drafts with Shopify-shared copy still get `PENDING` so pulls cannot wipe them. |
| Shopify-shared fields | `title`, `handle`, `description`, `seoTitle`, `seoDescription` — any edit → `PENDING` regardless of Reviewed |
| Pull decision | Local non-empty + Shopify empty → `KEEP_LOCAL` (never `APPLY_REMOTE`). Both dirty → `CONFLICT`. |
| `products/*` webhooks | Commerce projection only — **no** translation pull (Shopify has no translation-update webhooks) |
| Resolve / Push | Blocked while the product form is dirty or Save is in flight |
| After apply | Refetch server conflict signals — no optimistic badge clear |

Code: `decideProductTranslationPull` / `resolveProductTranslationSyncStatus` in `lib/shopify/translations.ts`,
webhook `pullTranslations: false` in `app/api/shopify/webhooks/products/route.ts`.

---

## Collection membership on Push (2026-07 sources)

Product Push updates collection membership through Synarava-owned
`CollectionConditionsSource` deltas (`selectionsToAdd` / `selectionsToRemove`).
Shopify rejects emptying a condition source (last manual selection) with
“A condition based source must have at least one product selection or condition”.
Push then retries REMOVE via deprecated `collectionRemoveProducts` (Shopify’s
documented stopgap for collection-scoped sources). Failures name the collection
GID and action instead of surfacing the raw GraphQL line alone.

Category metafield `resolvedValues` are display enrichment on live product
fetches. Inspect backfills them onto matching OUR metafields before diff so
missing enrichment is not counted as empty-OUR commerce conflicts. Truly missing
metafields still need whole-record **Pull**.

## Known gaps (next branches)

- Full 3-way merge with explicit **base** (`B/L/R`) for ahead vs conflict.
- Remaining Shopify commerce fields / round-trip parity — continue per field.
- Catalog conflict UX polish and presence flows.
