# Product create → Shopify TDD evidence

**Date:** 2026-10-27  
**Source:** Owner-reported staging flow for product `test new 4` / SKU `BA-CH-002`.

## Journeys locked by tests

- A Synarava-only product, including PT/RU translation rows and an optional
  pending SKU reservation, produces one base presence leaf and zero locale or
  commerce leaves.
- The product header on every tab keeps the one available Shopify action
  visible. Missing SKU blocks Create inline; a pending reservation does not
  replace Create with a dead-end retry control.
- A successful Create/Push performs the post-action check and renders `In sync`.
- A Shopify-only product offers Pull; one-sided collections retain the same
  single-presence-leaf contract.
- All badges and totals count the same selected SyncResult leaves.

## RED

The focused Vitest command failed with six expected assertions before the
implementation: duplicate locale/presence coverage, missing persistent header
actions, post-create status, and the invalid pending-reservation retry state.
The failing-test checkpoint is commit `1aa5d1fc`.

## GREEN

The same focused suite passes: 5 files, 34 tests. `pnpm typecheck` also passes.
Full repository lint and test gates are recorded in the pull request checks.
