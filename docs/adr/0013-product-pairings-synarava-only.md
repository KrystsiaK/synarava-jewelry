# ADR-0013: Product pairings as Synarava-only links (not Shopify bundles)

**Date**: 2026-11-25
**Status**: accepted
**Deciders**: владелец проекта

## Context

Necklace hooks and charms are separate catalog products that customers may buy alone or together. We need a curated “wears with” link with an optional pair photo, admin editing, storefront selection, and a single cart add of two normal Shopify lines. Shopify offers Bundles, Combined listings, Cart Transform functions, product metafields, and nested cart line attributes — none fit a Synarava-owned editorial pairing without sync ownership or storefront complexity.

## Decision

1. Store links in a local `ProductPairing` table (`baseProductId`, `addonProductId`, `sortOrder`) — Synarava-only; never push, pull, webhook, derive-window, or conflict-detect.
2. Pair photos are ordered rows in `ProductPairingImage` (`pairingId`, `imageAssetId`, `sortOrder`) pointing at `MediaAsset` under `uploads/pairings/` (not `ProductMedia`, which sync deletes after push). When a partner is selected on the PDP, the gallery shows only those pair photos (or one side-by-side frame if none); the Wear-together card always uses the partner’s own product image.
3. Cart adds 1–2 ordinary Storefront lines in one `cartCreate` / `cartLinesAdd`; no bundle parent, Cart Transform, or line attributes. Related cart copy is computed from the pairings table at read time.

## Alternatives Considered

### Shopify Bundles / Combined listings
- **Why not**: commerce ownership and inventory semantics belong to Shopify kits; Synarava editorial pairings must not invent a parallel commerce concept or depend on restricted Bundle APIs.

### Cart Transform / Functions
- **Why not**: transforms rewrite cart pricing/structure; we need two independent purchasable products with independent qty/remove, not a synthetic kit line.

### Product metafields / metaobjects for partners
- **Why not**: would enter Shopify sync windows and conflict detection (ADR-0003/0009); pair photo would fight `ProductMedia` push cleanup.

### Nested cart lines / parent–child attributes
- **Why not**: Storefront cart UX and analytics stay per-line; nesting is extra surface for no buyer benefit when both SKUs are normal variants.

## Consequences

- **Positive**: clear Synarava ownership; additive schema; one cart mutation path; pair photos survive media sync.
- **Negative**: pairings are invisible in Shopify Admin; operators manage them only in Synarava.
- **Risks**: accidental sync coupling — mitigate with a guard test that `lib/shopify/**` and `lib/sync/**` never reference `ProductPairing`.
