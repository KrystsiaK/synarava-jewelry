# Translation operations

## Daily workflow

Edit English and Portuguese in the same admin editor. The sticky locale tabs only change the visible panel; they do not save, upload media, or duplicate shared relations. Save the entity, then use **Admin → Localization** to review `MISSING`, `PENDING`, `FAILED`, and `CONFLICT` resources.

`Retry` is available only for missing, pending, or failed resources. It performs an idempotent Shopify upsert/register. Conflicts never retry automatically: open the linked editor, review both versions, and deliberately choose which side wins using the entity's sync controls.

## Shopify prerequisites

- Portuguese (`pt-PT`) must be published in Shopify Markets.
- The app needs `read_translations`, `write_translations`, `read_locales` (or `read_markets_home`), `read_metaobjects`, `write_metaobjects`, `read_metaobject_definitions`, and `write_metaobject_definitions`.
- Page sync uses Shopify `PAGE`; structured Page (including The Edit copy) and Storefront Copy fields use `$app:page_section_copy` and `$app:storefront_copy` metaobjects with the translatable capability. Sync idempotently adds newly registered fields to an existing app-owned definition before writing values.

Run `pnpm translations:backfill --dry-run --strict` before enabling writes. Review the machine report and resolve missing identity, unsupported targets, draft translations, and binding conflicts. Apply only after approval, then run the same report again; a clean second run must plan no new bindings.

## Failure recovery

1. Do not delete local EN/PT content. Shopify write failures leave the local translation intact and record a failed audit event.
2. Fix locale publication, scopes, definition capability, or the reported field mismatch.
3. Retry the individual resource from **Localization**. Confirm its status becomes `SYNCED` and that actor/direction/result appear in the audit line.
4. For a conflict, compare local and Shopify values before choosing push or pull. Never use a bulk retry to resolve conflicts.

## Rollback

Disable translation writes by removing `write_translations`, `write_metaobjects`, and `write_metaobject_definitions` from the app installation or by pausing the staged rollout. Storefront reads continue to use the local normalized translations with field-level English fallback. Do not remove bindings or translation rows during rollback; they are required for later reconciliation and audit history.

Database migrations are additive. If rollout must stop after migration, leave the new tables/columns in place and disable the feature entry point. A destructive schema rollback is not required and would discard operational history.
