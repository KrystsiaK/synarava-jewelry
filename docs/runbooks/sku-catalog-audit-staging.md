# SKU catalog audit — staging (Этап 5 Slice A)

**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) § Этап 5  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)

Read-only catalog audit against the sku-api ledger. No SKU creation. No ledger ownership by the workflow. LLM off.

## What shipped (Slice A)

| Piece | Path |
| --- | --- |
| Compare + digest + notify flag | `services/sku-api/src/audit/catalog-audit.ts` |
| HTTP | `POST /v1/workspaces/{key}/audit/catalog` |
| Contract / client | `packages/sku-contract` `catalogAudit*` + `createSkuClient().auditCatalog` |
| Dry-run CLI | `pnpm --filter @synarava/sku-api audit:catalog` |
| Fixture | `services/sku-api/fixtures/catalog-audit-sample.json` |

**Not in Slice A:** Railway n8n service, recovery-queue workflow, `EXTERNAL_CHANGE_DETECTED` writes, production.

## Request shape

```json
{
  "items": [{ "externalVariantId": "gid://shopify/ProductVariant/…", "sku": "JW-NECK-001" }],
  "previousDigest": null,
  "correlationId": "corr-…"
}
```

- Max batch: **100** items (`CATALOG_AUDIT_MAX_BATCH`).
- `sku` = observed Shopify (or fixture) Variant SKU; may be `""`.
- Response includes `deviations`, `digest`, `shouldNotify`, `durationMs`, `llmEnabled: false`.
- `shouldNotify` is true only when there is at least one deviation **and** `digest !== previousDigest`.

### Deviation codes

| Code | Meaning |
| --- | --- |
| `MISSING_ASSIGNMENT` | Observed non-empty SKU; no ledger row for variant |
| `SKU_MISMATCH` | Ledger SKU ≠ observed |
| `EXTERNAL_EMPTY` | Ledger has SKU; observed empty |
| `INVALID_FORMAT` | Observed SKU fails published profile format |

## Dry-run CLI

```bash
# Against local sku-api (memory or Postgres)
SKU_API_URL=http://127.0.0.1:8787 \
SKU_API_TOKEN="$SKU_API_DEV_TOKEN" \
pnpm --filter @synarava/sku-api audit:catalog \
  -- --fixture ./fixtures/catalog-audit-sample.json \
  --checkpoint ./.sku-audit-checkpoint.json
```

Exit codes: `0` no new notify · `2` should notify · `1` transport/API error.

Checkpoint file stores the last `digest` so an identical second run does not notify again. Do not commit checkpoint files.

## Staging ops check (Kiryl)

1. sku-api healthy in **synarava-shop / staging**.
2. Prepare a small batch from Shopify Admin (or adapt the fixture with real GIDs/SKUs from M2).
3. Call `audit/catalog` (or CLI) twice with the same items — second run must have `shouldNotify: false`.
4. Confirm response never writes assignments (Settings → Assignments unchanged aside from prior manual work).

## Slice B (deferred)

- n8n workflow JSON calling the same HTTP endpoint on a schedule
- Private Railway n8n → private sku-api
- Notify sink (Slack/email) only when `shouldNotify`
