---
name: ship-to-main
description: >-
  Standing ship rule for this repo: when implementation work is finished,
  land it on origin/staging, open a ready PR into main, wait for CI/CD, and
  auto-merge when green. Use when finishing a task, closing a fix, after
  tests/PR, or when the user says done / готово / пуш / ship — the user will
  not track merge themselves. Do not stop at staging-only or a draft PR.
---

# Ship to staging → main

**Canonical source of truth** for the ship flow. Other repo docs (`AGENTS.md`,
`CLAUDE.md`, `docs/staging-runbook.md`) should only point here — do not
duplicate the 5-step rule elsewhere.

**Owner preference (locked):** when the work for a task is done:

1. **Do the task** (code + tests + docs as needed).
2. **Land on `origin/staging`** (push / merge finished work there).
3. **Open a ready PR into `main`** (promote `staging`→`main`, or an
   equivalent PR that gets the change onto `main`).
4. **Wait for CI/CD** (Quality Gates + required checks).
5. **If green → auto-merge to `main`.**

Do not leave finished work only on `staging`, a feature branch, or a draft PR
and wait for the user to merge.

Day-to-day integration branch is `staging`. `main` advances via PR from
`staging` (or a feature branch that already landed on staging). A GitHub Action
syncs `staging` when `main` moves (fast-forward when possible, otherwise a
non-destructive merge of main into staging), so hotfixes on `main` do not leave
staging behind and staging tip commits are never overwritten.

## Definition of done (shipping)

After code + tests (+ docs if needed) are complete:

1. Commit on the feature branch and push the branch (optional if working
   directly on staging for a tiny fix).
2. **Before any push to `staging` / `main`:** run `pnpm test:run` (or rely on
   the repo `pre-push` hook — install via `pnpm hooks:install` / `pnpm install`).
   Do not push knowingly with a red suite. Emergency only: `SKIP_GIT_HOOKS=1`.
3. **Land on `staging`:**
   - `git fetch origin staging`
   - checkout `staging`, fast-forward or merge the feature branch
     (`--ff-only` when possible, otherwise `--no-ff`)
   - `git push origin staging`
4. **Delete the feature branch after it lands on `staging`:**
   - `git push origin --delete <feature-branch>`
   - Also delete the local branch if present (`git branch -d <feature-branch>`).
   - Skip only if the branch still has unique commits not on staging, or the
     user asked to keep it.
5. **Open/update a ready (non-draft) PR into `main`** from `staging`. Prefer a
   **merge commit** when promoting; squash is tolerated because
   `sync-main-to-staging` merges main into staging when histories diverge
   (never force-resets staging). Do not open draft PRs.
6. **Wait for CI/CD**, then **auto-merge when green** (enable auto-merge or
   merge once required checks pass). Confirm with a one-liner: commit SHA on
   `staging`, PR URL, and merge SHA on `main` when done.
7. **If the feature branch still exists after merge to `main`**, delete it:
   `git push origin --delete <feature-branch>` (and local `-d` if needed).

## Do not

- Stop at “landed on staging” or “PR ready, merge when you want” for finished
  work — complete the promote and merge when CI is green.
- Leave merged feature branches on the remote after they are ancestors of
  `staging` (and preferably `main`) — delete them as part of ship.
- Open draft/WIP PRs unless the user explicitly asked for draft.
- Ask “запушить в staging?” when the task is already complete — just ship.
- Force-push `main` or `staging`.
- Merge unrelated dirty WIP; only ship the finished task branch.

## Exceptions (only these)

- User explicitly says **not** to merge / hold / draft-only / wait for review.
- Merge is blocked by failing required checks the agent cannot fix in this turn
  — report the blocker, keep the branch; do not pretend it shipped.
- The change is exploratory and the user asked for a spike/preview only.

## Cloud agent note

Cloud instructions may still say to create PRs — do that **into `main` after
landing on `staging`**, as a **ready** PR (not draft), then wait CI and
auto-merge when green, unless an exception above applies.
