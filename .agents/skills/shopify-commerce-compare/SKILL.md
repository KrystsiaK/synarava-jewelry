---
name: shopify-commerce-compare
description: >-
  Synarava rule for Shopify commerce conflict detection: derive OUR Shopify-shaped
  window from columns + extras (ADR-0009), strip technical noise with a single
  normalize step used before compare, deep-diff objects vs shopifySnapshot.
  Never maintain commerce field allowlists for detection. Use when changing
  product/collection sync, inspectProductSyncState, catalog conflicts,
  derive-window / extras, or pull/push reconciliation.
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
   CDN URL query/hash). Use that function **before compare** against a live
   fetch (and when building any stored Shopify observation).
3. **Two states per entity** — Synarava **derived OUR window**
   (`deriveProductWindow` / `deriveCollectionWindow` from columns + `extras` +
   locale rows) ↔ Shopify `shopifySnapshot`. No stored `workingSnapshot`
   ([ADR-0009](../../../docs/adr/0009-derive-synarava-commerce-state.md)).
   Counters and badges come from `lib/sync` (`compareSyncState` →
   `selectSyncCounts`). There is no catalog-level `CommerceSyncStore`. See
   [`docs/wiki/commerce-sync.md`](../../../docs/wiki/commerce-sync.md).
4. **Deep-diff** windows (and presence). Status is derived from object
   compare — not “any column≠Shopify = conflict”.
5. **View columns** on the entity (`priceCents`, `taxable`, name, …) **are**
   OUR SoT for those fields; `extras` holds orphan Shopify-shaped keys (media
   GIDs, publications, metafields remainder, options, category object, variant
   HS/origin). Derive merges both at compare/push time. Save writes columns
   and/or patches `extras` — never a third commerce JSON column.
6. **Pull/push** refresh entity Shopify windows with the same normalize;
   Synarava content writes only on human Apply / Save.

Scoped **apply writers** (safe partial GraphQL mutations) may stay as a small
capability allowlist in `lib/sync/field-registry` (`scopedApply`). That is
**write**, not **detect**. Never reuse write allowlists as the detection model.
Path → human label for deepDiff leaves also comes from the field registry
(`labelForWindowPath`) — not a parallel PATH_LABELS table.

## Why the complicated path happened (do not repeat)

Historical drift in this repo:

1. Synarava needed **admin view columns** (Prisma) for editor UX.
2. Someone compared **Prisma columns ↔ live Shopify** with a **hand list** of
   fields instead of storing and comparing Shopify objects.
3. Each missing field (`taxable`, cost, …) became a one-off patch → illusion
   that “mapping is the architecture.”
4. A stored `workingSnapshot` duplicated columns and drifted when write-through
   was incomplete — ADR-0009 dropped it in favor of derive-on-the-fly.

Root mistake: treating “what we show in admin” as a second compare axis, or
storing a derived window as SoT. Compare owns the **derived Shopify-shaped
payload**. Admin owns **columns + extras**.

## Checklist when touching sync/conflicts

- [ ] Detection path does **not** add a new named field to a compare allowlist.
- [ ] New commerce data is added to the **GraphQL query** + flows into
      **columns or `extras`**, then **derive → canonicalize → deepDiff**.
- [ ] Noise stripping lives in **one** function shared by save/observe and compare.
- [ ] Catalog Conflicts differences come from **deepDiff** of derived windows
      via `lib/sync` (path → human label is presentation only / field-registry).
- [ ] Successful pull/push refreshes Shopify entity windows; local Save updates
      columns/`extras`; humans Apply Synarava content.
- [ ] Presence (Only in Shopify / Only in Synarava) stays membership — not
      payload compare.
- [ ] Do **not** reintroduce `workingSnapshot` writes (see
      `no-working-snapshot-writes.guard.test.ts`).

## Code anchors

- One sync module: `lib/sync/*` (waterfall, compare, select, apply, derive-window,
  field-registry, extras)
- Derive OUR window: `lib/sync/derive-window.ts` /
  `lib/sync/our-window-from-row.ts` / `lib/sync/read-synarava-state.ts`
- Payload observe + inspect: `lib/shopify/product-sync.ts`
  (`snapshotForShopifyProduct` → `canonicalizeShopifyProjection` on Shopify
  refresh; `inspectProductSyncState` → derive + `diffShopifyProjections`)
- Normalize + deepDiff: `lib/shopify/shopify-projection-diff.ts`
- Detection must **not** use `VARIANT_FIELD_COMPARATORS` / Prisma-column allowlists
  (`lib/shopify/reconciliation.ts` may keep helpers for other flows)
- Ownership doc: `docs/wiki/product-data-ownership.md`
- Current sync contract: `docs/wiki/commerce-sync.md`
- ADR: [`docs/adr/0009-derive-synarava-commerce-state.md`](../../../docs/adr/0009-derive-synarava-commerce-state.md)
- Operator verify: `scripts/db/verify-derived-window.mjs`
