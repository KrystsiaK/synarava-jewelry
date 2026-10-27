# Commerce sync — two-state owner model

**Status:** live on staging/main (**one** sync system).  
**Date:** 2026-10-26  
**Contract:** [`docs/history/sync-unification.md`](../history/sync-unification.md) (historical owner-model write-up); [ADR-0008](../adr/0008-sync-two-state-owner-model.md); [ADR-0009](../adr/0009-derive-synarava-commerce-state.md) (derive OUR window); [ADR-0010](../adr/0010-field-contract-and-verified-convergence.md) (field contract + verified convergence — **accepted**; PR-6..8 on staging).

**Two states only:** Synarava **derived OUR window** (columns + `extras` + locale rows) ↔ Shopify `shopifySnapshot` (last fetched). No stored `workingSnapshot`.  
**Nothing automatic writes Synarava content** — webhooks/refresh update the Shopify-side copy; humans Apply.  
**ONE compare → SyncResult leaves:** `lib/sync` (`compareSyncState` → `SyncResult` leaves → `selectSyncCounts` / ConflictResolver fields / list + banner). Low-level commerce window diff remains `canonicalizeShopifyProjection` + `diffShopifyProjections` (ADR-0003). No third-state base / ancestor. No `CommerceSyncStore` catalog cache.  
**Field contract** (`lib/sync/field-registry.ts`): each commerce leaf carries `contractKey` / `section` / (whole-item) `parts` — consumers route tabs and chips from that metadata, not path/label regex. Unknown non-technical paths → blocked `Unmapped Shopify field <path>`.  
**Verified convergence:** after Apply/write, one scoped entity recheck proves intended leaves cleared (`verifyConvergenceAfterWrite`). Destructive collection Remove archives into `SyncEntityArchive` first (restore: [`scripts/db/restore-entity-archive.sql`](../../scripts/db/restore-entity-archive.sql)).  
**Conflict buttons (English UI):** **Take Shopify** = pull Shopify → Synarava; **Keep ours** = push Synarava → Shopify. Whole-item commerce uses one leaf labelled **Product data (N fields)** (`commerce:whole-item`). Multi-variant products: Keep ours / Push blocked until multi-variant push exists — Take Shopify still works.  
**`syncStatus` is not the conflict SoT** — list, banner, resolver, and badges derive from SyncResult leaves. `Product.syncStatus` / `Collection.syncStatus` remain operational (PENDING / FAILED / SYNCED / identity CONFLICT / UNLINKED), not a parallel conflict inventory.

This is the only admin sync architecture doc for the current model. Older drafts
(`shopify-sync-architecture*`, target-architecture, dual-snapshot, marker-propagation,
`projection-merge`, `shopifyBaseSnapshot`, `CommerceSyncStore` / `lib/commerce-store`) were removed; do not resurrect them.

UX dialogs / field spines: [`catalog-conflict-resolution-ux.md`](./catalog-conflict-resolution-ux.md).  
Field ownership: [`product-data-ownership.md`](product-data-ownership.md).\
Agent rule: [`.agents/skills/shopify-commerce-compare/SKILL.md`](../../.agents/skills/shopify-commerce-compare/SKILL.md).  
Proposal: [`docs/proposals/derive-synarava-state.md`](../proposals/derive-synarava-state.md).

---

## What is live

| Piece | Behavior |
| --- | --- |
| Per-product windows | OUR = `deriveProductWindow(columns + Product.extras)` + `Product.shopifySnapshot` (last Shopify). Orphan keys (media GIDs, publications, metafields remainder, options, category object, variant HS/origin) live in `extras`. |
| Per-collection windows | OUR = `deriveCollectionWindow(columns + Collection.extras)` + `Collection.shopifySnapshot` (title/handle/description/seo V1). Pull replaces those local columns, including an empty Shopify value. Choosing Shopify for a Synarava-only collection deletes it. Hero, manifesto, symbolism, and site state stay Synarava. |
| Detect / counters | Waterfall in `lib/sync`: refresh Shopify copy → read Synarava (derive) → `compareSyncState` → SyncResult leaves → `selectSyncCounts` / `slice` for every badge/chip/banner (including **sectionChip** filtered by leaf/part `section`). Every counter is **leaf conflicts** (`count(entity) = count(base) + sum(locales)`), never distinct entities. **No** commerce field allowlists for detection; field registry owns labels/scopes/sections/apply; tab dots use `signal.sections` |
| One-sided presence | A product or collection missing from either side produces exactly one `presence` leaf on `node: base` with `locale: null`. Commerce and translation leaves for that entity are suppressed until both copies exist. |
| Local Save | Update columns; patch `extras.media` / metafields / metafieldTranslations as needed; then **after-save one-entity recheck** (`runAfterSaveCatalogConflictCheck` + `{ kind:"product"|"collection", …Id }`) — refresh+compare that entity only; does not stamp top-bar `checkedAt` |
| SKU assign | **Inventory** tab (Push gate copy says “Stock tab”) → **Family → Preview → Confirm assign** (or Resume). PENDING-\* placeholders need that path before Push (sku-api). Column write + after-save one-entity product recheck. Derive reads `ProductVariant.sku` |
| Markers | Shared commerce facts (e.g. price) light **Price** under **every** locale shell (EN/PT/RU), not EN-only |
| Cost / compare-at | Shopify-owned. Read from Shopify-shaped snapshot. **Linked Push / Keep ours never sends `inventoryItem.cost`** (create may still seed cost). Compare-at is pull projection in the Price UI |
| Dirty form | Product editor dirty markers come from **named field values** vs last-saved baseline (`recomputeDirtyFromForm`) — not a boolean stamp |
| Admin API | Shopify Admin GraphQL **2026-07**; client retries explicit throttle / shortfall (`lib/shopify/admin.ts`) |
| Translations | Two-way only: Synarava row ↔ Shopify translation. Differs = divergence; human Apply / force Push chooses. No `KEEP_LOCAL` / `APPLY_REMOTE` / `localIsDirty` auto paths |
| Default-locale EN dedupe | Drop an EN **translation** leaf only when a **commerce** leaf already covers the same field (narrow label→fieldKey map). PAGE EN and non-commerce editorial translation leaves stay |
| Product-type labels | Human Apply via Field Conflict preview (`affects N products` confirm) or Settings → Taxonomy. No `applyShopifyProductTypeLabel` auto-write |

```text
ONE fetch place (Shopify network):
  • Top-bar Shopify control — click (MANUAL) + once per login session (AUTO)
    → full catalog: products + collections + translations + presence; stamps checkedAt
  • After Save / Apply / Push / Pull / SKU assign — one-entity recheck only
    (`runAfterSaveCatalogConflictCheck` + RefreshShopifyStateScope product|collection)
    → does NOT overwrite latest complete catalog checkedAt/status; no second full run
  • Cache invalidation (admin revalidatePath + revalidateStorefront) runs at the
    write, BEFORE the recheck — recheck must not gate caches (Take-Shopify delete)
  • Apply preview safety — single-entity refresh then the same compare → leaves
  • After Create in Shopify (unlinked → linked) — narrow presence row clear for
    that product (`removeCatalogPresenceDifference`); no catalog presence scan
NOT a fetch:
  • Opening ConflictResolver / list / banner / layout badge → waterfall skipRefresh (persisted windows + SyncResult leaves)
  • Language settings save — no post-action catalog check (next top-bar / login Auto)
On push / pull / apply → refresh Shopify windows as needed; Synarava content writes are human Apply only
```

Collection **membership** (which products belong to a collection) stays product-driven push/pull; it is not part of the collection commerce window yet.

---

## Marker tree (short)

Conflict **display** is a tree: entity = branch; inside it the **base** node
(EN tab — shared commerce + base text) and sibling **locale** nodes (PT, RU, …).
Shared fields (image, price, status…) live once on base — editable from any
locale form as a window into that single instance — but their conflicts belong
to **base only**. A shared conflict never lights a PT/RU tab; the banner never
lists languages for shared-only conflicts.

Counts come from one selector: `lib/sync/select.ts` → `slice(result, { entityId?, node? })`
with invariant `count(entity) == count(base) + sum(count(locale))`. Locale tab
dots use `slice(node=<locale>)`. One indicator (`SyncConflictIndicator` in
synarava-cms) is used at list / entity / locale / section chrome.

Opening conflicts from a **section** chip opens only that section’s fields.
Product and language chrome open the full product / locale set.

Code: `lib/sync/select.ts`, `commerce-conflict-section.ts`, `catalog-conflict-view.ts`
filters (`product` · `productLocale` · `productSection`), `SyncConflictIndicator`,
`AdminLocaleTabs` / section conflict chips.

### One compare result (banner · icon · ConflictResolver)

Every conflict surface shares **one** `SyncResult` from `lib/sync` (leaves are the SoT):

| Surface | Source |
| --- | --- |
| Catalog / collection banners | `selectSyncCounts` / `slice` over SyncResult leaves (leaf conflict count) |
| Nav / list chips | `selectSyncCounts(SyncResult, view)` |
| ConflictResolver field list | `catalogConflictFieldsForEntity(SyncResult, …)` via `load*ConflictFromSyncResult` (`skipRefresh` on open) |
| Product editor chrome | Conflict signals derived from the same leaves (no per-open Shopify inspect) |

Commerce axis: full Shopify-shaped windows (derived OUR vs `shopifySnapshot`), one normalize, deep-diff — **no** field allowlists. Compare sees only what the mapper keeps (`snapshotForShopifyProduct` / collection adopt + shared mirror helpers). Synarava overlays (`metafieldTranslations`, …) are stripped in normalize and must not pollute compare.

Translation axis: two-way diverge rows only. Default-locale EN translation leaves that mirror a commerce leaf for the same product/collection field are dropped in `compareSyncState` (narrow map); PAGE and non-commerce editorial stay as translation leaves. Do **not** drive the product banner from raw `getLatestReconcileDifferences()`, `Product.syncStatus === "CONFLICT"`, or a resurrected `get*CatalogConflict` dual compare.

---

## Code map

| Piece | Path |
| --- | --- |
| Waterfall / compare / select | `lib/sync/*` (`compareSyncState`, `selectSyncCounts`, `catalogConflictFieldsForEntity`) |
| Derive OUR window | `lib/sync/derive-window.ts`, `lib/sync/our-window-from-row.ts`, `lib/sync/extras.ts` |
| Normalize + deep-diff | `lib/shopify/shopify-projection-diff.ts` (`canonicalizeShopifyProjection`, `diffShopifyProjections`) |
| Refresh Shopify copy (no syncStatus CONFLICT write) | `refreshShopifyProductState`, `refreshShopifyCollectionState` |
| Apply-only live refresh | `recheckEntityConflictLeaves` / waterfall `skipRefresh: false` (refresh Shopify window + SyncResult leaves; not `inspect.differences`) |
| Resolver loaders (skipRefresh) | `loadProductConflictFromSyncResult`, `loadCollectionConflictFromSyncResult` |
| Field conflict UI | `components/synarava-cms/conflict-resolver*` (+ product/collection adapters) |
| After-action one-entity recheck | `lib/shopify/after-save-catalog-check.ts` → `runSyncWaterfall(scope)` (`product` / `collection`) |
| Full catalog check (top-bar / login) | `lib/shopify/catalog-conflict-signals-server.ts` → `runCatalogConflictCheck` |

Migrations: `product_working_snapshot` (archived then dropped), `collection_commerce_windows`, `extras` backfill.  
Dropped: `Product.workingSnapshot` / `Collection.workingSnapshot` (ADR-0009), `Product.shopifyBaseSnapshot`, `ShopifyTranslationSnapshot`, `ShopifyTranslationBinding.lastSyncedSnapshot`, `CommerceSyncStore` / `lib/commerce-store` (destructive — backup prod before deploy).

Collection windows: `deriveCollectionWindow` + `lib/shopify/collection-commerce-projection.ts` (normalize / remote adopt / push input), push/pull in `collection-presence-server.ts`.

---

## Product tab (first Shopify section)

Mirror Shopify Admin product header + Product organization:

- Title, handle/slug, description, SEO
- Vendor / Product type / Tags — suggestions from Shopify `productVendors`,
  `productTypes`, `productTags` (store-wide used values; free text still allowed)
- Category + Collections + site publish live on the Product tab (Shopify organization);
  Media stays separate
- **Shopify product specs** — editable `custom.*` jewelry facts (material, care,
  finish, wrist fit, color, metal, stone, plating, size). Save → columns +
  `extras.metafields` (+ locale overlays in `extras.metafieldTranslations`) →
  derive merges them for compare/Push via `metafieldsSet`. Also projects matching
  `ProductCharacteristic` rows for PDP/filters. These fields must **not** appear
  under Synarava → Passport.
- Last Pull — verification for taxonomy attribute selections, unit weight,
  country of origin, and other non-editable Pull projections
- Synarava-only passport (chain lengths, compliance → synarava.*) lives on
  Synarava → Passport

Local Save updates Prisma columns and patches `extras` (media / metafields /
metafieldTranslations) as needed. After Save, a **one-entity** recheck refresh+compares
that product only (does not stamp top-bar `checkedAt`) — there is no stored commerce JSON blob.

The product header is persistent across every section. It shows one Shopify
status (`Only in Synarava`, `Only in Shopify`, `In sync`, or `N conflicts`) and
at most one next action from the same SyncResult: Create in Shopify, Push, Pull,
or Resolve. Create/Push preconditions are shown inline before execution (for
example `SKU required` or `Save changes first`). The Sync tab is informational:
link, quantity, site state, last-sync data, and multi-variant detail. It does not
own a second status/action mechanism.

---

## Media tab

Gallery is part of the dual commerce windows — **not** a parallel ProductMedia world.

**Compare identity:** `canonicalizeShopifyProjection` keys each image by
**filename + alt + position** (not CDN url / width / height / Shopify media id).
One part per image position — never separate filename/alt/position subfield lines.

| Piece | Behavior |
| --- | --- |
| SoT for detect / Media UI | Derived OUR `media` from `Product.extras.media` (merged by `deriveProductWindow`) |
| Local upload / reorder / remove | `ProductMedia` staging → Save/media actions patch `extras.media` (merge matches prior nodes by URL so Shopify media ids survive remove/reorder) |
| After Pull with no local rows | Media tab shows OUR tree frames (CDN URLs from Shopify adopt into `extras.media`); **Remove** splices that index from `extras.media` and marks sync PENDING |
| Delete → Shopify | Push builds `productSet.files` from local staging + retained OUR-tree Shopify GIDs only. Remote media omitted from that list are deleted by productSet list-field semantics. Windows without a `media` key keep the legacy “preserve all remote” behavior (no wipe). |
| Alt text | Blur-saves via media actions (fields stay editable; no `router.refresh`); also in FormData as `media-alt-*` / `media-alt-tree-*` on product Save (Media-owned branch). Blur clears Media dirty synchronously so leave-guard does not false-positive. **Per-image alts stay distinct:** Push prefers local → OUR derived `media` → remote; never broadcasts the product title onto every image. Save merges local rows without wiping prior tree alts when staging alt is empty. |
| Field Decisions | Media labels are choosable: Pull adopts whole `media` into columns/`extras`; Push runs product media pipeline |
| Whole-record fallback | Status / tags still use inline **Pull from Shopify** / **Push to Shopify** in the same dialog (no “Go to Sync”) |

Code: `shopify-snapshot-media.ts`, media actions patching `extras.media`,
`product-media-alt-form.ts`, `isMediaGalleryFieldLabel` in `catalog-conflict-policy.ts`,
`applyCommerceField` media branch.

---

## Inventory tab

Shopify Inventory + Shipping cards for the **primary variant**. Field registry
marks stock, weight, origin, HS, and unit cost as **Shopify-owned**.

| Field | Behavior |
| --- | --- |
| SKU | Editable; PENDING-\* → Family → Preview → Confirm assign before Push (sku-api) |
| Available quantity | Editable locally → Save → inventory Push path (ownership remains Shopify) |
| Location quantities, barcode, tracked, sell-when-out-of-stock, weight, origin, HS | Pull projections (`AdminReadonlyField`); edit in Shopify Admin for now |
| Unit cost | Pull projection on Price; **never pushed on linked products** |

No separate Variants tab yet — multi-variant detail remains on Sync. Multi-variant
**Keep ours** is blocked in ConflictResolver (Take Shopify only).

---

## Metafields tab

Shopify-native custom product fields (not the `synarava.*` passport):

| Step | Behavior |
| --- | --- |
| Edit EN values | Form fields → **Save** patches `extras.metafields` (`mergeCustomMetafieldsIntoList`) |
| Edit PT/RU text | Locale overlays → `extras.metafieldTranslations` (stripped from commerce compare) |
| Sync to Shopify | **Push**: EN via `metafieldsSet`; PT/RU text via `translationsRegister` on Metafield GID (`key: value`) |
| List definitions | `metafieldDefinitions(ownerType: PRODUCT)` |
| Add definition | `metafieldDefinitionCreate` (shop-wide schema only; not product sync) |

Text types (`single_line_text_field`, `multi_line_text_field`, `rich_text_field`) are
per-locale. Numbers, dates, booleans, URLs, and JSON stay shared (edit in English).
Core jewelry `custom.*` specs (material, care, finish, …) stay on **Product →
Shopify product specs**. Synarava-only passport stays on **Synarava → Passport**.
Category / collection / publish stay on **Product**. Managed namespaces
(`synarava`, `shopify`, `global`) are excluded from the Metafields editor; Product-tab
jewelry specs are also omitted there (visible fields **and** hidden locale
overlay mirrors) so a second FormData owner cannot wipe PT/RU Product-tab edits
on Save. Gallery alt text is persisted on product Save from `media-alt-*` fields
(not blur-only).

Code: `lib/shopify/product-metafields-*.ts`,
`lib/shopify/product-metafield-translations.ts`,
`ProductMetafieldsPanel`, Save merge in `app/admin/actions/products.ts`,
Push registers per-locale Metafield translations.
[Manage translated content](https://shopify.dev/docs/apps/build/markets/manage-translated-content).

Push merges custom values from the derived OUR window (`extras.metafields`).
Cleared custom values delete Shopify metafields by owner/namespace/key; unset
form definitions do not create empty metafields. Writes are batched at 25
entries. Passport deletion uses both namespace and key so a same-named custom
field cannot prevent a passport clear.

Product and locale descriptions retain sanitized rich HTML through Pull/Save/Push.
Push clears empty SEO overrides on linked products rather than retaining the old value.

Conflict normalization omits metafield IDs and definitions; blank metafield values
represent absence. Metafields are matched by namespace/key before deep-diff, so
removing one never compares adjacent unrelated fields. UI labels use readable
field names. `global.title_tag` / `global.description_tag` are duplicate views of
native SEO, so windows with native `seo` compare that single representation.
Legacy windows without native SEO retain the metafields and label them SEO title /
SEO description.

ConflictResolver open reads SyncResult leaves with waterfall `skipRefresh` (no Shopify
fetch). Apply/preview may run a single-entity inspect for safety, then remaps leaves.
Synarava is OUR/local; Shopify is the remote value.

Catalog, language and section direction buttons open field details when full
commerce sync is required. Full Pull/Push remains available when those fields are
mixed with fields that can be selected individually; the whole-record scope is
explicit. Presence-only products retain their dedicated preview/apply flow.

Collection membership uses Shopify 2026-07 `collectionUpdate` source deltas. Removal
refreshes the managed source identity first; a missing collection/source already
satisfies removal (null node **or** Shopify “Collection does not exist” / not-found
errors). When the GID is gone, Push clears the local `shopifyCollectionId` /
`shopifyManualSourceId` link and that product’s membership — it does **not** toast a
hard failure that blocks the rest of the product sync. An emptied managed source is
deleted when other sources remain; for the final collection-scoped source the
Shopify-supported legacy stopgap remains. Shopify-authored sources are not removed
as a fallback.

Locale-scoped conflict direction arrows follow the tree: SHARED commerce under the
**base (EN)** shell only; PT/RU shells show translation leaves for that locale.
When the direction matrix has no per-field writes (blocked commerce, one-way
presence, or an empty set), the UI opens whole-record Pull/Push details instead of a
“No supported fields…” toast that looks like a broken sync.

---

## Product locale translations (sync protection)

| Rule | Behavior |
| --- | --- |
| `reviewStatus` vs `syncStatus` | Reviewed = ready to Push. Drafts with Shopify-shared copy still get `PENDING` so pulls cannot wipe them. |
| Shopify-shared fields | `title`, `handle`, `description`, `seoTitle`, `seoDescription` — any edit → `PENDING` regardless of Reviewed |
| Pull decision | Differs → `CONFLICT` (human Apply). Equal → `UNCHANGED`. `force` → `APPLY`. Never auto-wipe. |
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
Push refreshes the source ID first. Missing collection/managed source already
satisfies REMOVE. When that delta would empty the managed source, Push deletes
only that source if other sources remain; for the final source it retries via
deprecated `collectionRemoveProducts` (Shopify’s documented collection-scoped
stopgap). Failures name the collection
GID and action instead of surfacing the raw GraphQL line alone.

Category metafield `resolvedValues` are display enrichment on live product
fetches. Inspect backfills them onto matching OUR metafields before diff so
missing enrichment is not counted as empty-OUR commerce conflicts. Truly missing
metafields still need whole-record **Pull**.

### Metafield identity (normalize)

`canonicalizeShopifyProjection` (observe **and** compare) maps `metafields` by
`namespace::key` — not array index. Reordered-but-equal sets produce **zero**
conflicts; membership/value mismatches surface as identity paths
(`metafields.synarava::neck_fit.value`), never cascading `metafields[n].key`
phantoms. Inventory Save updates variant columns; derive rebuilds
`variants[].inventoryQuantity` and `totalInventory` together. After Push
inventory, refresh retries until the live quantity settles so a second Push
cycle is not required for lag alone.

## Known gaps (next branches)

- Full 3-way merge with explicit **base** (`B/L/R`) for ahead vs conflict.
- Remaining Shopify commerce fields / round-trip parity — continue per field.
- Catalog conflict UX polish and presence flows.
