# Railway Infrastructure as Code

Canonical docs: [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code) · [Reference](https://docs.railway.com/infrastructure-as-code/reference)

| File | Role |
| --- | --- |
| `.railway/railway.ts` | Named partial `sku` — `sku-api` + `sku-postgres` |
| `deploy/railway.synarava-web.json` | Legacy Config as Code for **synarava-web only** (until full IaC migration) |

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

## synarava-web (must not break)

The SKU partial intentionally refuses to run in the separate `handsome-commitment`
project: Railway private networking and service-reference variables are scoped to
one project/environment. Apply it only to `synarava-shop/staging`.

After this change, set the web service **Config File** to:

`/deploy/railway.synarava-web.json`

Build/start remain: `pnpm build` · pre-deploy `pnpm prisma:deploy` · start `pnpm start` · health `/api/health` · builder `RAILPACK`.

SKU staging checklist: [`docs/runbooks/sku-api-railway-staging.md`](../docs/runbooks/sku-api-railway-staging.md)
