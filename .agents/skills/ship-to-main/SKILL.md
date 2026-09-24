---
name: ship-to-main
description: >-
  Standing ship rule for this repo: when implementation work is finished,
  always land it on origin/main yourself. Use when finishing a task, closing a
  fix, after tests/PR, or when the user says done / готово / пуш / ship — the
  user will not track merge themselves. Do not stop at a draft PR and wait.
---

# Ship to main

**Owner preference:** when the work for a task is done, **push it to `main`**.
Do not leave finished fixes only on a feature branch or draft PR and wait for
the user to merge.

## Definition of done (shipping)

After code + tests (+ docs if needed) are complete:

1. Commit on the feature branch and push the branch.
2. Open/update the PR if the environment expects one (record association).
3. **Immediately land on `main`:**
   - `git fetch origin main`
   - checkout `main`, fast-forward or merge the feature branch (`--ff-only` when possible, otherwise `--no-ff`)
   - `git push origin main`
4. Confirm with a one-liner: commit SHA is on `main` (and PR closed if still open).

## Do not

- Stop at “PR ready, merge when you want” for finished work.
- Ask “запушить в main?” when the task is already complete — just ship.
- Force-push `main`.
- Merge unrelated dirty WIP; only ship the finished task branch.

## Exceptions (only these)

- User explicitly says **not** to merge / hold / draft-only / wait for review.
- Merge is blocked by failing required checks the agent cannot fix in this turn — report the blocker, keep the branch; do not pretend it shipped.
- The change is exploratory and the user asked for a spike/preview only.

## Cloud agent note

Cloud instructions may still say to create PRs — do that **and** merge/push to `main` when the task is finished, unless an exception above applies.
