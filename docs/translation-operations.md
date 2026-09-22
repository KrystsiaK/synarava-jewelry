# Translation operations

## Daily workflow

Edit every registered locale (English plus any translation locale — Portuguese, Russian, and so on) in the same admin editor. The sticky locale tabs render one per registered locale and only change the visible panel; they do not save, upload media, or duplicate shared relations. Save the entity, then use **Admin → Localization** to check Shopify and review the fields that differ. The page distinguishes changes made only in Synarava, only in Shopify, and on both sides.

Use **Check now** to refresh the comparison. For a difference, review both values and choose the version to keep for each field before applying. An entity editor also has **Sync details** / **Review** beside the active language tab; **Compare and decide** opens the scoped comparison in Localization. A failed or incomplete check is not evidence that the values match. Catalog-specific conflict dialogs are a planned improvement, described in [`admin/catalog-conflict-resolution-ux.md`](./admin/catalog-conflict-resolution-ux.md).

## Shopify prerequisites

- Every locale you want to sync must be published in Shopify Markets — check **Admin → Localization**'s locale registry panel, which shows each registered locale's Shopify publication state.
- The app needs `read_translations`, `write_translations`, `read_locales` (or `read_markets_home`), `read_metaobjects`, `write_metaobjects`, `read_metaobject_definitions`, and `write_metaobject_definitions`.
- Page sync uses Shopify `PAGE`; structured Page (including The Edit copy) and Storefront Copy fields use `$app:page_section_copy` and `$app:storefront_copy` metaobjects with the translatable capability. Sync idempotently adds newly registered fields to an existing app-owned definition before writing values.

Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Review the machine report and resolve missing identity, unsupported targets, draft translations, and binding conflicts. Apply only after approval, then run the same report again; a clean second run must plan no new bindings. Today this report only checks Portuguese completeness (`scripts/lib/translation-coverage.mjs` is not yet locale-generic) — for a language other than Portuguese, verify completeness manually via **Admin → Localization** until that tool is generalized.

## Adding a new language

Enabling a new storefront language is a data/configuration exercise, not a code change:

1. **Enable and publish the language in Shopify Markets.** Synarava only ever treats a locale as commerce-ready once Shopify's own `shopLocales` reports it as published — this is the source of truth, not a local flag.
2. **Sync it into Synarava Admin and choose a stable URL segment.** On **Admin → Localization**, run "Check Shopify" to pull the new locale into the `StorefrontLocale` registry, then confirm or set its `routeSegment` (the URL prefix, e.g. `/de`) — this segment is meant to stay fixed once chosen, since it becomes part of every canonical URL for that language.
3. **Fill in or import translations and pass review.** Every N-locale admin editor (Product, Collection, Page, Storefront Copy) automatically grows a tab for the new locale — no editor code changes. Until real content is entered, buyer-facing pages render the English source content as an honest fallback rather than an error or blank page. Sync each entity to Shopify from **Admin → Localization** once its translation is reviewed.

No Prisma migration, TypeScript union, routing regex, or Shopify adapter needs to change for any of this — see `tasks/universal-localization-plan.md` for the architecture that makes that true.

## Failure recovery

1. Do not delete saved content in any locale. Shopify write failures leave the local translation intact and record a failed audit event.
2. Fix locale publication, scopes, definition capability, or the reported field mismatch.
3. Run **Check now** (or **Check** for the affected language in its editor), review the current values, and apply only the intended fields. Confirm that the next successful check shows no remaining difference for those fields.
4. For a conflict, compare local and Shopify values before choosing either version. Do not use a broad product push/pull as a substitute for reviewing localized fields.

## Rollback

Disable translation writes by removing `write_translations`, `write_metaobjects`, and `write_metaobject_definitions` from the app installation or by pausing the staged rollout. Storefront reads continue to use the local normalized translations with field-level English fallback. Do not remove bindings or translation rows during rollback; they are required for later reconciliation and audit history.

Database migrations are additive. If rollout must stop after migration, leave the new tables/columns in place and disable the feature entry point. A destructive schema rollback is not required and would discard operational history.
