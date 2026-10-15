# Portable SKU — current status

**As of:** 2026-10-15  
**Canonical plan:** [`portable-sku-service.md`](../proposals/portable-sku-service.md) · **Wiki:** [`portable-sku-service.md`](portable-sku-service.md)

| Stage | Status |
| --- | --- |
| 1–4 | On staging (sku-api + Synarava adapter + matrix) |
| 5 Slice A | Catalog audit API + CLI — shipped |
| 5 Slice B | Staging n8n catalog audit — **smoke Pass**; notify = **Telegram** (`Notify Telegram · SKU`) |
| 6 | Not started (production rollout) |

## Stage 5 notify (live staging)

- Workflow: [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json)
- Branch: `shouldNotify?` → **Notify Telegram · SKU** → Save checkpoint (true); Save checkpoint only (false)
- Message includes **🟡 STAGING** and [SKU Audit](https://synarava-shop-app-staging.up.railway.app/admin/settings#shared-sku-policy)
- Secrets: `$env.TELEGRAM_CHAT_ID` + n8n Telegram credential — **never** in git
- Temporary `NOTIFY_WEBHOOK_URL` / **Notify webhook** — removed from monorepo (synced with live staging)

## Gates

- PR #148 (`staging`→`main`) stays open — no main merge
- No production n8n / Railway production edits
- No `railway config apply` without Kiryl confirm

## Runbooks

- [`sku-catalog-audit-staging.md`](../runbooks/sku-catalog-audit-staging.md)
- [`portable-sku-platform-railway.md`](../runbooks/portable-sku-platform-railway.md)
- Matrix: [`portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)
