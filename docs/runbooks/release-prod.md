# Release production — staging → main (one page)

**Ship rule:** finished work lands on `staging`, then promote via ready PR **staging→main**. Canonical steps: [`ship-to-main`](../../.agents/skills/ship-to-main/SKILL.md). This page is the **production cutover checklist** only — env setup lives in [`deploy.md`](deploy.md); ADR-0009 cutover detail in [`derive-synarava-state-release.md`](derive-synarava-state-release.md).

Scripts/docs here do **not** run by themselves. Never paste secrets into chat.

---

## 1. Preconditions

- [ ] `origin/staging` tip is the intended release; CI green on staging.
- [ ] Staging smoke: `/api/health` → `ok: true` + expected revision; admin login works.
- [ ] No open `QUEUED`/`RUNNING` reconcile on **staging** (optional rehearsal of [`prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql)).
- [ ] Staging→main PR opened as **ready** (not draft); prefer merge commit.
- [ ] Required GitHub checks green on that PR. **Do not merge** if Quality Gates fail.

## 2. Backup

- [ ] Railway → production Postgres → Backups → **manual backup** (or confirmed PITR restore point) **before** merge when the release includes migrations or risky config.
- [ ] Note backup id/time in the release ticket (no connection strings).

## 3. Which PRs / commits have migrations?

From a laptop (no secrets):

```bash
git fetch origin main staging
git log --oneline origin/main..origin/staging -- prisma/migrations
git diff --name-only origin/main...origin/staging -- prisma/migrations
```

- [ ] List every new folder under `prisma/migrations/` that will apply on production `preDeployCommand` (`pnpm prisma:deploy`).
- [ ] For each migration SQL: note **additive** vs **DROP/RENAME column or table**.
- [ ] Special cutovers (EN archive, ADR-0009 derive): follow their dedicated runbooks **before** generic promote.

## 4. Drain / low traffic (when migration drops or renames)

If any pending migration **drops or renames** columns/tables (or rebuilds large indexes):

- [ ] Announce a short window; pause agent/scripts that write production DB.
- [ ] Prefer low-traffic: stop background workers if any; avoid admin Pull/Apply/Save and Shopify catalog edits during `preDeploy`.
- [ ] ADR-0009-class cutovers: stop app/workers/webhooks per [`derive-synarava-state-release.md`](derive-synarava-state-release.md) — do not rely on “hope no writers”.

Additive-only migrations (new tables/indexes/columns with defaults) usually do not need a full drain; still take a backup.

## 5. Promote

- [ ] Merge staging→main when checks are green (auto-merge OK).
- [ ] Watch Railway **production** deploy for `synarava-shop-app` (build + `pnpm prisma:deploy` + start).
- [ ] Confirm deploy commit SHA matches the merge on `main` (see pitfall below).

## 6. Verify

- [ ] `GET /api/health` → `200`, `ok: true`, revision = merged SHA.
- [ ] Admin: top-bar Shopify check (Manual) completes; store binding matches expected shop.
- [ ] One controlled **Apply** (or Pull) on a non-critical product; confirm no surprise wipe.
- [ ] Optional: paste [`prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql) sections in Railway Data tab (SELECT only).

## 7. Rollback

| Failure | Action |
|---|---|
| Deploy unhealthy, **no** migration applied | Redeploy previous **successful** deployment (see pitfall); or revert commit on `main` and redeploy that SHA. |
| Migration applied, data wrong | Restore verified **pre-merge** backup into a new service / owned restore path — see [`database-incident-recovery.md`](database-incident-recovery.md). Archive SQL helpers only inside their documented windows. |
| ADR-0009 / EN archives still present | Prefer backup; archive rollbacks only if still in safety window ([`derive-synarava-state-release.md`](derive-synarava-state-release.md)). |

## 8. Pitfall — Railway “Redeploy” rebuilds the **last deployment’s commit**, not “newest on branch”

Railway **Redeploy** on an old successful deployment rebuilds **that deployment’s commit**, not the tip of `main`/`staging`. After a bad deploy, “Redeploy” on the previous card is correct for rollback; “Redeploy” on a stale card will **not** pick up newer commits.

Before and after promote, list deployments and check `meta.commitHash` / status:

```bash
railway deployment list --json
```

- [ ] Identify the deployment whose commit equals the staging→main merge SHA; that one must be `SUCCESS`.
- [ ] For rollback, redeploy the prior `SUCCESS` deployment explicitly — do not assume “Redeploy” means “latest git”.
- [ ] To ship a new commit: push/merge so Railway builds from the service’s watch branch, or deploy that commit — do not reuse Redeploy on an unrelated old deployment.

---

## After cutover (later)

Archive table drops: [`post-cutover-cleanup.md`](post-cutover-cleanup.md) + commented [`drop-archives.sql.commented`](../../scripts/db/drop-archives.sql.commented) — waiting period + fresh backup only.
