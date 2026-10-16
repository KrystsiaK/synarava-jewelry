# Legacy SKU backfill — TDD evidence

## Guarantee

Pre-cutover Shopify SKU values are immutable exceptions. They are stored
verbatim as `LEGACY_V0`; policy v1 is used only for new allocation. A backfill
must be reviewed as a dry-run and may be applied only with the identical digest.

| What is guaranteed | Test | Result |
| --- | --- | --- |
| A legacy SKU that policy v1 cannot parse is preserved verbatim | `services/sku-api/src/legacy-import.test.ts` | PASS |
| Repeating the import creates no duplicate assignment | `services/sku-api/src/legacy-import.test.ts` | PASS |
| Dry-run separates create/existing/empty rows and reports conflicts | `services/sku-api/src/legacy-backfill.test.ts` | PASS |
| Apply rejects a digest different from the reviewed snapshot | `services/sku-api/src/legacy-backfill.test.ts` | PASS |
| A matching imported legacy exception produces no audit deviation | `services/sku-api/src/audit/catalog-audit.test.ts` | PASS |
| Authenticated HTTP dry-run → apply → audit completes with zero deviations | `services/sku-api/src/http/server.test.ts` | PASS |
| Apply mode requires an expected digest in the shared contract | `packages/sku-contract/src/v1.test.ts` | PASS |

## RED / GREEN evidence

- RED: legacy importer threw `INVALID_SKU_FORMAT` for a pre-cutover value.
- RED: `/legacy-backfill` returned `404` before the guarded endpoint existed.
- GREEN: `pnpm --filter @synarava/sku-api test` — 41/41 tests passed.
- GREEN: `pnpm --filter @synarava/sku-contract test` — 7/7 tests passed.
- GREEN: both package typechecks passed.

PostgreSQL integration remains environment-dependent and must run in CI or an
approved database-backed environment before merge. No production mutation is
part of this evidence.
