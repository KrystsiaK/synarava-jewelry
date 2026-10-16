# Portable SKU — current status and agent handoff

**Status:** Stage 5 complete; Stage 6 infrastructure and controlled Shopify SKU pilot passed; guarded legacy-backfill fix is implemented locally and production n8n remains unpublished  
**Last updated:** 2026-10-17 (Europe/Lisbon)  
**Current repository baseline:** PR #181 merged the live-Shopify audit into `staging`; PR #182 promoted it to protected `main` at merge commit `325f0c21`  
**Canonical scope:** Kiryl approved and ran the guarded production apply; workflow import/activation remains blocked until infrastructure is healthy

This is the single continuation point for a new agent. Read it before taking any
Portable SKU, Railway, Shopify, or n8n action. Update it after every confirmed
manual or automated step. Do not turn reported or assumed state into a fact
without evidence.

## Safety boundary

- Do not modify `main`, production Railway, production n8n, or the production
  Shopify store without Kiryl's explicit confirmation immediately before the
  production action.
- Do not run `railway config apply` merely because a plan exists. First verify
  the linked project and environment, inspect the complete plan, and stop if it
  creates, deletes, replaces, or unexpectedly changes an existing SKU resource.
- Never recreate or delete `sku-api`, `sku-postgres`, their data volume, or an
  existing n8n volume as part of adoption.
- Never record tokens, credentials, passwords, webhook secrets, or private
  payloads in this file.
- The code/PR bot owns repository changes, tests, PRs, and deploy code. Kiryl
  performs or explicitly authorizes manual external-service configuration.

## Confirmed implementation state

### Portable SKU stages 1–4

- `sku-api` and `sku-postgres` exist in Railway project
  `portable-sku-platform` (`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`).
- Shopify staging is connected and the Synarava Sync app is installed.
- M2 linked flow passed manually: empty Shopify SKU -> Pull into Synarava ->
  assign SKU -> write back to Shopify.
- M2 evidence row: Shopify variant
  `gid://shopify/ProductVariant/58824796668235` -> `JW-NECK-001`.
- The detailed manual/automated scenario record remains in
  [`portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md).

### Stage 5 — staging n8n catalog audit

- Workflow source:
  [`deploy/n8n/sku-catalog-audit.workflow.json`](../../deploy/n8n/sku-catalog-audit.workflow.json).
- The workflow is read-only: it compares catalog rows with the SKU ledger. The
  replacement now in development loads a complete live Shopify snapshot through
  a protected Synarava endpoint instead of a hand-maintained Railway variable.
  It does not allocate, confirm, edit, or delete SKU assignments.
- Staging n8n, its Postgres database, and a persistent volume were created and
  reached Online state.
- The workflow was imported and connected to a staging Header Auth credential.
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` was required because n8n 2 blocks `$env`
  access by default.
- The private SKU URL required an explicit port:
  `http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080`.
- Stage 5 smoke passed:
  - the first active scheduled run produced a webhook notification;
  - subsequent scheduled runs completed successfully without a duplicate
    notification;
  - this verifies checkpoint persistence and `shouldNotify: false` for an
    unchanged digest.
- PR #167 was merged into `staging` as `6451f63c`; it records both runtime/IaC
  fixes and the Stage 5 smoke evidence.
- No post-#167 Railway IaC apply has been confirmed in this handoff.

## Current external configuration — verify before relying on it

The following values may have changed in the UI and are not considered current
facts until rechecked:

| Item | Last known state | Required final staging state |
| --- | --- | --- |
| n8n schedule | Confirmed in the published workflow UI as `0 3 * * *` | `0 3 * * *` UTC |
| Catalog source | Staging still has the earlier static row until the replacement workflow is deployed | Protected Synarava endpoint paginates live Shopify; no hand-maintained catalog JSON |
| Notification destination | Confirmed Telegram channel `Synarava Ops`; webhook.site node removed | Keep an explicit `STAGING` environment label and the SKU-specific message format |
| n8n service name/identity | Confirmed target: service ID `ed65c7d3-29aa-4844-8c7f-fc7b0e7b1348`, reconciled UI/IaC name `n8n`; similarly named legacy services also exist | Always target the exact ID; do not modify another service by name guessing |
| Workflow published version | Published and active with daily `0 3 * * *` UTC schedule | Keep the daily schedule |

## Repository and PR state

- Local `staging` was clean at `6451f63c` when this handoff was created.
- PR #167: merged to `staging`.
- PR #169: merged into `staging` as `a8f1b4be`.
- PR #148: merged the complete `staging` history into `main` as `2e4e0dad`;
  GitHub comparison confirms `main` and `staging` are identical.
- Production Railway was not mutated by the repository merge.

## New requirement: Synarava Ops Event Hub

Kiryl decided that operational events from future workflows should use a shared
notification/history foundation. This is a requirement and architecture task,
not completed implementation.

- The SKU catalog audit is currently the only new business workflow in this
  staging initiative.
- A canonical append-only operational event store should retain full history.
  Do not use n8n's internal database as the business event source of truth.
- Telegram is the immediate action channel.
- One shared private Telegram channel `Synarava Ops` has been created for both
  staging and production events; every message must include a prominent
  environment label. Environment isolation remains in credentials/configuration,
  not in separate channels.
- Telegram bot `@synarava_ops_bot` (`Synarava Ops Bot`) has been created. Its
  token must remain only in secret storage and must never be copied into docs.
- `@synarava_ops_bot` has been added to `Synarava Ops` as an administrator with
  only the `Post Messages` permission.
- Staging n8n credential `Telegram — Synarava Ops` was created and its
  connection test succeeded. The bot token remains outside repository docs.
- Private channel `Synarava Ops` resolved to Telegram chat ID
  `-1003549835881` through an n8n `On channel post` test event.
- A staging n8n `Send Message` test successfully posted to `Synarava Ops`,
  confirming the credential, chat ID, and bot permission.
- The published staging SKU workflow now uses `Notify Telegram · SKU` on the
  `shouldNotify?` true branch and then saves the checkpoint. The temporary
  webhook.site node was removed. Published version:
  `Staging · SKU audit notifications via Telegram`.
- Notion is a projection for incidents, decisions, and periodic reports.
- Google Sheets is a projection for structured exports, metrics, and analysis.
- Future message categories must be visually distinct while sharing a common
  event contract: ERROR, ORDER, SKU, ANALYTICS, and RECOVERY.
- Staging and production destinations and credentials must be isolated.
- No tokens, secrets, or unnecessary PII may be emitted to any projection.
- A docs-first ADR/event contract/routing plan is still pending unless a newer
  PR explicitly contains and verifies it.

## Stage 6 — confirmed production inventory

Kiryl approved starting Stage 6. Read-only Railway inspection confirmed:

- Environment `production` has ID `d8cb7dd8-5c26-4255-a8c5-7795f1993de6` in
  the same guarded project `portable-sku-platform`.
- Existing n8n service `sku-platform-n8n` has exact service ID
  `04d32fed-eae9-4219-8ebb-cc6cbc403c37`, a successful deployment, public
  domain `sku-platform-n8n-production.up.railway.app`, and image
  `n8nio/n8n:2.42.7`.
- Existing n8n Postgres service `sku-platform-n8n-postgres` has service ID
  `e7f8a122-dfb5-498e-8002-23fb0f50e3ca` and a successful deployment.
- Existing persistent resources are `sku-platform-n8n-volume` mounted at
  `/home/node/.n8n` and `postgres-volume` mounted at
  `/var/lib/postgresql/data`; both reported Ready.
- Production currently has no `sku-api` and no `sku-postgres`.
- Production n8n already has its database, encryption, host, webhook, and
  timezone variable contracts. Values were intentionally not recorded.
- The committed `.railway/railway.ts` is staging-only and explicitly refuses
  production. It must not be planned or applied against production as-is.

## Exact next step

Keep the production n8n workflow unpublished. Review and ship branch
`codex/legacy-sku-backfill` through `staging` and protected `main`. After the
production sku-api deploy succeeds, run the new `/legacy-backfill` endpoint in
`dry-run` mode against the same complete 50-item Shopify snapshot. Require
`createCount: 49`, `existingCount: 1`, and `conflictCount: 0`; do not apply
until Kiryl explicitly approves that exact digest and plan.

## Stage 5 closure criteria

Stage 5 is fully closed only when all are evidenced:

- [x] First active scheduled run notified.
- [x] Unchanged active rerun completed silently.
- [x] Audit caused no SKU/assignment mutation.
- [x] IaC fixes are merged to `staging`.
- [x] Published cron visibly confirmed as `0 3 * * *` UTC.
- [x] Real M2 `CATALOG_ITEMS_JSON` confirmed on the exact staging n8n service.
- [x] Safe post-merge Railway plan reviewed.
- [x] Approved apply completed without resource replacement or production impact.
- [x] Final published workflow execution on the real M2 row completed successfully (Kiryl-confirmed).
- [x] Runbook, matrix, proposal, and this handoff agree with the observed state via merged PR #168.

## Update protocol for every agent

After each step:

1. Update **Last updated**.
2. Move only evidenced statements from "verify" into "confirmed".
3. Check or uncheck the relevant closure criterion.
4. Replace **Exact next step** with the next single safe action.
5. Add a short entry to the log below.
6. If a production action is next, stop and request Kiryl's explicit approval.

## Update log

| Date (Europe/Lisbon) | Actor | Evidence / change | Next action |
| --- | --- | --- | --- |
| 2026-10-17 | Kiryl + Codex | Production manual audit read 50 live Shopify variants and returned 49 deviations. Sampled deviation objects all have `MISSING_ASSIGNMENT`, a non-empty Shopify `observedSku`, and null ledger fields. This confirms the audit is reading Shopify correctly and the pre-existing catalog was never backfilled into the new SKU ledger. Production n8n remains unpublished. | Build and review an idempotent one-time ledger backfill; do not publish or rerun the workflow yet. |
| 2026-10-17 | Kiryl | Reconfirmed the legacy cutover invariant: every SKU already present in Shopify is preserved verbatim and recorded as an immutable exception; it is never reprocessed by the new policy. Only newly created SKUs use the allocator. | Verify and correct the importer against this invariant before any production backfill. |
| 2026-10-17 | Codex | TDD exposed and fixed two violations: the importer rejected unparseable legacy SKU values through policy v1, and the audit still emitted `INVALID_FORMAT` after import. Branch `codex/legacy-sku-backfill` now preserves legacy values verbatim, exempts matching `LEGACY_V0` assignments from policy-format deviations, and provides an authenticated digest-gated `/legacy-backfill` dry-run/apply endpoint. Focused suites pass: sku-api 41/41 and contract 7/7; production was not mutated. | Ship through PRs, deploy sku-api, then review the expected 49-create/1-existing/0-conflict dry-run before any apply. |
| 2026-10-15 | Codex + Kiryl | Created a single cross-agent continuation point from repository docs and confirmed Stage 5 screenshots. No Railway mutation performed. | Reconcile live staging state read-only before plan/apply. |
| 2026-10-15 | Codex | Railway read-only status confirmed project `portable-sku-platform` (`6d7d5885-…`), environment `staging` (`b8f61740-…`), and active target n8n service ID `ed65c7d3-…` with successful deployment and `n8n-data-v2`. Other similarly named services exist, so name-only selection is unsafe. | Inspect safe runtime variables on the exact service ID. |
| 2026-10-15 | Codex | Read-only variable check confirmed `SKU_API_URL=:8080`, env access enabled, workspace `synarava-shop`, token present, but catalog still uses `n8n-smoke` and notification still uses webhook.site. No secret value was printed. | Replace the synthetic catalog row with the real M2 row. |
| 2026-10-15 | Codex | Replaced only `CATALOG_ITEMS_JSON` on staging n8n service ID `ed65c7d3-…` with the real M2 variant/SKU. Railway redeploy finished `SUCCESS` at 14:17 Lisbon time (13:17 UTC). | Confirm the published n8n cron is back to daily 03:00 UTC. |
| 2026-10-15 | Codex | Visually opened the published Schedule Trigger in n8n and confirmed the exact expression `0 3 * * *`; the workflow is published and active. | Run and inspect the post-merge Railway plan for staging. |
| 2026-10-15 | Codex | Post-merge Railway plan targeted the correct project/environment but was rejected as unsafe: it proposed setting `sku-api.PORT` and creating a new `n8n` service because the working service had been manually renamed `Sku-platform-n8n`. Nothing was applied. | Reconcile the existing service identity/name, then rerun plan. |
| 2026-10-15 | Codex | Renamed only working staging service ID `ed65c7d3-…` back to IaC name `n8n`. Replanned: `0 add, 2 change, 0 destroy`; only `sku-api.PORT=8080` and n8n `SKU_API_URL` were managed. Applied successfully with no resource creation, deletion, replacement, or production action. | Wait for successful deploys, then run the final real-M2 workflow verification. |
| 2026-10-15 | Codex | Post-apply deployments for both exact staging targets reached `SUCCESS`: `sku-api` service ID `3575767f-…` and n8n service ID `ed65c7d3-…`. | Run the published workflow once with the real M2 catalog row and inspect the execution. |
| 2026-10-15 | Kiryl | Confirmed the final published workflow execution completed successfully on staging after the safe IaC apply. | Reconcile Stage 5 documentation; production remains blocked pending explicit approval. |
| 2026-10-15 | Kiryl | Created the shared private Telegram channel `Synarava Ops`. It will receive both staging and production events with explicit environment labels. | Create the posting bot and add it to the channel. |
| 2026-10-15 | Kiryl | Created `Synarava Ops Bot` as `@synarava_ops_bot`; its token was not recorded in repository docs. | Add the bot to `Synarava Ops` as an administrator allowed to post. |
| 2026-10-15 | Kiryl | Added `@synarava_ops_bot` to `Synarava Ops` as an administrator with only `Post Messages` enabled. | Create the Telegram API credential in staging n8n. |
| 2026-10-15 | Kiryl | Created the staging n8n Telegram API credential; n8n reported `Connection tested successfully`. | Capture the private channel chat ID via a Telegram Trigger test event. |
| 2026-10-15 | Kiryl | Captured `Synarava Ops` chat ID `-1003549835881` from a Telegram `channel_post` event without exposing the bot token or using a third-party bot. | Send one staging connection message from n8n to the channel. |
| 2026-10-15 | Kiryl | Successfully sent the staging connection message from n8n to `Synarava Ops`; credential, chat ID, and post-only bot access work. | Replace the SKU workflow's temporary webhook node with the Telegram notification node. |
| 2026-10-15 | Codex | In live staging n8n, removed the temporary webhook.site node, inserted `Notify Telegram · SKU` between the true branch and `Save checkpoint (after notify)`, configured the shared Ops channel and staging message format, and published `Staging · SKU audit notifications via Telegram`. Production was untouched. | Sync the repository workflow JSON and Stage 5 docs through the code/PR bot before production rollout. |
| 2026-10-15 | Code bot | PR #168 updates the workflow JSON and Stage 5 docs to Telegram, contains no secrets, and passed CI 8/8. It remains open; Railway, `main`, and production were untouched. | Merge PR #168 into `staging` only. |
| 2026-10-15 | Codex | Fetched `origin/staging` and verified merge commit `5864486c` (`Merge pull request #168`). Stage 5 live workflow and repository source are synchronized. No production action was taken. | Obtain explicit approval before starting Stage 6 production inventory/planning. |
| 2026-10-15 | Kiryl + Codex | Kiryl approved starting Stage 6. Read-only inventory found existing production n8n/Postgres/volumes but no production SKU API/database. The current IaC is staging-only, so no production plan/apply/import was attempted. | Prepare and review a production-safe IaC/adoption/runbook PR. |
| 2026-10-15 | Code bot + Codex | Draft PR #169 (`8afc58bd`) prepared Stage 6 guards/runbook and reported green CI. Read-only review found blockers: IaC names the existing volume `sku-platform-n8n-data` instead of live `sku-platform-n8n-volume`, pins production n8n to `2.44.1` instead of live `2.42.7`, and the plan gate can pass an unrecognised/empty plan. No plan or production mutation was run. | Fix those three blockers in PR #169 and rerun CI. |
| 2026-10-15 | Code bot + Codex | PR #169 commit `96005cc0` fixed the exact live volume name, split staging/production n8n image pins (`2.44.1`/`2.42.7`), and added a fail-closed production plan checker; both GitHub workflows passed. Read-only production adoption check then confirmed the exact project/environment, existing n8n/Postgres/two volumes, absence of sku-api/sku-postgres, and no named partial ownership. Local Railway link now targets production service ID `04d32fed-…`; no plan/apply/import ran. | Merge PR #169 to staging only, then run and inspect the production plan gate. |
| 2026-10-15 | Codex | Updated PR #169 directly in commit `3633adaf`: production sku-api now sources protected `main`, and plan-check hard-blocks until `origin/main` contains the complete current `origin/staging` history via PR #148. Targeted tests passed 25/25; full local suite passed 1990/1996 with only six DB integration failures caused by unavailable `DATABASE_URL`. No secret was read; GitHub CI is the authoritative clean-environment check. No merge/plan/apply/import occurred. | Wait for CI, then merge #169→staging and #148 staging→main through GitHub. |
| 2026-10-15 | Kiryl + Codex | PR #169 was merged into `staging` as `a8f1b4be`. PR #148 automatically updated to that exact staging tip and is mergeable; its fresh `CI` and `CI SKU` runs are in progress. Production and Railway remain untouched. | Wait for PR #148 CI; if green, merge #148 to `main` through GitHub. |
| 2026-10-15 | Kiryl + Codex | Both required checks passed and PR #148 merged `staging` into protected `main` as `2e4e0dad`. GitHub comparison reports `main` and `staging` identical, so the production ancestry gate is satisfied. Railway production remains untouched. | Run the guarded production plan and stop before apply for review. |
| 2026-10-15 | Codex | The first guarded production plan failed closed. Railway's current JSON format was not recognized; safe inspection also revealed a forbidden 5000→1024 MB n8n-volume shrink and deletion of four existing runtime variables. Nothing was applied. PR #170 preserves the live volume/runtime state and teaches the gate to parse `changeSet.changes` and reject destructive/structural updates. With these local fixes, the repeated plan gate passed: only `sku-postgres` and `sku-api` are created, plus allowed n8n variable wiring. | Wait for PR #170 CI, merge to staging, then promote staging to main before rerunning the production plan. |
| 2026-10-15 | Kiryl + Codex | PR #170 merged to `staging`; PR #171 then promoted the complete history to protected `main` as `06e3c02e`. GitHub confirms `main` and `staging` are identical. Railway production remains untouched. | Rerun the guarded production plan from protected main and stop before apply. |
| 2026-10-15 | Codex | Final guarded production plan ran against the verified production project/environment after `main` promotion and passed: creates only `sku-postgres` and `sku-api`; seven allowed n8n variable updates; no structural n8n/database/volume mutation. No apply was run. | Obtain explicit `apply` confirmation, then apply and verify deployments. |
| 2026-10-15 | Kiryl + Codex | Kiryl explicitly authorized `apply`. The reviewed production plan applied successfully: `sku-postgres` and its volume were created, `sku-api` was created, and existing n8n resources were adopted without replacement. Postgres deployment succeeded. `sku-api` built and migrated successfully but failed Railway health checks because it started with `ready=false`; runtime evidence shows the database is reachable and the missing `SKU_API_CREDENTIALS` is the readiness blocker. No production workflow was imported or activated. | Kiryl enters a fresh production credential pair in Railway, then redeploy and verify health. |
| 2026-10-15 | Kiryl + Codex | Kiryl added the production credential pair and redeployed. Railway now reports `sku-api` deployment `884f32ae-…` as `SUCCESS`; production `sku-postgres` and `sku-platform-n8n` are also `SUCCESS`, and both persistent volumes remain Ready. | Import and configure the production workflow in n8n, leaving it inactive until a controlled manual run passes. |
| 2026-10-15 | Kiryl | Imported the production workflow, configured SKU Header Auth and the Synarava Ops Telegram credential, and completed the first manual run. Telegram received `🔴 PRODUCTION · SKU AUDIT` with one deviation, one item, digest, correlation ID, and the production admin link. The input is still a temporary placeholder row, so this proves transport/integration but not the real Shopify pilot. | Rerun unchanged to prove silent checkpoint behavior, then replace the placeholder with a real production draft variant. |
| 2026-10-15 | Kiryl + Codex | Following the first Telegram link exposed that the workflow artifact uses the nonexistent `synarava-shop-app-production.up.railway.app` hostname. Read-only Railway inspection confirmed the live app domains, and `https://shop.synarava.com/admin/settings#shared-sku-policy` responds with the expected admin-login redirect when unauthenticated. | Correct the live Telegram message URL before further smoke/publish; sync the source artifact through PR afterward. |
| 2026-10-15 | Kiryl | Corrected the live Telegram URL and ran the workflow manually again. A second notification arrived with the same digest and the corrected working link. This is expected for manual/test execution: n8n does not persist workflow static data in that mode, so silent checkpoint behavior must be verified through active executions. | Replace the placeholder catalog input with a real production draft variant before controlled activation. |
| 2026-10-15 | Kiryl | Wired production `synarava-shop-app` to production `sku-api` with the public API URL, plaintext service token, and workspace. After redeploy, the production SKU policy page loads from the API and shows published profile v1 with Profile/Assignments/Audit tabs. | Select one production Shopify Draft variant for the controlled pilot; do not republish the unchanged policy profile. |
| 2026-10-15 | Kiryl + Codex | Production pilot preparation exposed a missing product requirement: the current product editor chooses `familyKey` manually from `Families JSON`; Shopify collection membership does not determine it. Kiryl confirmed that collection-driven family selection is required. Production n8n remains unpublished/inactive. | Implement deterministic mapped-collection → SKU-family resolution, verify on staging, then resume the production pilot. |
| 2026-10-15 | Kiryl | Chose to retain explicit manual family selection. Added/published the eyeglass accessory family and completed the controlled production Draft-product flow: Synarava assigned `EY-ACC-001`, and the same SKU is visible in Shopify. Production n8n remains unpublished/inactive. | Capture the pilot variant GID and replace the n8n placeholder catalog row. |
| 2026-10-16 | Codex | Began `codex/shopify-live-sku-audit`: removed the hand-maintained catalog input from workflow sources; added an authenticated Synarava endpoint that paginates live Shopify variants; added a shared complete-snapshot contract and raised the bounded audit limit to 5,000; updated staging/production workflow artifacts and canonical production Telegram URL. IaC preserves the now-unused legacy variable only to avoid deleting runtime state during an unrelated apply. Production was not changed and its n8n workflow remains inactive. Focused web/workflow/contract tests pass; final suite/PR still pending. | Finish full verification and documentation, then ship through staging → protected main before any live n8n update. |
| 2026-10-16 | Codex | PR #181 merged the verified live-Shopify catalog source into `staging`; all GitHub and staging Railway checks passed. PR #182 then promoted the complete staging history to protected `main` as merge commit `325f0c21`. Production `sku-api` deployment started automatically; production n8n remains inactive and unchanged. | Wait for the production deploy to succeed, then update/import the production workflow and perform one inactive manual run. |

## Supporting documents

- Overall proposal: [`portable-sku-service.md`](../proposals/portable-sku-service.md)
- Architecture boundary: [`0004-portable-sku-service-boundary.md`](../adr/0004-portable-sku-service-boundary.md)
- Staging matrix: [`portable-sku-staging-matrix.md`](../testing/portable-sku-staging-matrix.md)
- Stage 5 runbook: [`sku-catalog-audit-staging.md`](sku-catalog-audit-staging.md)
- Railway adoption runbook: [`portable-sku-platform-railway.md`](portable-sku-platform-railway.md)

