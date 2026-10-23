# Translation operations

**Model:** two states only (Synarava ↔ Shopify). No common-ancestor snapshot. See [`docs/wiki/translation-operations.md`](../wiki/translation-operations.md) and [ADR-0008](../adr/0008-sync-two-state-owner-model.md).

## Daily workflow

Edit every registered locale (English plus any translation locale — Portuguese, Russian, and so on) in the same admin editor. The sticky locale tabs render one per registered locale and only change the visible panel; they do not save, upload media, or duplicate shared relations. Save the entity, then use **Admin → Localization** to check Shopify and review the fields that differ. The page distinguishes changes made only in Synarava, only in Shopify, and on both sides. Refresh never overwrites Synarava copy — only a human Apply does.

Use **Check now** to refresh the comparison. For a difference, review both values and choose the version to keep for each field before applying. Product editors reuse the same catalog conflict dialogs from the locale tab (scoped to that product and language) — there is no separate Sync details path. Collection editors and **Admin → Collections** use the same preview/apply stack for translation conflicts (`COLLECTION`). A failed or incomplete check is not evidence that the values match. Catalog products can also be resolved from **Admin → Products** via **Show conflicts**; that flow previews every supported field and also includes products that exist only in Shopify or only in Synarava, with Pull or Push as the sole valid direction. See [`docs/wiki/catalog-conflict-resolution-ux.md`](../wiki/catalog-conflict-resolution-ux.md).

## Shopify prerequisites

- Every locale you want to sync must be published in Shopify Markets — check **Admin → Localization** → **Languages**, which shows each registered locale's lifecycle state (Draft / Published / Retired).
- The app needs `read_translations`, `write_translations`, `read_locales` (or `read_markets_home`), and for language lifecycle writes **`write_locales`** (enable / publish / unpublish / disable). Also `read_metaobjects`, `write_metaobjects`, `read_metaobject_definitions`, and `write_metaobject_definitions`.
- Page sync uses Shopify `PAGE`; structured Page (including The Edit copy) and Storefront Copy fields use `$app:page_section_copy` and `$app:storefront_copy` metaobjects with the translatable capability. Sync idempotently adds newly registered fields to an existing app-owned definition before writing values.

## Language lifecycle (ADR-0007)

`Draft` → `Published` → `Retired` → `Deleted` (data). Managed on **Admin → Localization → Languages**.

| State | Storefront | Switcher / sitemap / hreflang | Editor tabs |
|---|---|---|---|
| Draft | 404 | no | yes |
| Published | live | yes | yes |
| Retired | permanent **301** to default language | no | hidden (toggle “Show retired”) |
| Deleted | 301 stays | no | no (data removed after export + retention) |

Hide = Retire (reversible). Delete data requires: Retired ≥ 30 days, an export downloaded in the same session, typed language code, no unresolved sync differences, and `write_locales` (Shopify `shopLocaleDisable`). See [`docs/proposals/languages-as-data.md`](../proposals/languages-as-data.md) and [`docs/adr/0007-languages-as-data.md`](../adr/0007-languages-as-data.md).

Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Review the machine report and resolve missing identity, unsupported targets, draft translations, and binding conflicts. Apply only after approval, then run the same report again; a clean second run must plan no new bindings. Today this report only checks Portuguese completeness (`scripts/lib/translation-coverage.mjs` is not yet locale-generic) — for a language other than Portuguese, verify completeness manually via **Admin → Localization** until that tool is generalized.

## Adding a new language

Do these in order. Skipping a step is how storefront chrome stays in English after the locale already exists in admin. This is the only add-language checklist; field modes in detail live in [`translation-field-registry.md`](../wiki/translation-field-registry.md).

1. **Locale registry.** On **Admin → Localization → Languages**, add the language (Draft). With `write_locales`, Synarava enables it unpublished in Shopify; otherwise add/enable in Markets manually, then **Check Shopify**. Publish when copy is ready (Restore/publish path or Markets + Check Shopify). The `StorefrontLocale` registry is the only routing source of truth ([ADR-0007](../adr/0007-languages-as-data.md)). Admin editors list every *registered* locale (including Draft/Retired with the show-retired toggle). The public switcher and sitemap list **Published** only. Draft URLs 404; Retired URLs **301** to the default language.

2. **Messages file.** Run `pnpm messages:generate <code>` to draft `messages/<code>.json` from English (marked unreviewed). Register a static import in `lib/i18n/message-catalog.ts` so the client bundle includes it. English is the fallback for any missing key or missing catalog entry. Keep keys you intend to translate aligned with `messages/en.json` (the EN/PT key sets are required to match). For every storefront locale that ships a messages file, keep the full `product.*` key set (especially `product.specifications.*`) translated — missing keys make the RU/PT PDP show English chrome next to correctly localized passport labels from `lib/products/characteristics.ts`. Home Featured collections chrome lives under `home.archive.*`; material plate labels under `home.material.*`; final CTA eyebrow under `home.finalCta.eyebrow` (all editable in Shared → Home / `$app:storefront_copy`). Storefront URL prefixing uses `localePath` / `storefrontHref` — see [`docs/wiki/storefront-locale-urls.md`](../wiki/storefront-locale-urls.md).

3. **Dictionary strings that are not admin fields.** Some buyer-facing chrome is not an input in the page editor. It lives only in the messages file. That includes the legal eyebrow, contents label, back-to-store link, and each legal page next-link label (`legal.common`, `legal.privacy`, `legal.offer`, `legal.terms`, `legal.notice`). It also includes the **date month names** at `legal.common.months` (`january` through `december`). Write the grammatical form used inside a date — Russian uses the genitive (`сентября`, so `5 September 2026` renders as `5 сентября 2026`). `legal.common.datePattern` uses `{day}`, `{month}`, and `{year}` when the language needs particles or a different order (Portuguese: `{day} de {month} de {year}`). If the month names are missing, the shared legal date **stays in the source language** (the English month the admin typed). The storefront only rewrites dates shaped as `day Month year` with an English month name, for example `5 September 2026`.

4. **Admin fields: per locale vs shared.** Product, Collection, Page, and Storefront Copy editors grow a tab for the new locale with no editor code changes. Fill per-locale copy on that tab (titles, legal section text, and the **Last updated label**). An empty Last updated label falls back to `legal.common.lastUpdated` for the active locale, not to the English admin string, so existing pages do not go blank. **Shared** fields are one value for every language: slug, media, hrefs, and the legal **date** (`legalLastUpdated`). Saving copies that date onto every locale row so each row has it, but it is **not per-locale copy** — do not retype it per language and do not add a second date field. Changing the date is a single admin edit. The storefront formats that one string with the dictionary month names from step 3. Modes are declared in `lib/i18n/admin-field-registry.ts`.

5. **Content and review.** Fill or import translations and pass review. Until real content is entered, buyer-facing pages render the English source as a fallback rather than an error or a blank page. Sync each entity to Shopify from **Admin → Localization** once its translation is reviewed. Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Today that report only checks Portuguese completeness.

   **Shop / catalog product cards** (`/[locale]/shop`, `GET /api/catalog/products`) read **`Product` + `ProductTranslation`** for the request locale — there is no separate catalog translation table. Title/short description come from `resolveProductCopy` (same helper as the PDP). A locale row with an empty title is treated as missing copy and falls back to English. Russian (and other locales) must be filled under **Admin → Products → [product] → locale tab**, or pulled from Shopify translations when Shopify already has them; the storefront does not call Shopify live for card copy.

   Card chips share one locale resolver with filters and PDP (`localizeShopFacetValue` / taxonomy overlays):

   | Chip | EN identity | Display |
   |---|---|---|
   | Category | SPT leaf | overlay → dictionary → EN |
   | Product type | `Product.productType` (URL key stays EN) | `productTypeLabel` via same path |
   | Material | passport `material` / `materialLine` | `materialLabel` via same path |
   | SEO tags | Shopify tags | **hidden** when they duplicate type/material vocabulary |

   **Shop filter facet values** (category leaf, product type, material, finish/coating, origin) keep English/canonical keys for URLs and Prisma match. Display labels resolve in `getShopFilterData` via `lib/catalog/shop-facet-labels.ts`:

   - **Category leaf / product type:** shared `TaxonomyValueLabel` overlays (Admin → **Shared → Taxonomy**, `/admin/settings#shared-taxonomy`) → shipped jewelry vocabulary map → English. EN identity stays Shopify (`shopifyCategoryId` + English SPT leaf / `productType`). Standard Product Taxonomy categories are **not** a Shopify `TranslatableResourceType`, so there is no Translations API pull/push for category names — Synarava overlays only. `PRODUCT.product_type` **is** translatable: on product translation **pull**, a non-empty Shopify `product_type` upserts the shared product-type overlay (`source=SHOPIFY`). Synarava fills gaps. Shared overlays are **not** pushed to Shopify (`registerProductTranslation` still omits `product_type`).
   - **Material / finish / origin:** passport TEXT overlays first, then the shipped map, then English. Closed values missing from Passport still fall through the dictionary (including case-insensitive match for `304L` / `304l`).

   Tag and Compliance facets are hidden (`supportsTagFilters` / `supportsComplianceFilters`) — tags here are operational SEO/SKU noise with no locale surface; cards no longer surface those keywords as chips.

   **Shopify-owned jewelry specs** (material, care, finish, wrist fit, color, …) are edited on **Product → Shopify product specs** (`custom.*`). Prefer OUR `workingSnapshot.metafieldTranslations` (admin Save), then last-Pull `shopifySnapshot`, then Synarava Passport overlays, then the shipped jewelry value dictionary (same map as shop filters). **Synarava Passport** is Synarava-only (chain lengths, compliance) — not a duplicate editor for Shopify specs. Free-form care copy still needs a locale overlay; dictionary entries cover common closed values (Crystal pearl, 18K Gold PVD, …).

6. **Graphify.** After the locale wiring, messages, and this checklist change, run `graphify update .` so the knowledge graph indexes them.

## Shared structure vs localized text

Page fields like Material lexicon keep shared structure (specimen count, order, images) on the English source record. Locale rows overlay text only. Resolving PT or RU must never change Home composition (for example by substituting Featured collections for missing lexicon images). Field-level English fallback applies to blank translated strings; whole-array replacement of structured content is forbidden.

## Failure recovery

1. Do not delete saved content in any locale. Shopify write failures leave the local translation intact and record a failed audit event.
2. Fix locale publication, scopes, definition capability, or the reported field mismatch.
3. Run **Check now** (or **Check** for the affected language in its editor), review the current values, and apply only the intended fields. Confirm that the next successful check shows no remaining difference for those fields.
4. For a conflict, compare local and Shopify values before choosing either version. Do not use a broad product push/pull as a substitute for reviewing localized fields.

## Rollback

Disable translation writes by removing `write_translations`, `write_metaobjects`, and `write_metaobject_definitions` from the app installation or by pausing the staged rollout. Storefront reads continue to use the local normalized translations with field-level English fallback. Do not remove bindings or translation rows during rollback; they are required for later reconciliation and audit history.

Database migrations are additive. If rollout must stop after migration, leave the new tables/columns in place and disable the feature entry point. A destructive schema rollback is not required and would discard operational history.
