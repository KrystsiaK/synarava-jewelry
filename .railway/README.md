# Railway Infrastructure as Code

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Reference](https://docs.railway.com/infrastructure-as-code/reference) · [n8n on Railway](https://docs.railway.com/guides/n8n)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — `sku-api` + `sku-postgres` + staging `n8n` + `n8n-data` |
| `deploy/railway.synarava-web.json` | Legacy Config as Code for **synarava-web only** (until full IaC migration) |
| `deploy/n8n/sku-catalog-audit.workflow.json` | Этап 5 Slice B workflow (import into staging n8n) |

Config as Code is deprecated; new services cannot use it. Root `/railway.json` was removed so a new `sku-api` service no longer inherits Next.js `pnpm build` / `pnpm start`.

## Apply sku slice (staging)

```bash
# CLI: https://docs.railway.com/guides/cli
railway login
railway link --project synarava-shop --environment staging
pnpm install --frozen-lockfile
railway config plan
# Continue only when the plan targets synarava-shop/staging and shows no unexpected destroy.
railway config apply
```

The IaC guard **refuses** any project/environment other than `synarava-shop` / `staging` (no production apply).

Then set watch paths on `sku-api` in the dashboard (IaC DSL does not document watch patterns yet):

```
/services/sku-api/**
/packages/sku-core/**
/packages/sku-contract/**
/pnpm-lock.yaml
/pnpm-workspace.yaml
/package.json
/.railway/**
```

### n8n (Этап 5 Slice B)

After apply, finish public domain + sealed vars and import the workflow — exact steps:

[`docs/runbooks/sku-catalog-audit-staging.md`](../docs/runbooks/sku-catalog-audit-staging.md)

Pinned image: `n8nio/n8n:2.44.1`. Volume mount: `/home/node/.n8n`.

## synarava-web (must not break)

The SKU partial intentionally refuses to run in the separate `handsome-commitment`
project: Railway private networking and service-reference variables are scoped to
one project/environment. Apply it only to `synarava-shop/staging`.

After this change, set the web service **Config File** to:

`/deploy/railway.synarava-web.json`

Build/start remain: `pnpm build` · pre-deploy `pnpm prisma:deploy` · start `pnpm start` · health `/api/health` · builder `RAILPACK`.

SKU staging checklist: [`docs/runbooks/sku-api-railway-staging.md`](../docs/runbooks/sku-api-railway-staging.md)
