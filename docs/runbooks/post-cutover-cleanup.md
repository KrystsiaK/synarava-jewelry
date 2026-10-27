# Post-cutover cleanup — drop `_archive_*` tables

**Status:** ops plan only. Nothing in this runbook or its companion script runs in production by itself.

After ADR-0009 / EN-base cutovers, PostgreSQL keeps recovery copies:

| Archive table | Created by | Used for |
|---|---|---|
| `_archive_product_working_snapshot` | `20261026160000_derive_synarava_extras_drop_working_snapshot` | Restore `Product.workingSnapshot` via [`rollback-working-snapshot.sql`](../../scripts/db/rollback-working-snapshot.sql) |
| `_archive_collection_working_snapshot` | same | Restore `Collection.workingSnapshot` |
| `_archive_product_translation_en` | `20261025214900_archive_and_drop_en_translation_rows` | Restore EN `ProductTranslation` via [`rollback-en-translation-rows.sql`](../../scripts/db/rollback-en-translation-rows.sql) |
| `_archive_collection_translation_en` | same | Restore EN `CollectionTranslation` |
| `_archive_page_translation_en` | same | Restore EN `PageTranslation` |

Dropping them is irreversible without a backup. Keep them until the waiting period and a fresh backup say otherwise.

Related: [`derive-synarava-state-release.md`](derive-synarava-state-release.md), [`release-prod.md`](release-prod.md), [`deploy.md`](deploy.md), [`prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql).

---

## When it is safe to drop

All of the following:

1. **Waiting period** — at least **14 days** after the cutover migration landed on production and traffic resumed (longer if any rollback was discussed).
2. **Verify gate still green** — for working-snapshot archives, `scripts/db/verify-derived-window.mjs` was exit 0 post-cutover; no plan to roll app code back to `workingSnapshot`.
3. **EN model stable** — admin EN tabs use base columns only; no need to re-insert `locale='en'` translation rows.
4. **Fresh backup** — Railway production Postgres → Backups → **manual backup** (or confirmed PITR restore point) taken **immediately before** the drop, restored once into a throwaway service to prove the dump is readable.
5. **Readiness SQL** — [`prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql) sections 3a–3c still report archives present with expected counts (document the numbers in the change ticket).
6. **Owner authorization** — explicit human OK; no agent drops production tables unprompted.

Do **not** drop during an incident, while a staging→main promote with migrations is in flight, or while `ShopifyReconcileRun` is `QUEUED`/`RUNNING`.

---

## Safe plan (checklist)

- [ ] Waiting period elapsed; cutover date recorded.
- [ ] Manual backup created and smoke-restored to a **new** Postgres service (never restore over live).
- [ ] Run [`prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql) sections 3a–3c; paste results into the ticket (counts only — no secret URLs).
- [ ] Confirm no open rollback window (see derive / EN rollback scripts).
- [ ] Copy **only** the needed `DROP TABLE` lines from [`drop-archives.sql.commented`](../../scripts/db/drop-archives.sql.commented) into a local scratch file, uncomment them, and review.
- [ ] Railway → production Postgres → **Data** (Query): paste **one** `DROP TABLE IF EXISTS …;` at a time.
- [ ] Re-run archive presence check (`to_regclass`…); expect all dropped names `NULL`.
- [ ] Smoke: `/api/health`, admin top-bar sync check, one product page. Archives are unused by the app after cutover — storefront should be unchanged.
- [ ] Keep the pre-drop backup until the next successful scheduled backup cycle completes.

---

## Companion script (not executable)

[`scripts/db/drop-archives.sql.commented`](../../scripts/db/drop-archives.sql.commented) — every statement is commented out. The `.commented` suffix is intentional so operators do not paste a live drop by accident.

---

## Restore notes (if drop was premature)

| Situation | Action |
|---|---|
| Dropped before waiting period; live DB otherwise healthy | Restore the **pre-drop** backup into a new service; `CREATE TABLE … AS SELECT * FROM` the archive tables back into production via a controlled copy — or restore the whole DB if unsure. |
| Need `workingSnapshot` columns again | Prefer full DB restore from the **pre-cutover** backup. Archive SQL ([`rollback-working-snapshot.sql`](../../scripts/db/rollback-working-snapshot.sql)) is valid only inside the documented safety window and only if archives still exist. |
| Need EN translation rows again | Restore archives from backup, then [`rollback-en-translation-rows.sql`](../../scripts/db/rollback-en-translation-rows.sql). |
| Archives gone and no usable backup | Data in those tables is lost. Live catalog still comes from Shopify + current columns; editorial EN-only history in the archives cannot be reconstructed from Shopify alone. |

Never point shadow-database / `migrate reset` tools at production. See [`database-incident-recovery.md`](database-incident-recovery.md).
