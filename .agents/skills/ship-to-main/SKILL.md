---
name: ship-to-main
description: >-
  Standing ship rule for this repo: when implementation work is finished,
  land it on origin/staging yourself, then open/update a PR into main.
  Use when finishing a task, closing a fix, after tests/PR, or when the user
  says done / готово / пуш / ship — the user will not track merge themselves.
  Do not stop at a draft PR and wait.
---

# Ship to staging → main

**Owner preference:** when the work for a task is done, **push it to
`staging`**, then **open (or update) a PR into `main`**. Do not leave finished
fixes only on a feature branch or draft PR and wait for the user to merge.

Day-to-day integration branch is `staging`. `main` advances via PR from
`staging` (or a feature branch that already landed on staging). A GitHub Action
fast-forwards `staging` when `main` moves, so hotfixes on `main` do not leave
staging behind.

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
3. **Open/update a PR into `main`** from `staging` (or the feature branch if it
   is already included on staging). Record association; do not leave shipping
   as “branch only.” **Merge with a merge commit — do not squash** (squash
   breaks `sync-main-to-staging` fast-forward).
4. Confirm with a one-liner: commit SHA is on `staging`, and the PR URL into
   `main` is ready (merge when required checks are green, unless an exception
   below applies).

## Do not

- Stop at “PR ready, merge when you want” for finished work without landing on
  `staging`.
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
landing on `staging`** when the task is finished, unless an exception above
applies.
