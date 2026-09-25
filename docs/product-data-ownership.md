# Product data ownership and synchronization

## Core rule

Shopify is the system of record for every customer-facing commerce field that Shopify can represent. Synarava must pull and preserve those fields before adding its own data. Synarava is an enrichment layer, not a competing catalog.

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
- Technical identifiers and a raw normalized snapshot are retained for reconciliation and audit, but are not exposed as storefront copy.
- Shopify IDs are scoped to one canonical `*.myshopify.com` store. Switching to a duplicated store requires an explicit rebind before SKU/handle matching can establish the new IDs.

## Catalog concepts

- **Product category** means a Shopify Standard Product Taxonomy category. Synarava stores its GID and full name; there is no editable local category lifecycle.
- **Category attributes** are Shopify-owned. Pull resolves selected `shopify.*` category metafields (taxonomy-value or metaobject references) to display names, surfaces them in the admin Catalog and Shopify mirror, and may seed empty Synarava passport characteristics for known mappings (Color → `color`, Fabric/Material → `material`, Size → `size`, and similar). Unmapped attributes stay in the snapshot / Additional details. Push does not write TaxonomyValue GIDs; passport fields still round-trip as `synarava.*` metafields.
- **Collection** is the only product-grouping model. The local record projects Shopify identity and membership while retaining Synarava-owned editorial presentation.
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

Structured characteristics are searchable, filterable, grouped, and mirrored to Shopify metafields whenever Shopify supports a compatible metafield type.

### Dimensions and fit

- internal and external diameter;
- length, width, height, overall length, chain length, adjustable length;
- pendant length and width;
- size, fit notes, neck fit, wrist fit;
- unit weight (Shopify variant weight is preferred when available).

### Materials and construction

- primary and secondary materials;
- metal, purity or alloy;
- stone, pearl, and bead details;
- finish, plating, color, origin, production method, clasp type.

### Care and fulfilment

- care instructions;
- packaging;
- warranty;
- made-to-order and lead-time information;
- sold unit or set contents.

### Compliance and documents

- REACH certification and certificate URL;
- lead, cadmium, and nickel-release declarations;
- hypoallergenic declaration;
- additional safety or customer-facing disclosure.

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
