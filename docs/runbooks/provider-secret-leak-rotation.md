# Provider secret leak: rotation runbook

**Status:** proven on 2026-10-22 (Railway security incident). Update after every real use.
**Context:** Railway reported that encrypted environment variables may have been read and partly decrypted, and paused builds for everyone. Treat every variable stored at the provider as leaked. Nothing in this file contains secret values.

Related: [database-incident-recovery](database-incident-recovery.md) (data loss, a different failure) and the execution log in [production-database-safety-and-recovery](../proposals/production-database-safety-and-recovery.md).

## Principles

1. **Close doors first, rotate second.** Remove public access before changing passwords.
2. **Staging first, production second.** The same steps rehearsed on staging find the surprises (see Lessons).
3. **New value first, delete old last** whenever the provider allows two valid values at once.
4. **Secrets never go to chat, tickets or screenshots.** Hide values before taking a screenshot; if one leaks, rotate it again.
5. **Every new value goes to the password manager before it goes anywhere else**, with tags `rotated-YYYY-MM` and the incident name.
6. **Verify after each step**, not at the end.

## Phase 0: stop the bleeding (no downtime)

- Delete every provider API token (account, workspace, project tokens). Recreate only what is needed.
- Remove the **public TCP proxy** of every database (production, staging, helper projects). Services use the internal host. Local access later: `railway connect` or a temporary public access that is removed afterwards.
- Revoke secrets that are only used at build time (package registry token, error-tracker upload token, provider tokens in CI). Builds are paused anyway.
- Stop services that are not needed (stop the active deployment, do not delete the service or the volume).

## Phase 1: secrets issued by third parties

Generate a new value, store it, put it where it is used, deploy, verify, then revoke the old one.

| Secret | Where issued | Used in | Notes |
|---|---|---|---|
| Shopify app client secret | Dev Dashboard, per app | `SHOPIFY_CLIENT_SECRET` and `SHOPIFY_WEBHOOK_SECRET` (prod and staging each use their own app) | The old secret signs webhooks until it is revoked; after revoking, the app must have the new value or webhooks fail with 401. Compare the secret that is actually valid in the dashboard with the stored copy before debugging. |
| Shopify storefront private token | Headless channel, Storefront API | `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Create the new token, deploy, check products render, only then delete the old token. |
| GitHub package token | GitHub PAT (read:packages), one per place: local, CI, staging, production | `NODE_AUTH_TOKEN` (CI secret, Railway, local `~/.npmrc` via `scripts/ensure-github-packages-auth.mjs`, Cursor cloud secrets) | Regenerate keeps the permissions. Update CI first, it blocks every PR. |
| Error tracker auth token | Sentry organization token | `SENTRY_AUTH_TOKEN` | Create the new token before revoking the only existing one. |
| Object storage keys | Railway bucket, Credentials | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (references to the bucket variables update themselves) | Separate bucket per environment. |
| AI provider keys | Anthropic, OpenAI, Gemini consoles | Only where used (check the code first; unused variables are deleted) | Prepaid balance with auto-reload off cannot go negative. Check usage graphs. |
| Telegram bot token | BotFather `/revoke` | n8n credential | |

## Phase 2: secrets we generate ourselves

Generate locally and copy straight to the clipboard, so nothing is printed:

```bash
openssl rand -base64 48 | tr -d '\n' | pbcopy      # cookie/session secrets
openssl rand -hex 24 | tr -d '\n' | pbcopy         # database passwords (URL safe)
```

| Secret | Variable | Effect of rotation |
|---|---|---|
| Admin session cookie key | `ADMIN_SESSION_SECRET` | Everyone logged into the admin is logged out |
| Customer session key | `SHOPIFY_CUSTOMER_SESSION_SECRET` | Logged-in customers are logged out once |
| Admin password hash | `ADMIN_PASSWORD_HASH` | Generate with `node scripts/hash-password.mjs "$(pbpaste)" \| pbcopy` after copying the new password from the password manager. Do not copy anything else in between. |
| SKU API credentials | `SKU_API_CREDENTIALS` (sku-api) and `SKU_API_TOKEN` (app) | Generate the pair with `node services/sku-api/scripts/generate-credentials.mjs synarava-shop`. sku-api checks one credential per workspace, so there is a short window with 401 between the two deploys. Production and staging get different pairs. |

Use different values for production and staging. Remove variables the code no longer reads (checked with a repo-wide search before deleting).

## Phase 3: database passwords

A variable change alone does not change the database. Do both, in this order, and take a **manual backup first** for production:

1. Backup (Postgres service, Backups, New backup; wait until listed).
2. Query console: `ALTER USER postgres WITH PASSWORD '<new>'` (single quotes).
3. Postgres service variables: `POSTGRES_PASSWORD` = same value, deploy the database.
4. **Make every dependent service redeploy with the new value.** References are resolved at deploy time. A plain Restart does not re-read them, and a service built from a Docker image has no Redeploy: edit one of its variables (or re-save the reference) and press Deploy.
5. Verify the site, then Sentry for authentication errors in the window.

Other roles have their own passwords and are not touched by the step above:

- `mc_collector` (Mission Control collector): `ALTER ROLE mc_collector WITH PASSWORD '<new>'`, then replace the password inside `DATABASE_URL` of the collector service and deploy. The password is literal there.
- `agent_ro` (read-only role for agents): rotate in the database; keep the agent secret removed while there is no public access.
- SKU database and the n8n database (production and staging each): same four steps.

Expect a short window of authentication errors in the error tracker between step 2 and the redeploy. Resolve those issues once no new events appear.

## Phase 4: services with their own login

- n8n owner password and 2FA (store the recovery codes). Do **not** change `N8N_ENCRYPTION_KEY` without exporting credentials first: stored credentials become unreadable.
- Other projects in the same workspace: list their variables by name, apply the same phases (separate password manager vault per project).

## Phase 5: verify and look for traces

- Staging: site, admin login (new password), Translations check, image upload, SKU settings, test order with the test payment gateway, then a new row in `ShopifyWebhookDelivery`.
- Production: site, admin login, products render, image upload, webhook responses 200 in the logs (change a tag on a product and revert it), Mission Control green, collector runs finish in seconds.
- Review activity: provider activity log and members, Shopify staff and installed apps, GitHub security log, error tracker members, billing and usage of AI providers.
- Open a ticket with the provider (reason for the access limit, compensation).

## Password manager convention

One vault per project. Item title: `<Service>: <what> (<environment>)`. Fields: username, credential, hostname (internal where possible), valid from. Notes: how it was generated, every place it is applied, what breaks if it is wrong. Tags: service, environment, `secret`, `rotated-YYYY-MM`, incident name. Production and staging are separate items.

## Lessons from 2026-10-22

- Railway paused all builds, so rotation of runtime secrets had to wait; the cheap, safe ones (tokens used only at build time, closing public database access) were done at once.
- A Shopify app can show two client secrets. Revoking the wrong one, or keeping a stale copy, gives `Shopify token endpoint returned 400` and a stuck reconcile run. Always compare with the dashboard.
- Code behind a feature flag or a migration can look like a secret problem: a missing migration on staging produced "No published translation locale" errors. Check the database before blaming credentials.
- A Restart of a Docker-image service did not pick up a changed password reference; changing a variable and deploying did.
- Screenshots of the password manager can show values in clear text. Never share them.
- A cron worker that does not close its database client hangs for minutes and shows red runs; the fix is to disconnect and exit explicitly.
- Unused variables (`DEEPL_API_KEY`, `AUTH_SESSION_SECRET`) were still stored at the provider. Delete what the code does not read.

## Still open after the incident

Tracked in [tech-debt](../tech-debt.md) (`TD-OPS-*`).
