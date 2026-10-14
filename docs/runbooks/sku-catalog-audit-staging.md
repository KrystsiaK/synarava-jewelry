# SKU catalog audit — staging (Этап 5)

**Plan:** [`docs/proposals/portable-sku-service.md`](../proposals/portable-sku-service.md) § Этап 5  
**ADR:** [`docs/adr/0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)  
**Railway n8n guide:** [docs.railway.com/guides/n8n](https://docs.railway.com/guides/n8n)  
**n8n static data:** [docs.n8n.io — getWorkflowStaticData](https://docs.n8n.io/code/cookbook/builtin/get-workflow-static-data/)

Read-only catalog audit against the sku-api ledger. No SKU creation. No ledger ownership by the workflow. LLM off. **Staging only** — do not configure production n8n.

## Slice A (API + CLI) — shipped

| Piece | Path |
| --- | --- |
| Compare + digest + notify flag | `services/sku-api/src/audit/catalog-audit.ts` |
| HTTP | `POST /v1/workspaces/{key}/audit/catalog` |
| Contract / client | `packages/sku-contract` `catalogAudit*` + `createSkuClient().auditCatalog` |
| Dry-run CLI | `pnpm --filter @synarava/sku-api audit:catalog` |
| Fixture | `services/sku-api/fixtures/catalog-audit-sample.json` |

## Slice B (Railway staging n8n) — shipped in repo

| Piece | Path |
| --- | --- |
| IaC `n8n` + volume (staging guard) | [`.railway/railway.ts`](../../.railway/railway.ts) |
| Workflow JSON | [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json) |
| Workflow contract test | `lib/sku/__tests__/n8n-catalog-audit-workflow.test.ts` |

**Not in Slice B:** production n8n, recovery-queue workflow, `EXTERNAL_CHANGE_DETECTED` writes, merge to `main`.

## Request shape (Slice A)

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

## Dry-run CLI (Slice A)

```bash
SKU_API_URL=http://127.0.0.1:8787 \
SKU_API_TOKEN="$SKU_API_DEV_TOKEN" \
pnpm --filter @synarava/sku-api audit:catalog \
  -- --fixture ./fixtures/catalog-audit-sample.json \
  --checkpoint ./.sku-audit-checkpoint.json
```

Exit codes: `0` no new notify · `2` should notify · `1` transport/API error.

## Workflow behaviour (Slice B)

1. **Schedule** — cron `0 3 * * *` (daily 03:00 UTC).
2. **Load checkpoint** — `previousDigest` from n8n `$getWorkflowStaticData('global')` ([docs](https://docs.n8n.io/code/cookbook/builtin/get-workflow-static-data/)).
3. **Build payload** — parse `CATALOG_ITEMS_JSON` env (JSON array, max 100).
4. **POST** private `sku-api` → `/v1/workspaces/{SKU_API_WORKSPACE}/audit/catalog` with Header Auth Bearer.
5. **IF `shouldNotify`** → **Notify webhook** (`NOTIFY_WEBHOOK_URL`) with PII-free summary (counts, digest, deviation codes only).
6. **Save checkpoint** — always write `digest` back to static data (both branches). Notify failure leaves digest unsaved on the true branch until after successful notify (retry can alert again).

Static data persists only for **active** scheduled/production executions, not manual “Test workflow” runs.

---

## Kiryl — exact manual steps (staging)

Do these **only** in Railway project **`synarava-shop`** / environment **`staging`**. Never production.

### 0. Preconditions

- [ ] `sku-api` healthy in **synarava-shop / staging** (`GET /health` → ready).
- [ ] Slice A tip on staging includes `audit/catalog` (e.g. `c3f73b3`+).
- [ ] You have the plaintext **`SKU_API_TOKEN`** for staging (same token Synarava web uses). Do not paste it into git or n8n execution logs if avoidable.
- [ ] Local CLI linked: `railway link --project synarava-shop --environment staging`.

### 1. Apply IaC (creates/updates `n8n` + `n8n-data` volume)

```bash
cd /path/to/synarava-jewelry   # on tip that includes Slice B
pnpm install --frozen-lockfile
railway link --project synarava-shop --environment staging
railway config plan
# Expect: synarava-shop/staging; plan adds/updates service `n8n` + volume `n8n-data`.
# Abort if any unexpected destroy of synarava-web / sku-api / sku-postgres.
railway config apply
```

Image pin: `n8nio/n8n:2.44.1` (see `.railway/railway.ts`).

### 2. Dashboard — networking + sealed vars on service `n8n`

In Railway → **synarava-shop** → **staging** → service **`n8n`**:

1. **Settings → Networking → Generate Domain** (public editor URL).
2. Set / confirm variables (some are `preserve()` — enter once in Variables UI):

| Variable | Value |
| --- | --- |
| `N8N_EDITOR_BASE_URL` | `https://<n8n-public-domain>` |
| `WEBHOOK_URL` | `https://<n8n-public-domain>` |
| `N8N_BASIC_AUTH_USER` | staging operator username |
| `N8N_BASIC_AUTH_PASSWORD` | strong password (sealed) |
| `N8N_ENCRYPTION_KEY` | random ≥32 chars (sealed; **do not rotate casually**) |
| `SKU_API_TOKEN` | staging Bearer token (sealed) |
| `SKU_API_URL` | already `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}` from IaC |
| `SKU_API_WORKSPACE` | `synarava-shop` |
| `CATALOG_ITEMS_JSON` | JSON array (see step 3) |
| `NOTIFY_WEBHOOK_URL` | staging webhook (e.g. Slack incoming / webhook.site for first smoke) |

3. **Redeploy** `n8n` after setting domain + vars.
4. Open `https://<n8n-public-domain>` → finish **n8n owner account** setup (n8n 2.x user management). `N8N_BASIC_AUTH_*` may be ignored on 2.x; rely on the owner login + restrict who has the public URL.

### 3. Set `CATALOG_ITEMS_JSON`

Staging window only (≤100). Example (replace with real Shopify GIDs/SKUs from M2):

```json
[
  {"externalVariantId":"gid://shopify/ProductVariant/…","sku":"JW-NECK-001"},
  {"externalVariantId":"gid://shopify/ProductVariant/…","sku":""}
]
```

Paste as a **single-line** Railway env value (or minified JSON). Redeploy or “Update variables” as Railway requires.

### 4. Import workflow

1. n8n → **Workflows → Import from File**.
2. Choose repo file: `deploy/n8n/sku-catalog-audit.workflow.json`.
3. Create credential **Header Auth**:
   - Name: `sku-api Bearer (staging)`
   - Header name: `Authorization`
   - Header value: `Bearer <SKU_API_TOKEN>`
4. Open node **POST audit/catalog** → select that credential (placeholder id `SKU_API_BEARER` in JSON).
5. Confirm **Notify webhook** URL expression uses `$env.NOTIFY_WEBHOOK_URL`.
6. **Save** workflow. Do **not** activate yet.

### 5. First smoke (manual execute)

> Static data checkpoint does **not** persist on manual test runs. Use this only to prove HTTP + IF + notify path.

1. Ensure `NOTIFY_WEBHOOK_URL` points at a catcher you can see.
2. Set `CATALOG_ITEMS_JSON` so the first audit has a known deviation (e.g. wrong SKU) → expect `shouldNotify: true` and a webhook POST.
3. Fix items / digest path: second **API** call with same `previousDigest` must return `shouldNotify: false` (use CLI or curl against sku-api).
4. Confirm **Settings → Assignments** in Synarava Admin did not change (audit is read-only).

### 6. Activate schedule

1. In n8n, **Activate** the workflow (toggle On).
2. Wait for a scheduled run **or** use “Execute workflow” only for connectivity; rely on the next **active** cron for real checkpoint persistence.
3. After one successful active run with deviations: webhook fires once.
4. Leave catalog unchanged → next active run: **no** webhook (`shouldNotify: false`).

### 7. Pass criteria (Kiryl)

| Check | Expected |
| --- | --- |
| Railway `n8n` in synarava-shop/staging | Running; volume mounted at `/home/node/.n8n` |
| Workflow active | Cron `0 3 * * *` UTC |
| Notify | Only when audit `shouldNotify: true` |
| Checkpoint | Identical active re-run does not notify again |
| Ledger | No new SKUs / assignment mutations from the workflow |
| Scope | No production n8n; PR #148 still open / no main merge |

### Rollback

1. Deactivate the workflow in n8n (or delete it).
2. Optional: Railway → stop/delete service `n8n` (volume retained until deleted).
3. sku-api assign path keeps working — n8n is not on the critical SKU issue path ([ADR-0004](../adr/0004-portable-sku-service-boundary.md)).

---

## Ops notes

- Secrets must not appear in n8n execution logs; avoid logging `Authorization` or full `CATALOG_ITEMS_JSON` in Code nodes.
- LLM nodes must stay **off** for this workflow.
- Production n8n / production Railway environment is **out of scope** until Этап 6.
