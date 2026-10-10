# Product data ownership and synchronization

## Core rule

Shopify is the system of record for every customer-facing commerce field that Shopify can represent. Synarava must pull and preserve those fields before adding its own data. Synarava is an enrichment layer, not a competing catalog.

### Admin product editor (working model)

The product admin is built as **Shopify skeleton + Synarava sections**:

1. **Shopify skeleton** — every standard Shopify product/variant field we support must appear in admin, sync correctly (pull/push), and match Shopify Admin. We verify this field by field. This includes **Shopify-owned jewelry specs** shown in Last Pull (`custom.material`, care, finish, wrist fit, color, metal, stone, plating, size, plus vendor / product type / category / unit weight / origin projections): editable under **Product → Shopify product specs** (and organization fields above), not under Synarava Passport.
2. **Synarava sections** — CMS-only: **Passport** (Synarava-only parameters → `synarava.*` metafields on Push: chain lengths, compliance) and **Product page** (short description, material line, symbolism, materials story, process, lookbook). Shopify description/SEO live on the Product tab, not a separate Content tab.

The section tab strip is visually split into two clusters: **Shopify** (commerce skeleton + Sync) and **Synarava** (CMS-only). Tab count and Shopify-side layout will grow to mirror Shopify’s product admin more closely; Synarava tabs stay a separate group.

**Hard UI ownership:** fields that exist in Shopify (category attributes / product specs pulled from Shopify) are edited in the Shopify product section. They must **not** appear as duplicate editable fields under Synarava → Passport. Last Pull is verification for non-editable Pull projections (taxonomy attribute selections, unit weight, country of origin) — not the only interaction model for Shopify-owned specs.

The Price tab (Shopify group) mirrors Shopify Admin’s Price card on the primary
variant — editable `price` and `taxable`. **Compare-at** and **Cost** are
Synarava read-only pull projections.

The **Inventory** tab (Shopify group) mirrors Shopify’s Inventory + Shipping
cards for the primary variant: editable `sku` and available quantity; location
quantities, barcode, tracking, sell-when-out-of-stock, weight, country of origin,
and HS code are Pull projections (edit in Shopify Admin for now). No separate
Variants tab yet — multi-variant detail stays on Sync.

The synchronization boundary has three explicit layers:

1. **Shopify standard fields** — Shopify owns identity, sellability, pricing, inventory, variants, options, primary and gallery media, taxonomy, SEO, publication state, shipping measurements, and other supported product/variant fields.
2. **Shopify product metafields** — structured specifications, certificates, care information, fit, composition, provenance, and other reusable customer-facing facts are stored in the `synarava` namespace. Synarava provides the editing UI and mirrors these values bidirectionally.
3. **Synarava-only editorial content** — symbolism, material stories, craftsmanship narrative, editorial photography, lookbook composition, and storefront art direction remain local when Shopify cannot represent them without losing structure or editorial intent.

Localized Shopify product title, description, and SEO copy are shared fields. Values for every
registered Shopify locale, including Portuguese and Russian when that product's translation exists,
can be edited in either Synarava or Shopify Translate & Adapt and are reconciled explicitly. Shopify
has no translation-update webhook, so translation-only changes are discovered by a product refresh
or the catalog conflict check. Concurrent edits require an explicit winner for the affected locale and field;
Synarava-only localized fields and other locales are not cleared by that decision.

## Ownership rules

- A Shopify pull may replace Shopify-owned fields.
- A Shopify pull may seed or update a Synarava characteristic only when the corresponding Shopify metafield is present.
- An absent Shopify metafield must never erase a locally curated characteristic.
- A Shopify pull must never overwrite Synarava-only editorial content.
- A push sends Shopify-owned fields and mirrored characteristics only. It never flattens Synarava editorial content into the Shopify description.
- Conflicting edits to a field with shared ownership require an explicit choice: use Shopify or push the saved Synarava value.
- Technical identifiers and a **normalized Shopify-shaped payload** on the product
  (`shopifySnapshot` / compare field) are the **conflict-detection source of truth**:
  one normalize (strip technical noise) before save and before compare, then deep-diff.
  Do not maintain hand allowlists of commerce fields for detection — see
  [`.agents/skills/shopify-commerce-compare/SKILL.md`](../.agents/skills/shopify-commerce-compare/SKILL.md).
  Admin view columns are projections for the editor, not a second compare axis.
  Catalog-level compare uses dual full stores (`CommerceSyncStore` our vs shopify);
  see [`docs/admin/commerce-sync.md`](./admin/commerce-sync.md).
- Shopify IDs are scoped to one canonical `*.myshopify.com` store. Switching to a duplicated store requires an explicit rebind before SKU/handle matching can establish the new IDs.

## Catalog concepts

- **Product category** means a Shopify Standard Product Taxonomy category. Synarava stores its GID and full name; there is no editable local category lifecycle.
- **Category attributes** are Shopify-owned. Pull resolves selected `shopify.*` category metafields (taxonomy-value or metaobject references) to display names and surfaces them under Product category (Pull display) and Last Pull verification. Push does not write TaxonomyValue GIDs yet — edit selections in Shopify Admin, then Pull.
- **Shopify product specs** (`custom.material`, `care_instructions`, `finish`, `wrist_fit`, `color`, `metal`, `stone`, `plating`, `size`) are edited on **Product → Shopify product specs**. Save write-throughs `workingSnapshot.metafields` and projects matching `ProductCharacteristic` rows for PDP/filters. Push sends `custom.*` (not duplicate `synarava.*` for those keys). PT/RU use Shopify metafield translations when present; Synarava overlays only fill gaps. The Metafields tab must not emit FormData for these keys (including hidden locale mirrors) — duplicate empty values previously wiped Product-tab PT/RU overlays on Save.
- **Collection** is the only product-grouping model. The local record projects Shopify identity and membership while retaining Synarava-owned editorial presentation (including per-collection hero CTA label `ctaLabel`, localized in admin Synarava locale tabs; empty → Collections page chrome → dictionary).
- **Tags** are Shopify product tags edited on the product. Local tag rows are a synchronized read projection, not standalone admin-managed records.
- Tags power search and filters; they are not printed as a keyword list in the product purchase area.
- **Product type** is Shopify's free-form value and must round-trip without translation into a local enum.
- The product editor exposes vendor and product type as editable Shopify-owned fields. A read-only Shopify data section displays synchronized variants, their commerce values, product metafields, and the stored snapshot; Pull refreshes it.

The September 2026 migration and its deliberate compatibility remnants are
recorded in [`history/admin-shopify-refactor-2026-09.md`](./history/admin-shopify-refactor-2026-09.md).

## Shopify standard field coverage

The supported commerce projection should include, where available:

- product ID, handle, title, description HTML, vendor, product type, standard product category, status, timestamps;
- SEO title and description;
- tags, collections, publication channels;
- primary media and ordered gallery media with alt text;
- product options and all variants;
- variant title, selected options, SKU, barcode, price, compare-at price, inventory policy, quantity, taxable state, shipping requirement, weight, country of origin, harmonized system code, and variant media;
- inventory item and location references, including available, committed, on-hand, and unavailable quantities by location in the stored Shopify snapshot. Unavailable is calculated as on-hand minus available minus committed.

Shopify contains additional operational and analytical API fields. “All Shopify fields” in Synarava means all fields needed to reproduce the customer-facing product and reconcile its sellable state, not internal analytics or unrelated platform metadata.

## Synarava product passport

**Synarava-only** jewelry parameters (chain lengths, compliance flags) are
editable under **Synarava → Passport** (**Product parameters**). Save stores them
locally; Push mirrors **English** values to Shopify as `synarava.*` metafields.

Shopify-owned specs (material, care, finish, wrist fit, color, metal, stone,
plating, size, origin) are **not** Passport fields — see Product → Shopify
product specs (and Inventory Pull projections for weight / origin).

**Localization:**

| Layer | Where |
| --- | --- |
| Group titles, field labels, units (`cm`/`g`) | Code dictionaries in `lib/products/characteristics.ts` (EN/PT/RU) |
| Shopify-owned TEXT specs | Prefer `workingSnapshot.metafieldTranslations` (Save) then last-Pull `shopifySnapshot`; Passport overlays fill gaps; then jewelry dictionary (`localizeShopFacetValue`); blank → EN |
| Passport TEXT (Synarava-only) | Per-locale overlay on `ProductTranslation.details.characteristics`; blank → EN |
| NUMBER / BOOLEAN | Shared `ProductCharacteristic` (EN); Yes/No display localized in code |
| Category leaf + product type | Shared → Taxonomy / code map when Shopify has no translation |

The passport checklist is intentionally small (Synarava-only). Arbitrary merchant
fields use the **Metafields** tab. Core jewelry `custom.*` specs use **Product**.

**Catalog** product-editor tab is gone — category, collection, and site publish
live on **Product** (Shopify organization).

### Metafields tab (Shopify-native custom fields)

- Lists shop-wide PRODUCT metafield definitions excluding managed namespaces
  (`synarava`, `shopify`, `global`).
- **Add definition** → `metafieldDefinitionCreate` (shop-wide schema in Shopify;
  not a product Save).
- **EN values** → edit in the form → **Save** writes OUR `workingSnapshot.metafields` →
  **Push** / conflict resolve sends them via `metafieldsSet` (same dual-window
  sync as other commerce fields).
- **PT/RU text** → per-locale overlays in `workingSnapshot.metafieldTranslations`
  (not part of commerce conflict compare) → **Push** via Shopify
  `translationsRegister` on the Metafield GID (`key: value`). Blank falls back
  to English on the site. Non-text types stay shared.
- Same capability as Shopify Admin → Settings → Custom data → Products /
  product Metafields card, plus Markets translations for text fields.

Docs: [Manage metafield definitions](https://shopify.dev/docs/apps/build/metafields/definitions),
[`metafieldDefinitionCreate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldDefinitionCreate),
[`metafieldsSet`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/metafieldsSet),
[Manage translated content](https://shopify.dev/docs/apps/build/markets/manage-translated-content).

### Passport vocabulary (edit UI — Synarava-only)

Groups with data open by default; empty groups stay collapsed.

### Dimensions and fit

- chain length, adjustable length.

### Compliance

- REACH certification (optional certificate URL);
- lead, cadmium, and nickel-release declarations.

### Shopify product specs (Product tab — not Passport)

- primary material, care instructions, finish, wrist fit;
- color, metal, stone / gem, plating, size;
- vendor, product type, category (organization fields);
- unit weight / country of origin (Inventory Pull projections).

Passport TEXT values (Synarava-only) are locale-split end-to-end: admin locale
tabs write overlays via prefixed FormData (`ruCharacteristic_*`), never the
shared EN named fields. The Passport field shell must not use
`display: contents` around HTML `hidden` EN controls — that combination leaves
EN editors clickable on PT/RU in Chromium and overwrites every language.

## Storefront presentation

- The hero exposes essential commerce facts immediately: description, price, SKU, availability, variants, compare-at price, and composition.
- The product passport groups populated specifications by meaning. Empty facts are not fabricated and are not rendered.
- Brand, product type, SKU, barcode, and primary-variant weight appear in the factual passport when populated.
- Simple product metafields with a Shopify definition explicitly marked `PUBLIC_READ` appear under Additional details. Shopify category metafield taxonomy references are resolved to their names and appear there as product facts. Other private definitions and unresolved reference/JSON values remain in the admin snapshot only.
- Care guidance beside the purchase action uses the product's own care instructions when present; no generic care statement is fabricated.
- Certificates are linked from the related compliance row.
- Editorial modules follow the factual passport: material meaning, symbolism, craftsmanship, lookbook, care, and related products.

## Search projection

Search documents include Shopify identity and description, tags, option and variant values, and all characteristics marked searchable. Facets use normalized characteristics marked filterable. Editorial prose can improve recall but never replaces structured filters.
