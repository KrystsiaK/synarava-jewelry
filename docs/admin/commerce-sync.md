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
| Detect | One normalize → deep-diff windows. **No** commerce field allowlists for detection |
| Local Save | Write-through columns into `workingSnapshot`, patch OUR store slice, **re-inspect** so tab markers refresh |
| Markers | Shared commerce facts (e.g. price) light **Price** under **every** locale shell (EN/PT/RU), not EN-only |
| Cost / compare-at | Read from Shopify-shaped snapshot projection, not stale Prisma-only guesses |
| Console | DevTools filter `commerce-store` — full OUR + Shopify + conflicts on `/admin/products` entry |

```text
On /admin/products entry → refresh both stores → console flow
On product Save         → patch OUR + re-inspect → Price/etc. markers from fresh diffs
On push / pull / apply  → refresh windows + reload editor
```

Shopify catalog fetch for the full store is **paginated** (not N× `fetchShopifyProduct`).

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

Migrations: `product_shopify_base_snapshot`, `product_working_snapshot`, `commerce_sync_store`.

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

## Known gaps (next branches)

- Full 3-way merge with explicit **base** (`B/L/R`) for ahead vs conflict.
- Remaining Shopify commerce fields / round-trip parity — continue per field.
- Catalog conflict UX polish and presence flows.
