# Translation operations

## Daily workflow

Edit every registered locale (English plus any translation locale — Portuguese, Russian, and so on) in the same admin editor. The sticky locale tabs render one per registered locale and only change the visible panel; they do not save, upload media, or duplicate shared relations. Save the entity, then use **Admin → Localization** to check Shopify and review the fields that differ. The page distinguishes changes made only in Synarava, only in Shopify, and on both sides.

Use **Check now** to refresh the comparison. For a difference, review both values and choose the version to keep for each field before applying. Product editors reuse the same catalog conflict dialogs from the locale tab (scoped to that product and language) — there is no separate Sync details path. Collection editors and **Admin → Collections** use the same preview/apply stack for translation conflicts (`COLLECTION`). A failed or incomplete check is not evidence that the values match. Catalog products can also be resolved from **Admin → Products** via **Show conflicts**; that flow previews every supported field and also includes products that exist only in Shopify or only in Synarava, with Pull or Push as the sole valid direction. See [`admin/catalog-conflict-resolution-ux.md`](./admin/catalog-conflict-resolution-ux.md).

## Shopify prerequisites

- Every locale you want to sync must be published in Shopify Markets — check **Admin → Localization**'s locale registry panel, which shows each registered locale's Shopify publication state.
- The app needs `read_translations`, `write_translations`, `read_locales` (or `read_markets_home`), `read_metaobjects`, `write_metaobjects`, `read_metaobject_definitions`, and `write_metaobject_definitions`.
- Page sync uses Shopify `PAGE`; structured Page (including The Edit copy) and Storefront Copy fields use `$app:page_section_copy` and `$app:storefront_copy` metaobjects with the translatable capability. Sync idempotently adds newly registered fields to an existing app-owned definition before writing values.

Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Review the machine report and resolve missing identity, unsupported targets, draft translations, and binding conflicts. Apply only after approval, then run the same report again; a clean second run must plan no new bindings. Today this report only checks Portuguese completeness (`scripts/lib/translation-coverage.mjs` is not yet locale-generic) — for a language other than Portuguese, verify completeness manually via **Admin → Localization** until that tool is generalized.

## Adding a new language

Do these in order. Skipping a step is how storefront chrome stays in English after the locale already exists in admin. This is the only add-language checklist; field modes in detail live in [`translation-field-registry.md`](./translation-field-registry.md).

1. **Locale registry.** Enable and publish the language in Shopify Markets. Synarava treats a locale as commerce-ready only when Shopify `shopLocales` reports it published — that is the source of truth, not a local flag. Insert a `StorefrontLocale` row (`lib/i18n/storefront-locale-registry.ts`) with a stable URL segment before the locale can appear on the site. The Russian row is migration `20260921160000_add_russian_locale` with `/ru`, initially unpublished. On **Admin → Localization**, run **Check Shopify**. The check updates existing rows; it does not create a row for an unmatched Shopify locale. Admin editors list every *registered* locale so copy can be prepared early. The public language switcher lists only *Shopify-published* locales. Until Markets publishes the language and **Check Shopify** marks the row Published, the URL prefix (for example `/ru`) stays a storefront 404 even though the admin tab works.

2. **Messages file.** Add `messages/<code>.json` and register it in the `dictionaries` maps in `lib/i18n/server.ts` and `lib/i18n/context.tsx`. Add the code to `SUPPORTED_LOCALES` in `lib/i18n/locales.ts`. English is the fallback for any missing key. A language with no messages file renders interface text in English. Keep keys you intend to translate aligned with `messages/en.json` (the EN/PT key sets are required to match). For every storefront locale that ships a messages file, keep the full `product.*` key set (especially `product.specifications.*`) translated — missing keys make the RU/PT PDP show English chrome next to correctly localized passport labels from `lib/products/characteristics.ts`. Home Featured collections chrome lives under `home.archive.*`; material plate labels under `home.material.*`; final CTA eyebrow under `home.finalCta.eyebrow` (all editable in Shared → Home / `$app:storefront_copy`). Storefront URL prefixing uses `localePath` / `storefrontHref` — see [`i18n/storefront-locale-urls.md`](./i18n/storefront-locale-urls.md).

3. **Dictionary strings that are not admin fields.** Some buyer-facing chrome is not an input in the page editor. It lives only in the messages file. That includes the legal eyebrow, contents label, back-to-store link, and each legal page next-link label (`legal.common`, `legal.privacy`, `legal.offer`, `legal.terms`, `legal.notice`). It also includes the **date month names** at `legal.common.months` (`january` through `december`). Write the grammatical form used inside a date — Russian uses the genitive (`сентября`, so `5 September 2026` renders as `5 сентября 2026`). `legal.common.datePattern` uses `{day}`, `{month}`, and `{year}` when the language needs particles or a different order (Portuguese: `{day} de {month} de {year}`). If the month names are missing, the shared legal date **stays in the source language** (the English month the admin typed). The storefront only rewrites dates shaped as `day Month year` with an English month name, for example `5 September 2026`.

4. **Admin fields: per locale vs shared.** Product, Collection, Page, and Storefront Copy editors grow a tab for the new locale with no editor code changes. Fill per-locale copy on that tab (titles, legal section text, and the **Last updated label**). An empty Last updated label falls back to `legal.common.lastUpdated` for the active locale, not to the English admin string, so existing pages do not go blank. **Shared** fields are one value for every language: slug, media, hrefs, and the legal **date** (`legalLastUpdated`). Saving copies that date onto every locale row so each row has it, but it is **not per-locale copy** — do not retype it per language and do not add a second date field. Changing the date is a single admin edit. The storefront formats that one string with the dictionary month names from step 3. Modes are declared in `lib/i18n/admin-field-registry.ts`.

5. **Content and review.** Fill or import translations and pass review. Until real content is entered, buyer-facing pages render the English source as a fallback rather than an error or a blank page. Sync each entity to Shopify from **Admin → Localization** once its translation is reviewed. Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Today that report only checks Portuguese completeness.

   **Shop / catalog product cards** (`/[locale]/shop`, `GET /api/catalog/products`) read **`Product` + `ProductTranslation`** for the request locale — there is no separate catalog translation table. Title/short description come from `resolveProductCopy` (same helper as the PDP). A locale row with an empty title is treated as missing copy and falls back to English. Russian (and other locales) must be filled under **Admin → Products → [product] → locale tab**, or pulled from Shopify translations when Shopify already has them; the storefront does not call Shopify live for card copy.

   **Shop filter facet values** (category leaf, product type, material, finish/coating, origin) keep English/canonical keys for URLs and Prisma match. Display labels resolve in `getShopFilterData` via `lib/catalog/shop-facet-labels.ts`:

   - **Category leaf / product type:** shared `TaxonomyValueLabel` overlays (Admin → **Shared → Taxonomy**, `/admin/settings#shared-taxonomy`) → shipped jewelry vocabulary map → English. EN identity stays Shopify (`shopifyCategoryId` + English SPT leaf / `productType`). Standard Product Taxonomy categories are **not** a Shopify `TranslatableResourceType`, so there is no Translations API pull/push for category names — Synarava overlays only. `PRODUCT.product_type` **is** translatable: on product translation **pull**, a non-empty Shopify `product_type` upserts the shared product-type overlay (`source=SHOPIFY`). Synarava fills gaps. Shared overlays are **not** pushed to Shopify (`registerProductTranslation` still omits `product_type`).
   - **Material / finish / origin:** passport TEXT overlays first, then the shipped map, then English.

   Tag and Compliance facets are hidden (`supportsTagFilters` / `supportsComplianceFilters`) — tags here are operational SKU-like noise with no locale surface.

   **Shopify-owned jewelry specs** (material, care, finish, wrist fit, color, …) are edited on **Product → Shopify product specs** (`custom.*`). Prefer pulled Shopify Metafield translations; Product-tab locale overlays fill gaps. **Synarava Passport** is Synarava-only (chain lengths, compliance) — not a duplicate editor for Shopify specs. On the PDP, display order for mapped specs is: Shopify Metafield translations → Synarava overlays → English.

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
