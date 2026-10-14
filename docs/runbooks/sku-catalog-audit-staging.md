# SKU catalog audit — staging (Этап 5)

**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) § Этап 5  
**Platform Railway:** [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)

Read-only catalog audit against the sku-api ledger. No SKU creation. LLM off.  
**Staging / platform project only — never production n8n edits from this runbook without a separate approval.**

## Slice A (API + CLI) — shipped

| Piece | Path |
| --- | --- |
| Compare + digest + notify flag | `services/sku-api/src/audit/catalog-audit.ts` |
| HTTP | `POST /v1/workspaces/{key}/audit/catalog` |
| Dry-run CLI | `pnpm --filter @synarava/sku-api audit:catalog` |
| Fixture | `services/sku-api/fixtures/catalog-audit-sample.json` |

## Slice B (workflow) — shipped in repo; host = platform project

| Piece | Path |
| --- | --- |
| Workflow JSON | [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json) |
| Contract test | `lib/sku/__tests__/n8n-catalog-audit-workflow.test.ts` |

**Architecture (2026-10-14):** do **not** create n8n inside `synarava-shop`. Platform project is **`portable-sku-platform`** (ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`). **Staging has no n8n yet** — do not invent one via IaC; use the dry-run CLI until Kiryl approves adding staging n8n. Do **not** modify production `sku-platform-n8n` from staging ops.

Call sku-api over **HTTPS** with Bearer auth. When staging n8n exists: checkpoint via n8n static data; notify only when `shouldNotify: true`.

## Request shape

```json
{
  "items": [{ "externalVariantId": "gid://shopify/ProductVariant/…", "sku": "JW-NECK-001" }],
  "previousDigest": null,
  "correlationId": "corr-…"
}
```

Max batch **100**. `shouldNotify` only when deviations exist **and** digest ≠ `previousDigest`.

## Dry-run CLI

```bash
SKU_API_URL=https://<staging-sku-api-host> \
SKU_API_TOKEN="$SKU_API_TOKEN" \
pnpm --filter @synarava/sku-api audit:catalog \
  -- --fixture ./fixtures/catalog-audit-sample.json \
  --checkpoint ./.sku-audit-checkpoint.json
```

## Kiryl — manual steps (after platform architecture confirm)

**Stop:** do not apply Railway IaC or create synarava-shop n8n until the platform plan is confirmed.

1. Confirm staging sku-api HTTPS URL in **portable-sku-platform** (project ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`).  
2. Ensure Synarava staging web `SKU_API_URL` is that HTTPS URL.  
3. Prefer dry-run CLI until staging n8n exists. Create/import staging n8n **only** if Kiryl approves (platform project — not synarava-shop).  
4. When n8n exists: Credential Header Auth `Authorization: Bearer <token>`.  
5. Env: `SKU_API_URL=https://…`, `CATALOG_ITEMS_JSON`, `NOTIFY_WEBHOOK_URL`.  
6. Activate schedule `0 3 * * *` UTC; verify notify-once + silent re-run.

Pass criteria: read-only ledger; notify only on new digest; no synarava-shop sku-api duplicate.
