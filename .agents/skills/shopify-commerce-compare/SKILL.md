---
name: shopify-commerce-compare
description: >-
  Synarava rule for Shopify commerce conflict detection: store one raw
  Shopify-shaped JSON on the entity, strip technical noise with a single
  normalize step used both before save and before compare, deep-diff objects.
  Never maintain commerce field allowlists for detection. Use when changing
  product/collection sync, inspectProductSyncState, catalog conflicts,
  shopifySnapshot / compare payload, or pull/push reconciliation.
---

# Shopify commerce compare (minimal procedure)

## Hard rule

**Do not** invent field-by-field compare allowlists for catalog conflict
detection (`VARIANT_FIELD_COMPARATORS`-style lists of “Price, SKU, taxable…”).
That pattern **will forget fields** (as `taxable` was) and create endless
patches.

**Do** this minimum loop only:

1. **One GraphQL product query shape** (only fields we need).
2. **One normalize function** — strip technical noise (pagination cursors,
   `updatedAt` for equality, media upload `status`, metafield `definition`,
   CDN URL query/hash). Use that function **before save** into the DB compare
   field **and** **before compare** against a live fetch.
3. **Dual full stores** (`CommerceSyncStore.ourSnapshot` +
   `shopifySnapshot`): each is a map of Shopify-shaped windows. Per-product
   `workingSnapshot` / `shopifySnapshot` are the entity slices that compose
   those stores. See
   [`docs/admin/commerce-sync.md`](../../../docs/admin/commerce-sync.md).
4. **Deep-diff** windows (and store-level presence). Status is derived from
   object compare — not “any column≠Shopify = conflict”.
5. **View columns** on the entity (`priceCents`, `taxable`, name, …) are
   **duplicates for admin UI** projected from Shopify — not a second compare
   axis. **Every local commerce save must write-through those values into the
   snapshot** (`writeThroughLocalCommerceToProjection`) **and** patch the OUR
   store slice. Otherwise price edits never appear as conflicts.
6. **Pull/push** refresh entity windows and **replace the Shopify store
   snapshot** (full refetch for now) with the same normalize.

Scoped **apply writers** (safe partial GraphQL mutations) may stay as a small
capability allowlist. That is **write**, not **detect**. Never reuse write
allowlists as the detection model.

## Why the complicated path happened (do not repeat)

Historical drift in this repo:

1. Synarava needed **admin view columns** (Prisma) for editor UX.
2. Someone compared **Prisma columns ↔ live Shopify** with a **hand list** of
   fields instead of storing and comparing Shopify objects.
3. Each missing field (`taxable`, cost, …) became a one-off patch → illusion
   that “mapping is the architecture.”
4. Overlay / dual-list designs tried to paper over (1)+(2) instead of fixing
   the axis: **object vs object**, noise stripped once.

Root mistake: treating “what we show in admin” as “what we compare for sync.”
Those are different jobs. Compare owns the **raw Shopify-shaped payload**.
Admin owns **projected columns**.

## Checklist when touching sync/conflicts

- [ ] Detection path does **not** add a new named field to a compare allowlist.
- [ ] New commerce data is added to the **GraphQL query** + flows into the
      **same normalize → save payload** builder.
- [ ] Noise stripping lives in **one** function shared by save and compare.
- [ ] Catalog Conflicts differences come from **deepDiff** of store windows
      (path → human label is presentation only).
- [ ] Successful pull/push refreshes entity windows and the Shopify store
      snapshot; local Save patches OUR store slice.
- [ ] Presence (Only in Shopify / Only in Synarava) stays membership — not
      payload compare.

## Code anchors

- Dual store: `lib/commerce-store/*` (`refreshCommerceSyncStore`,
  `compareCommerceStores`, `setProductWindow`)
- Payload write + detect: `lib/shopify/product-sync.ts`
  (`snapshotForShopifyProduct` → `canonicalizeShopifyProjection` on save;
  `inspectProductSyncState` → `diffShopifyProjections(working, shopify)`)
- Normalize + deepDiff: `lib/shopify/shopify-projection-diff.ts`
- Detection must **not** use `VARIANT_FIELD_COMPARATORS` / Prisma-column allowlists
  (`lib/shopify/reconciliation.ts` may keep helpers for other flows)
- Ownership doc: `docs/product-data-ownership.md`
- Current sync freeze: `docs/admin/commerce-sync.md`
