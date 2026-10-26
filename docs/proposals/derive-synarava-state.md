# Proposal: Derive Synarava commerce state (drop `workingSnapshot`)

**Status:** accepted for implementation (owner green-light 2026-10-26)  
**ADR:** [ADR-0009](../adr/0009-derive-synarava-commerce-state.md)  
**Skill:** [shopify-commerce-compare](../../.agents/skills/shopify-commerce-compare/SKILL.md)

## Decision

OUR commerce compare state is **derived on the fly** from real Prisma columns/tables plus a small **`extras` JSON** for Shopify-shaped fields with no other home. `shopifySnapshot` stays. `workingSnapshot` is archived then dropped.

Detect remains **normalize + deepDiff** of Shopify-shaped windows (ADR-0003). The field registry owns labels, scopes, read/write — not a hand allowlist that replaces deepDiff.

## Field home table — Product

| Window path | Home | Scope | Notes |
| --- | --- | --- | --- |
| `id` | `Product.shopifyProductId` | base | |
| `title` | `Product.name` | locale (EN on base) | PT/RU → `ProductTranslation.title` |
| `handle` | `Product.slug` | locale | PT/RU → `localizedHandle` |
| `descriptionHtml` | `Product.description` | locale | |
| `vendor` | `Product.vendor` | base | |
| `productType` | `Product.productType` | base | |
| `tags` | `ProductTag` → `Tag` | base | |
| `status` | `Product.status` | base | `UNLISTED` has no Shopify peer |
| `seo.title` / `seo.description` | `Product.seoTitle` / `seoDescription` | locale | |
| `category` | **`extras.category`** (+ `shopifyCategoryId`/`Name` mirrors) | base | Full GraphQL category object in extras |
| `totalInventory` | sum `ProductVariant.stockOnHand` | base | derived |
| `options[]` | **`extras.options`** | base | No Shopify option GIDs on `ProductOption` |
| `collections[]` | `ProductCollection` + Collection identity | base | Rebuild `{id,handle,title}` |
| `publications[]` | **`extras.publications`** | base | No publication list columns |
| `media[]` | **`extras.media`** | base | `ProductMedia` cleared after Pull; GIDs/CDN only in extras |
| `media[i].alt` | extras media node (+ `ProductMedia.alt` when staging rows exist) | locale overlay | EN on node; locale alts via translation axis |
| `metafields` | known specs/passport → `ProductCharacteristic`; **remainder → `extras.metafields`** | base / synaravaOnly | Passport `synarava.*` = synaravaOnly (skipped in compare) |
| `metafieldTranslations` | **`extras.metafieldTranslations`** | locale overlay | Stripped from commerce canonicalize |
| `variants[i].id` | `ProductVariant.shopifyVariantId` | base | |
| `variants[i].title` | `ProductVariant.title` | base | |
| `variants[i].sku` | `ProductVariant.sku` | base | |
| `variants[i].barcode` | `ProductVariant.barcode` | base | |
| `variants[i].price` | `ProductVariant.priceCents` | base | cents → money string |
| `variants[i].compareAtPrice` | `ProductVariant.compareAtCents` | base | |
| `variants[i].inventoryPolicy` | `ProductVariant.inventoryPolicy` | base | |
| `variants[i].inventoryQuantity` | `ProductVariant.stockOnHand` | base | |
| `variants[i].taxable` | `ProductVariant.taxable` | base | |
| `variants[i].selectedOptions` | `ProductVariant.selectedOptions` | base | |
| `variants[i].inventoryItem.id` | `ProductVariant.shopifyInventoryItemId` | base | |
| `variants[i].inventoryItem.requiresShipping` | `ProductVariant.requiresShipping` | base | |
| `variants[i].inventoryItem.tracked` | `ProductVariant.tracked` | base | |
| `variants[i].inventoryItem.unitCost` | `ProductVariant.costCents` | base | |
| `variants[i].inventoryItem.measurement.weight` | `ProductVariant.weightGrams` | base | |
| `variants[i].inventoryItem.countryCodeOfOrigin` | **`extras.variantInventory[key]`** | base | |
| `variants[i].inventoryItem.harmonizedSystemCode` | **`extras.variantInventory[key]`** | base | |
| `updatedAt` | — (technical) | — | Stripped by canonicalize |
| Editorial (`shortDescription`, symbolism*, details, note, …) | Product columns / translations | synaravaOnly or translation axis | Not in commerce window |

**Media / variants rebuild:** columns alone **cannot** deep-equal stored `workingSnapshot.media` / orphan inventory fields (no media GID on `ProductMedia`; Pull clears staging rows; HS/origin have no columns). Those paths have a home in **`extras`**. Verify script must prove `canonicalize(derive(columns+extras))` ≡ `canonicalize(archived workingSnapshot)`.

## Field home table — Collection (V1)

| Window path | Home | Scope |
| --- | --- | --- |
| `id` | `Collection.shopifyCollectionId` | base |
| `title` | `Collection.name` | locale |
| `handle` | `Collection.slug` | locale |
| `descriptionHtml` | `Collection.description` | locale |
| `seo.*` | `Collection.seoTitle` / `seoDescription` | locale |

Collection `extras` is usually empty; reserved for future orphan Shopify keys. Synarava-only editorial (subtitle, manifesto, CTA, hero, …) stays on columns / translations — not commerce window.

## Page

No commerce windows. Translations only (`Page` + `PageTranslation`).

## Migration sketch

1. CTAS archive `_archive_product_working_snapshot` / `_archive_collection_working_snapshot` (`id`, `workingSnapshot`, `shopifySnapshot`).
2. Add `extras Json?`; backfill only no-other-home keys from `workingSnapshot`; `RAISE` if archive vs live counts differ.
3. `DROP COLUMN "workingSnapshot"`.
4. Rollback: restore column from archive (SQL in PR description).

## Operator gate

`scripts/db/verify-derived-window.mjs` — read-only compare of derive vs archived/`workingSnapshot` before merge.
