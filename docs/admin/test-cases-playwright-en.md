# Admin Panel Test Cases — Authoring Reference

Source of truth for `/admin/**` test coverage. Derived from reading the
implementation (`app/admin/**`, `components/admin/**`, `lib/auth/**`,
`lib/media/**`, `lib/admin/issues.ts`) as of 2026-09-08, after the
Shopify-alignment work and the god-file split (Phases 1–3 of
`docs/history/admin-shopify-refactor-2026-09.md`).

Execution plan lives in `docs/admin/test-plan-ru.md`. Russian mirror of this
catalog: `docs/admin/test-cases-manual-ru.md`.

---

## 0. How to use this catalog

### Layer routing

Not every case belongs in Playwright. **If a case can be verified without a
browser, it is not an e2e test.** Writing it as one buys nothing and costs
seconds per run plus a flake surface.

| Layer | Meaning | Where it lives |
|---|---|---|
| `E2E` | Needs a real browser, real navigation, or a real HTTP cycle | `e2e/*.spec.ts` |
| `action` | Server action called directly with `FormData` | `app/admin/actions/__tests__/*` |
| `unit` | Pure function, no I/O | `lib/**/__tests__/*` |
| `render` | Component renders / wires its action correctly | `components/admin/**/__tests__/*` |
| `✔` | **Already covered** — do not re-implement, see Notes | — |

`✔` matters: as of this revision **21 catalog cases are already green** in
Vitest or `admin-auth.spec.ts`. Most of section 1 is in that bucket.

### Conventions

- **Type**: `positive` | `negative` | `edge` | `security`.
- **Priority**: `P1` (blocks release) / `P2` (important) / `P3` (edge / low risk).
- Section headings name the target spec file.
- Server actions are referenced by name so the author can choose between a
  UI-driven flow and a direct action call where the UI exposes no path
  (e.g. deleting a protected page).

---

## 1. Authentication & session (`e2e/admin-auth.spec.ts`)

Most of this section is **already covered by unit/action tests**. Only the
cases that need a real browser remain as e2e work.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| AUTH-01 | Guest visiting `/admin` redirects to `/admin/login?redirectTo=%2Fadmin` | positive | P1 | ✔ E2E | `admin-auth.spec.ts`. |
| AUTH-02 | Guest visiting **any** nested admin route redirects with the right `redirectTo` | positive | P1 | **E2E** | Loop a route table: `/admin/products`, `/admin/collections/new`, `/admin/pages/new`, `/admin/videos`, `/admin/issues`, `/admin/account`. The guard is `requireAdminSession` in the layout, not middleware — it is per-page, so verify per-route. |
| AUTH-03 | Valid credentials land on `/admin` | positive | P1 | ✔ E2E | `admin-auth.spec.ts`. |
| AUTH-04 | Wrong password shows "Incorrect admin credentials.", no session | negative | P1 | ✔ action | `login/__tests__/actions.test.ts` + `admin-session.test.ts`. |
| AUTH-05 | Wrong username gives the *same* generic error (no enumeration) | negative | P2 | ✔ action | Same files; assertion is that both paths return one message. |
| AUTH-06 | Empty username/password blocked | negative | P2 | **E2E** + ✔ action | Server side covered. E2E adds the client `required` attribute actually blocking submit in a browser. |
| AUTH-07 | Trailing-space password is a different (wrong) password | edge | P3 | ✔ unit | Password is deliberately not trimmed — `lib/auth/admin-session.ts`. |
| AUTH-08 | 11th failed attempt in 15 min is rate-limited | negative | P1 | ✔ action | `actions.test.ts` "returns retry metadata when rate limited". Do **not** drive this through the UI 10 times. |
| AUTH-09 | Successful login clears the IP's rate-limit bucket | edge | P3 | **action** | Not yet covered. Cheaper at action layer than in a browser. |
| AUTH-10 | `redirectTo` to an allowed admin path is honored after login | positive | P2 | **E2E** | Sanitization is unit-covered; e2e proves the browser actually lands there. |
| AUTH-11 | `redirectTo` to an external absolute URL is ignored | security | P1 | ✔ unit | `safe-redirect.test.ts` + `actions.test.ts` "sanitizes external redirect targets". |
| AUTH-12 | `redirectTo` as protocol-relative `//example.com` is ignored | security | P1 | ✔ unit | `safe-redirect.test.ts`. |
| AUTH-13 | `redirectTo` back to `/admin/login` falls back to `/admin` | edge | P3 | ✔ unit | `admin-session.test.ts` route-boundary test. |
| AUTH-14 | Authenticated user visiting `/admin/login` is redirected away | positive | P2 | **E2E** | Needs a live session cookie; login form must never render. |
| AUTH-15 | Logout clears the session | positive | P1 | ✔ E2E | `admin-auth.spec.ts`. |
| AUTH-16 | Session cookie has `Path=/admin`, absent on storefront requests | security | P3 | **E2E** | Unit covers the path used at sign-out; e2e checks the real browser cookie via `context.cookies()` and that `/` requests don't carry it. |
| AUTH-17 | Session cookie is `httpOnly` (and `Secure` in prod config) | security | P3 | **E2E** | Flag assertion from `context.cookies()`. |
| AUTH-18 | Unconfigured `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` blocks all logins | negative | P3 | ✔ action | `actions.test.ts` "returns a configuration error". |
| AUTH-19 | Expired session (>8 h) behaves like a guest | negative | P2 | **action** | Manipulate `expiresAt`; not worth a browser. |

**E2E work in this section: 6 cases** (AUTH-02, 06, 10, 14, 16, 17).

## 2. Studio shell / layout (`e2e/admin-layout.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| UI-01 | Sidebar stays fixed-width, scrolls independently | positive | P3 | ✔ E2E | `admin-auth.spec.ts`; move to `admin-layout.spec.ts` when that file is created. |
| UI-02 | Topbar stays pinned while the page scrolls | positive | P3 | ✔ E2E | Same. |
| UI-03 | No horizontal overflow on `/admin/products` at 778px | positive | P3 | ✔ E2E | Same. |
| UI-04 | Open-issue counter shows when `AdminIssue` rows are `OPEN` and links correctly | positive | P2 | **E2E** | Seed an open issue, assert badge count and `href`. |
| UI-05 | Mobile menu exposes every nav item, theme toggle, logout | positive | P3 | **E2E** | Nav is `Overview, Home, About, Pages, Videos, Catalog, Problems, Collections, Account` (`admin-primitives.tsx`). |
| UI-06 | Theme toggle switches and persists across navigation | positive | P3 | **E2E** | |
| UI-07 | Dashboard tiles reflect actual counts | positive | P2 | **E2E** | **There are exactly three tiles: Pages, Products, Collections.** Categories/Tags tiles were removed with those sections. Status row also shows Products live/draft, Collections live, active locale (`EN`). |

## 3. Products — list & filters (`e2e/admin-products.spec.ts`)

Filtering is client-side in `products-cms.tsx`; no network wait needed.
**Never assert absolute row counts** — other parallel workers share the DB.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-L01 | Search by name filters the list (case-insensitive) | positive | P2 | **E2E** | |
| PROD-L02 | Search by SKU filters the list | positive | P2 | **E2E** | |
| PROD-L03 | Search by slug filters the list | positive | P3 | **E2E** | |
| PROD-L04 | No matches shows the empty state | edge | P3 | **E2E** | "No products match the current filters." |
| PROD-L05 | Status filter `Published` shows only ACTIVE+PUBLIC | positive | P2 | **E2E** | |
| PROD-L06 | Status filter `Draft` | positive | P2 | **E2E** | |
| PROD-L07 | Status filter `Archived` | positive | P2 | **E2E** | |
| PROD-L08 | Status filter `Unlisted` shows only UNLISTED products | positive | P2 | **E2E** | **New.** The option exists in the status `<select>`; was missing from this catalog. |
| PROD-L09 | Category filter narrows by Shopify category | positive | P2 | **E2E** | Filter compares `product.shopifyCategoryId`. |
| PROD-L10 | Collection filter narrows to one collection | positive | P2 | **E2E** | Matches **any** membership, including the primary-nav one. |
| PROD-L11 | Sort options reorder the list; default is "Latest published" | positive | P2 | ✔ unit | `product-helpers.test.ts` covers all six sort keys incl. unpublished-last. |
| PROD-L12 | Search + status + category combine with AND | edge | P3 | **E2E** | |

## 4. Products — create & edit (`e2e/admin-products.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-C01 | Create with name/SKU/price saves as Draft, redirects to edit route | positive | P1 | **E2E** | |
| PROD-C02 | Empty name → "Enter a product name." blocks save | negative | P1 | **render** | Field-level validation; browser adds nothing. |
| PROD-C03 | Empty SKU → "Enter an SKU." blocks save | negative | P1 | **render** | |
| PROD-C04 | Price `0`/negative → "Enter a price greater than 0." | negative | P2 | **render** | |
| PROD-C05 | Non-numeric price shows the same field error | edge | P3 | **render** | |
| PROD-C06 | Publishing without a primary image is blocked | negative | P1 | **action** | "Product image is required before publishing." Guard is `if ((isPublished \|\| isUnlisted) && !imageUrl)` — **applies to UNLISTED too** (see PROD-U02). |
| PROD-C07 | Publishing with an image succeeds; product reachable publicly | positive | P1 | **E2E** | Cross-check `/products/[slug]` on the storefront. |
| PROD-C08 | Quick "Publish" row action blocked the same way without an image | negative | P2 | **action** | `updateProductStatusAction`. |
| PROD-C09 | Slug auto-generates from name while untouched | positive | P2 | ✔ render | Covered by `product-create-form.test.ts` field wiring + `slug.test.ts`. |
| PROD-C10 | Slug handles diacritics (`Ámbar` → `ambar`, not empty) | edge | P2 | ✔ unit | `lib/text/__tests__/slug.test.ts`. |
| PROD-C11 | Manually edited slug stops auto-updating | edge | P3 | **render** | |
| PROD-C12 | Clearing the slug re-enables auto-generation | edge | P3 | **render** | |
| PROD-C13 | Slug/SKU belonging to another product is rejected, existing row untouched | negative | P1 | ✔ action | `products.test.ts` — two tests. **Resolved: this is a hard reject, not an upsert** (see §14). |
| PROD-C14 | Valid JPEG/PNG/WebP <10 MB uploads; first item becomes cover | positive | P1 | **E2E** | Real file upload — genuinely e2e. |
| PROD-C15 | Image >10 MB rejected: "Image must be 10 MB or smaller." | negative | P2 | **E2E** | Generate an oversized buffer at runtime; don't commit a fixture. |
| PROD-C16 | Non-image file (`.pdf`) rejected | negative | P2 | **E2E** | |
| PROD-C17 | Corrupted file with a valid extension rejected | negative | P3 | **E2E** | Sharp decode failure in `lib/media/local-upload.ts`. |
| PROD-C18 | Removing the first gallery image promotes the next to cover | edge | P2 | **E2E** | `removeProductMediaAction` promotes by `(sortOrder asc, createdAt asc)` and rewrites `product.imageUrl`. |
| PROD-C19 | Comma tags normalize to slugs, dedupe, drop empties | positive | P2 | ✔ unit | `lib/text/__tests__/parse-tags.test.ts`. |
| PROD-C20 | A brand-new tag persists locally and is included in the next push | positive | P3 | **E2E** | No standalone Tag CRUD route exists any more. |
| PROD-C21 | Category must come from the Shopify taxonomy picker | positive | P2 | ✔ action | `products.test.ts` "rejects a category value that was not selected from Shopify taxonomy". |
| PROD-C22 | Assigning a collection puts the product under that collection filter | positive | P2 | **E2E** | |
| PROD-C23 | Changing collection A → B unassigns A | edge | P3 | **E2E** | Save wipes all `productCollection` rows then re-creates. See PROD-D02 for the department interaction. |
| PROD-C24 | TEXT characteristic saves and reloads | positive | P2 | **E2E** | |
| PROD-C25 | NUMBER characteristic saves with its unit | positive | P2 | **E2E** | |
| PROD-C26 | Non-numeric NUMBER input is silently dropped, not a form error | edge | P3 | ✔ unit | `lib/products/__tests__/characteristics.test.ts`. |
| PROD-C27 | BOOLEAN characteristic saves as checked | positive | P3 | **E2E** | |
| PROD-C28 | Certificate URL persists even with the BOOLEAN unchecked | edge | P3 | ✔ unit | Explicit carve-out in `parseCharacteristicsForm`. |
| PROD-C29 | All-empty characteristics saves cleanly with an empty list | edge | P3 | **action** | |
| PROD-C30 | Partially filled material card (title only) is dropped | negative | P3 | **action** | `materials.filter(i => i.title && i.body && i.image)`. |
| PROD-C31 | Fully filled material card persists and reloads | positive | P2 | **E2E** | Needs a real image upload. |
| PROD-C32 | Incomplete process stat pair is dropped | negative | P3 | **action** | |
| PROD-C33 | Lookbook entry without an image is dropped | negative | P3 | **action** | |
| PROD-C34 | Lookbook "featured" flag persists | positive | P3 | **E2E** | |
| PROD-C35 | Only fully filled attribute pairs persist, any index order | edge | P3 | **action** | |
| PROD-C36 | Typing a name on the create form autosaves a Draft | positive | P2 | **E2E** | `autosaveProductDraftAction`, debounce 700 ms. **Use `expect.poll`/`toPass` (~2 s), never `waitForTimeout(700)`.** |
| PROD-C37 | Empty create form autosaves nothing | negative | P2 | **action** | `hasMeaningfulDraftInput` guard. |
| PROD-C38 | Editing a description persists and bumps `updatedAt` | positive | P1 | **E2E** | |
| PROD-C39 | Cancelling the save-confirmation modal discards the change | negative | P3 | ✔ render | Confirmation wiring covered by `product-edit-form.test.ts`. |
| PROD-C40 | Moving a gallery image left/right persists order, keeps position 1 as cover | positive | P1 | **E2E** | `moveProductMediaAction` always recomputes first → PRIMARY after the swap. |
| PROD-C41 | "Move to first" makes the chosen image the cover | positive | P1 | **E2E** | `setPrimaryProductMediaAction`. |
| PROD-C42 | Moving the first image left is a no-op | edge | P3 | **action** | **New.** No neighbor → early return, no mutation. |
| PROD-C43 | Removing the **last** gallery image of a PUBLISHED product leaves it published with no image | edge | P2 | **action** | **New, and a likely bug.** The publish guard lives only in `saveProductAction`; `removeProductMediaAction` sets `primaryAssetId: null, imageUrl: null` unconditionally. Confirm intended behavior before asserting — see §14.3. |

## 5. Products — UNLISTED status (`e2e/admin-products.spec.ts`)

**Entirely new section.** `UNLISTED` arrived in commit `5ba2e83` and had no
coverage in any catalog. It is a first-class workflow state, not a variant
of Draft.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-U01 | Saving with `workflowState=UNLISTED` sets `status=UNLISTED`, `visibility=UNLISTED`, and stamps `publishedAt` | positive | P1 | **action** | `publishedAt` is set for UNLISTED as well as PUBLISHED. |
| PROD-U02 | Publishing to UNLISTED **without an image is blocked**, same as PUBLISHED | negative | P1 | **action** | The guard is `(isPublished \|\| isUnlisted) && !imageUrl`. Easy to miss. |
| PROD-U03 | An UNLISTED product is hidden from storefront listings but reachable by direct URL | positive | P1 | **E2E** | The whole point of the status. |
| PROD-U04 | An UNLISTED variant can still be added to the cart | positive | P2 | **action** | `lib/commerce/storefront-cart.ts` explicitly admits `status: { in: ["ACTIVE","UNLISTED"] }`. |
| PROD-U05 | The list badge and `Unlisted` filter both report UNLISTED correctly | positive | P2 | ✔ unit | `product-helpers.test.ts` covers `productStatusLabel`; filter itself is PROD-L08. |
| PROD-U06 | The primary variant's status follows the product into UNLISTED | edge | P3 | **action** | Variant write mirrors the same ternary. |

## 6. Products — department & primary-nav collections (`e2e/admin-products.spec.ts`)

**New section.** Covers the boundary that was mis-handled in four separate
call sites before Phase A item 3 and is now centralized.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-D01 | The Department select offers **only** collections with `isPrimaryNav`, ordered by `navSortOrder` | positive | P1 | ✔ render | `product-create-form.test.ts` "only offers primary-nav collections". |
| PROD-D02 | Changing the department does not disturb the marketing collection, and vice versa | edge | P1 | **action** | `syncDepartmentCollectionMembership` scopes every read/write to `isPrimaryNav: true`. This is the regression that bit four call sites. |
| PROD-D03 | The edit form's Collection field shows the marketing collection, never the department | positive | P1 | ✔ unit | `product-helpers.test.ts` "excludes the primary-nav (department) collection". |
| PROD-D04 | Clearing the department removes only the nav membership | edge | P2 | **action** | `staleIds` deletion path with `target === null`. |

## 7. Products — variant-owned commerce fields (`e2e/admin-products.spec.ts`)

**New section.** After Phase A item 5 the variant, not the `Product` mirror
columns, owns SKU / price / stock. The mirror columns survive only as a
Shopify pull anchor.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-V01 | The edit form shows the **variant's** SKU/price/stock, not the Product mirror | positive | P1 | ✔ unit | `product-helpers.test.ts` "prefers the primary variant's commerce fields". |
| PROD-V02 | The list price column reads the variant first, falling back to the product | positive | P2 | **E2E** | `centsToPrice(product.variants[0]?.priceCents ?? product.priceCents)`. |
| PROD-V03 | Saving a product with no variant yet creates the primary variant | positive | P1 | **action** | Otherwise Shopify push stays blocked (see SYNC-15). |

## 8. Products — status transitions & deletion (`e2e/admin-products.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PROD-S01 | Draft → Publish (image present) goes live on the storefront | positive | P1 | **E2E** | |
| PROD-S02 | Publish → Draft hides it without deleting | positive | P1 | **E2E** | |
| PROD-S03 | Publish → Archive hides it and exempts it from taxonomy QA checks | positive | P2 | **E2E** | Cross-check ISS-04. |
| PROD-S04 | Archive → Draft/Publish transitions back | edge | P3 | **action** | |
| PROD-S05 | Deleting an unlinked product removes it; public URL 404s | positive | P1 | **E2E** | |
| PROD-S06 | Deleting a Shopify-linked product deletes it remotely too | positive | P2 | **E2E** | Sandbox-gated. |
| PROD-S07 | A Shopify deletion failure aborts the local delete | negative | P2 | **action** | Mock the Shopify call; do not attempt in a browser. |
| PROD-S08 | Cancelling the delete modal leaves the product untouched | negative | P3 | ✔ render | `product-edit-form.test.ts`. |

## 9. Shopify sync (`e2e/admin-shopify-sync.spec.ts`)

**Out of the main queue.** Every case here `test.skip()`s without Shopify env
vars, mirroring `admin-auth.spec.ts`. Default CI state is "not configured",
and SYNC-16 asserts that state is handled gracefully.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| SYNC-01 | "Test Shopify connection" reports shop/product/location/publication counts | positive | P2 | **E2E** | Sandbox. |
| SYNC-02 | Connection test reports missing env vars when unconfigured | negative | P2 | **action** | Runs without a sandbox. |
| SYNC-03 | Connection test reports missing scopes for an under-scoped token | negative | P3 | **E2E** | Needs a deliberately under-scoped token. |
| SYNC-04 | "Preview sync" lists candidates and mutates nothing | positive | P2 | **E2E** | Assert DB unchanged afterwards. |
| SYNC-05 | Pushing a new local product stores `shopifyProductId`/`shopifyHandle` | positive | P1 | **E2E** | |
| SYNC-06 | Pull updates Shopify-owned fields, leaves the Synarava CMS layer intact | positive | P1 | **E2E** | The core two-owners guarantee; assert an untouched editorial field explicitly. |
| SYNC-07 | Simultaneous local+remote change surfaces `CONFLICT`, blocks unconfirmed push/pull | negative | P2 | **E2E** | |
| SYNC-08 | "Use Shopify version" overwrites Shopify-owned fields only | positive | P2 | **E2E** | |
| SYNC-09 | "Keep Synarava and push" pushes local values | positive | P2 | **E2E** | |
| SYNC-10 | Remotely-deleted product reports `REMOTE_MISSING`, blocks push/pull | negative | P2 | **E2E** | |
| SYNC-11 | Bulk import surfaces conflicts as failures, not silent skips | positive | P2 | **E2E** | |
| SYNC-12 | "Push all local products" pushes everything pending | positive | P2 | **E2E** | |
| SYNC-13 | "Archive selected" archives missing products with `syncError` set | positive | P2 | **E2E** | |
| SYNC-14 | Archiving after a stale preview is rejected | negative | P3 | **action** | "The catalog changed after preview. Run Preview sync again before archiving." |
| SYNC-15 | Push disabled ("Save core fields first") with zero variants | edge | P3 | ✔ render | `product-sync-strip.tsx` `canPush` requires `variants.length > 0`. |
| SYNC-16 | Full product CRUD works with Shopify entirely unconfigured | positive | P1 | **E2E** | Default CI state — assert the sync panel says "not linked" rather than erroring. |

## 10. Collections (`e2e/admin-collections.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| COL-01 | Create with all required fields lands at `sortOrder=1`, shifting others | positive | P1 | **E2E** | |
| COL-02 | Missing hero image fails with a field error on that field | negative | P1 | **action** | `fieldErrors.heroImageFile = "Hero image is required."` |
| COL-03 | Empty summary / manifesto / search summary each fail on their own field | negative | P2 | **action** | Test each independently; validation is per-field, not pass/fail. |
| COL-04 | Publishing a Draft collection makes it public | positive | P1 | **E2E** | |
| COL-05 | Moving a non-first collection up swaps and resequences `sortOrder` | positive | P2 | **E2E** | |
| COL-06 | Moving the first collection up is a no-op | edge | P3 | **action** | |
| COL-07 | Deleting a collection keeps its products, unassigned; `sortOrder` resequences with no gaps | positive | P1 | **E2E** | Critical data-integrity guarantee. |
| COL-08 | Replacing an existing hero image swaps it cleanly | edge | P3 | **E2E** | |
| COL-09 | Removing the hero image is **always** blocked, in any workflow state | negative | P2 | **action** | **Resolved (§14.2):** unlike products, the hero image is required unconditionally, not only when publishing. |
| COL-10 | Filling one field autosaves a Draft collection | positive | P3 | **E2E** | `autosaveCollectionDraftAction`; same debounce caveat as PROD-C36. |
| COL-11 | Collection code auto-generates from the name and is deterministic | positive | P2 | ✔ unit | `collection-helpers.test.ts`. |
| COL-12 | An `isPrimaryNav` collection appears in the storefront's top-level navigation | positive | P2 | **E2E** | `getStorefrontNavigation()`; ties the department model to the public site. |

## 11. Pages (`e2e/admin-pages.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| PAGE-01 | Creating a custom page with title+slug succeeds, publicly reachable once published | positive | P1 | **E2E** | |
| PAGE-02 | Empty title blocks save | negative | P1 | **action** | "Page slug and title are required." |
| PAGE-03 | Editing `home`'s "Hero headline" persists; labels are home-specific | positive | P2 | ✔ render | `page-editor-form.test.ts` covers the home-specific labels. |
| PAGE-04 | Editing `about`'s "Studio introduction" persists | positive | P2 | **E2E** | |
| PAGE-05 | The delete control is absent for `home` | positive | P1 | **render** | `isProtectedPage` gate; UI half of the guarantee. |
| PAGE-06 | `deletePageAction` for `home`/`about`/`manifesto` is refused server-side | security | P1 | **action** | "System pages cannot be deleted." Hiding a button is not a security boundary — the server must refuse independently. |
| PAGE-07 | Deleting a non-protected page succeeds; its URL 404s | positive | P1 | **E2E** | |
| PAGE-08 | PT translation fields persist independently of the main content | positive | P3 | **E2E** | |
| PAGE-09 | Saving with all PT fields empty succeeds | positive | P3 | **action** | |
| PAGE-10 | Publish → Draft → Archive updates `status`/`visibility` each step | positive | P2 | **action** | |
| PAGE-11 | Slug auto-generates from the title | positive | P2 | ✔ unit | `slug.test.ts`. |
| PAGE-12 | Hero image upload then removal round-trips | edge | P3 | **E2E** | |

## 12. Videos (`e2e/admin-videos.spec.ts`)

Direct-to-bucket presigned uploads. For CI, mock `/admin/api/videos` and the
bucket `PUT` rather than moving real megabytes.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| VID-01 | Valid MP4 <500 MB uploads through the presigned flow | positive | P1 | **E2E** | |
| VID-02 | Valid WebM uploads | positive | P2 | **E2E** | |
| VID-03 | Multiple slots in one submit report "N videos uploaded" | positive | P2 | **E2E** | |
| VID-04 | No file selected → "Choose at least one MP4 or WebM video to upload." | negative | P2 | **render** | Pure client check before any network call. |
| VID-05 | Unsupported format (`.mov`) rejected **server-side** | negative | P2 | **action** | Test the `VIDEO_TYPES` check, not the picker's `accept` attribute. |
| VID-06 | File >500 MB rejected | negative | P2 | **action** | Call `prepare` with a fabricated `sizeBytes`; don't generate 500 MB. |
| VID-07 | Object size/type mismatch at `complete` caught by `HeadObjectCommand` | security | P3 | — | Integration-only; needs a controllable bucket double. Document, don't automate yet. |
| VID-08 | Replacing a slot updates preview and stored URL | positive | P2 | **E2E** | |

## 13. Issues / QA scan (`e2e/admin-issues.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| ISS-01 | Scan on a clean catalog reports zero open/new | positive | P2 | **E2E** | Hard to guarantee "clean" on a shared DB — scope assertions to seeded fixtures. |
| ISS-02 | Product with a broken image URL is flagged ERROR | positive | P1 | **E2E** | Seed a product whose `/uploads/...` path does not exist. |
| ISS-03 | Non-archived product missing category/tags/collection gets a WARNING for each | positive | P1 | **E2E** | Three independent assertions. |
| ISS-04 | Archived product is exempt from taxonomy checks but not from media checks | edge | P2 | **E2E** | `lib/admin/issues.ts:190` — `if (product.status !== "ARCHIVED")` gates taxonomy only. |
| ISS-05 | Re-scanning after a fix marks the issue `RESOLVED` and drops the open count | positive | P1 | **E2E** | |
| ISS-06 | "Open problem" navigates to the entity with the field anchored | positive | P2 | **E2E** | Assert the `#field-...` hash and that the element scrolled into view. |
| ISS-07 | ~~Chain from category deletion~~ → replaced: unassigning the last collection surfaces "Missing collection" | positive | P2 | **E2E** | **Rewritten.** The original chained to CAT-07, but the Categories section no longer exists. Re-anchored to collection deletion (COL-07). |
| ISS-08 | New issue triggers an email when Resend env is configured | positive | P3 | — | Needs an email double; integration/manual only. |
| ISS-09 | Scan completes with no email attempt when email env is absent | positive | P3 | **action** | Default CI state. |
| ISS-10 | An UNLISTED product is still taxonomy-checked | edge | P2 | **action** | **New.** The exemption is `ARCHIVED` only — UNLISTED is *not* exempt. Worth pinning so a future refactor can't silently widen the exemption. |

## 14. Account (`e2e/admin-account.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| ACC-01 | `/admin/account` shows the session username and access badge | positive | P3 | **E2E** | |
| ACC-02 | `updateAdminCredentialsAction` returns the env-managed message, changes nothing | positive | P3 | **action** | No UI form exists — action-level only. |

## 15. Cross-cutting & security (`e2e/admin-security.spec.ts`)

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| SEC-01 | A server action invoked after cookies are cleared is rejected | security | P1 | **E2E** | `context.clearCookies()` mid-session, then attempt a mutation. |
| SEC-02 | HTML/script in a text field renders inert on the storefront | security | P1 | **E2E** | `<script>alert(1)</script>` in a name; assert no dialog and escaped DOM. |
| SEC-03 | Double-extension / mismatched-MIME file rejected by sniffing, not filename | security | P2 | **E2E** | Server validates via `sharp` decode + `file.type`. |
| SEC-04 | Rapid repeated submits don't create duplicates | edge | P2 | **E2E** | Assert one record and the `disabled` state during `isPending`. |
| SEC-05 | `POST /admin/api/videos` without a session returns 401 | security | P1 | **E2E** | Direct `request.post()` with cookies cleared. |
| SEC-06 | Injection-style strings in search/filter don't error | security | P2 | **E2E** | Filters are client-side; this is a "doesn't crash" smoke check. |
| SEC-07 | Very long text input saves or fails gracefully | edge | P3 | **E2E** | |

## 16. Lifecycle smoke tests (`e2e/admin-lifecycle.spec.ts`)

Written last — they reuse every fixture built for the sections above.

| ID | Scenario | Type | Prio | Layer | Notes |
|----|----------|------|------|-------|-------|
| E2E-01 | Product: create → fill editorial blocks → upload image → publish → verify on storefront → archive → verify gone → delete | positive | P1 | **E2E** | One serial test, `test.describe.configure({ mode: "serial" })`. |
| E2E-02 | Collection: create → assign products → publish → delete → products survive unassigned → QA scan flags "Missing collection" | positive | P1 | **E2E** | |
| E2E-03 | Page: create → PT translation → publish → verify public → delete → 404 | positive | P2 | **E2E** | **New.** Pages had no lifecycle case. |

---

## 17. Resolved questions

The previous revision ended with three open questions that had to be settled
before assertions could be written. All three are now answered from the code.

### 17.1 PROD-C13 — slug/SKU collision on create → **hard reject, not upsert**

The old concern (`db.product.upsert({ where: { slug } })` silently
overwriting an existing row) **no longer applies**. `saveProductAction` now
guards twice:

1. A pre-check before writing returns `productConflictState("slug"|"sku")`.
2. The write itself is `db.product.create()`, and a `P2002` unique violation
   is caught and mapped to the same field error.

Messages: `"A product with this URL slug already exists."` /
`"A product with this SKU already exists."` The existing product is never
modified. Already covered by two tests in `products.test.ts`.

### 17.2 COL-09 — removing a collection's hero image → **always blocked**

`validateCollectionInput` sets
`fieldErrors.heroImageFile = "Hero image is required."` whenever
`hasHeroImage` is false, with **no dependence on `workflowState`**. So
removing the hero image and saving fails in Draft exactly as it does in
Published. This differs from products, where the image requirement applies
only when publishing — the asymmetry is intentional and worth asserting on
both sides.

### 17.3 PROD-C18 / PROD-C43 — removing a product image → **two different paths**

The catalog previously conflated them:

- **Form path** (`removeImage=1` in `saveProductAction`): sets
  `imageUrl = null`, and the publish guard then blocks the save if the target
  state is PUBLISHED or UNLISTED. Coherent.
- **Gallery path** (`removeProductMediaAction`): deletes the row, promotes the
  next image by `(sortOrder asc, createdAt asc)`, and if **none remains** sets
  `primaryAssetId: null, imageUrl: null` — **without consulting the product's
  status.**

So an already-published product can be left published with no image by
deleting its last gallery image. The publish guard lives only in
`saveProductAction` and is not reached on this path. PROD-C43 records this;
**confirm with the team whether this is intended before asserting it**, since
writing a test either way freezes the decision.

### 17.4 Autosave timing (PROD-C36, COL-10)

`useDraftAutosave` debounces at 700 ms
(`components/admin/shared/use-draft-autosave.ts`). Assert with
`expect.poll` / `toPass` and a ~2 s timeout. A bare `waitForTimeout(700)`
will flake under CI load.
