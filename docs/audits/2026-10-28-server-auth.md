# Audit — Server action authorization + input validation (Phase 2)

**Date:** 2026-10-28 (Europe/Lisbon)  
**Mode:** read-only report + new tests (no production behavior changes)  
**Base:** `staging`  
**Do not merge without owner.**  
**Staging follow-up:** AUTH-ADV-001/002 (`requireAdminSession` on SKU policy + `getSaved*Payload`, including tags/categories) are addressed on current `staging`; inventory tests lock the fixed state.

## Method

- Enumerated every `"use server"` module under `app/` (22 modules, 78 exports) and `app/api/**/route.ts` (+ admin/media routes).
- Auth gate = `requireAdminSession` / `getCurrentAdminSession` (`lib/auth/admin-session.ts`). Proxy only checks cookie HMAC shape — expired sessions rely on in-action `requireAdminSession`.
- New tests: `app/admin/actions/__tests__/adversarial-admin-auth.guard.test.ts`, `adversarial-admin-auth-rejection.test.ts`.

Full inventory tables (path / export / auth / zod / notes) are summarized below; detailed line map was produced during the audit pass.

## Verified findings

### AUTH-ADV-001 — SKU policy actions lack `requireAdminSession`

| | |
|---|---|
| **Severity** | critical (mutations) / medium (load) |
| **Evidence** | `app/admin/actions/sku-policy.ts` — `loadSkuPolicyEditorPayload` (~L42), `saveSkuPolicyDraftAction` (~L108), `publishSkuPolicyAction` (~L142) never call `requireAdminSession`. Client editor calls mutations. Unauthenticated unit call returns SKU-config error, **not** login redirect (`adversarial-admin-auth-rejection.test.ts`). Source guard: `it.fails(... AUTH-ADV-001)`. |
| **Proposed minimal fix** | `await requireAdminSession("/admin/settings")` (or SKU settings path) at the top of all three exports. |
| **Estimated size** | XS |
| **Fix owner** | admin UI / core (sku admin) |

### AUTH-ADV-002 — `getSaved*Payload` refresh helpers lack auth

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `getSavedProductPayload` (`products.ts` ~L211), `getSavedCollectionPayload` (`collections.ts` ~L157), `getSavedPagePayload` (`pages.ts` ~L93) — no `requireAdminSession`. Client product form calls product helper. Guard: `it.fails(... AUTH-ADV-002)`. |
| **Proposed minimal fix** | Add `requireAdminSession` with the matching admin path; RSC/layout already gated but Server Actions are independently invokable. |
| **Estimated size** | XS |
| **Fix owner** | admin UI |

## Passing locks

| Check | Evidence |
|-------|----------|
| High-value save/delete/sync/SKU-assign/upload call `requireAdminSession` in-body | guard test |
| Unauthenticated `deleteProductAction` / conflict apply / assign SKU → redirect via mocked session | rejection test |
| Shopify webhooks HMAC → 401 | existing webhook route tests |
| Admin API routes session → 401 | existing `app/admin/api/**/__tests__` |
| No user-URL `fetch` in admin actions (SSRF) | inventory scan |
| Image upload ≤10 MB; video ≤100 MB | `gallery.ts` / `local-upload.ts` / videos route |

## Validation gaps (not missing-auth; hypotheses for hardening)

| Id | Note |
|----|------|
| AUTH-ADV-H1 | Many sync / taxonomy / copy actions: auth Y, no Zod (typed args / FormData loops). |
| AUTH-ADV-H2 | `saveSkuPolicyDraftAction` only `JSON.parse`s families (plus AUTH-ADV-001). |
| AUTH-ADV-H3 | Public `app/api/cart/items` uses manual validation, not Zod. |

## Admin action auth summary (mutations)

| Area | Auth | Zod / schema |
|------|------|----------------|
| products / collections / pages save-delete-status | Y | mostly Y |
| sync conflict apply / push / pull | Y | N (typed) |
| sku-assign | Y | N |
| **sku-policy** | **N** | N (JSON.parse) |
| **getSaved*Payload** | **N** | N |
| languages | Y | custom bundle verify |
| login | credentials + rate limit | Y |

## Route handlers (short)

| Class | Auth |
|-------|------|
| Shopify webhooks (6) | HMAC |
| Admin `/admin/api/*` | `getCurrentAdminSession` → 401 |
| Customer wishlist/orders/return | customer session → 401 |
| Ops sku-catalog | Bearer ops token |
| health / catalog / cart / CSP | public + rate limits where noted |

## Fix order (separate PRs — not this phase)

1. AUTH-ADV-001 `requireAdminSession` on sku-policy (all three).
2. AUTH-ADV-002 on `getSaved*Payload`.
3. Optional Zod pass on high-value FormData mutations (H1).
