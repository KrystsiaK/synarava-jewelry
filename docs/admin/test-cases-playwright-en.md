# Admin Panel Test Cases — Playwright Authoring Reference

Source of truth for writing `e2e/*.spec.ts` coverage of `/admin/**`. Derived
from reading the actual implementation (`app/admin/**`,
`components/admin/**`, `lib/auth/**`, `lib/media/**`, `lib/admin/issues.ts`)
as of 2026-09-06 on `main`. No test code has been written yet — this is the
analysis/spec to implement from.

Existing coverage already lives in `e2e/admin-auth.spec.ts` (guest redirect,
happy-path login, logout, sidebar/topbar layout, no horizontal overflow on
`/admin/products`). Cases below marked **[existing]** duplicate that file on
purpose (for completeness of the catalog) — do not re-implement them, extend
that file instead if they need changes. Everything else is a gap.

Conventions:
- **Type**: `positive` | `negative` | `edge` | `security`.
- **Priority**: `P1` (must-have, blocks release) / `P2` (important) / `P3`
  (nice-to-have / low-risk edge case).
- Suggested file: which spec file the case likely belongs in, following the
  existing `e2e/*.spec.ts` naming convention.
- Server actions referenced by name so a test author can decide between
  UI-driven flows and direct action/API calls where the UI doesn't expose a
  path (e.g. deleting a protected page).

---

## 1. Authentication & session (`e2e/admin-auth.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| AUTH-01 | **[existing]** Guest visiting `/admin` is redirected to `/admin/login?redirectTo=%2Fadmin` | positive | P1 | Already covered. |
| AUTH-02 | Guest visiting any nested admin route (`/admin/products`, `/admin/collections/new`, `/admin/videos`, `/admin/tags/new`) is redirected to `/admin/login?redirectTo=<that path>` | positive | P1 | Loop over a route table; layout-level guard (`requireAdminSession`) protects every page, no middleware — worth confirming per-route since it's not centralized. |
| AUTH-03 | **[existing]** Valid credentials log the admin in and land on `/admin` | positive | P1 | Already covered. |
| AUTH-04 | Wrong password with a valid username shows "Incorrect admin credentials." and does not create a session | negative | P1 | Assert URL stays `/admin/login`, then assert `/admin` still redirects. |
| AUTH-05 | Wrong username with any password shows the same generic error (no username enumeration) | negative | P2 | Assert error text identical to AUTH-04. |
| AUTH-06 | Submitting the login form with empty username/password | negative | P2 | `required` HTML attribute should block submission client-side; also worth a direct action call bypassing the client to hit server validation ("Enter both an admin username and password."). |
| AUTH-07 | Password with a trailing space is treated as a different (wrong) password | edge | P3 | Confirms password is intentionally NOT trimmed server-side (`lib/auth/admin-session.ts` comment) — only trim username-adjacent inputs, not password. |
| AUTH-08 | 11th failed login attempt within 15 minutes from the same client is rate-limited | negative | P1 | `checkRateLimit("admin-login-ip", ip, { max: 10, windowMs: 15*60*1000 })`. Loop 10 failed submits, assert the 11th shows "Too many attempts. Try again in Ns." and the submit button shows a countdown and is disabled. Slow test — consider tagging `@slow` or hitting the server action directly instead of the UI 10 times. |
| AUTH-09 | A successful login clears the IP's rate-limit bucket | edge | P3 | One failed attempt, then a correct one succeeds; then confirm the failed-attempt counter reset (10 more failed attempts are available again before lockout). |
| AUTH-10 | `redirectTo` pointing at an allowed admin path is honored after login | positive | P2 | `/admin/login?redirectTo=%2Fadmin%2Fproducts` → after login, `page.url()` ends with `/admin/products`. |
| AUTH-11 | `redirectTo` pointing at an external absolute URL is ignored (open-redirect guard) | security | P1 | `/admin/login?redirectTo=https%3A%2F%2Fexample.com` → after login, still on an `/admin/*` path, never navigates off-origin. See `lib/security/safe-redirect.ts`. |
| AUTH-12 | `redirectTo` as a protocol-relative URL (`//example.com`) is ignored | security | P1 | Same guard, different bypass attempt. |
| AUTH-13 | `redirectTo` pointing back at `/admin/login` falls back to `/admin` (no login-loop) | edge | P3 | `getSafeAdminRedirect` explicitly excludes paths starting with `/admin/login`. |
| AUTH-14 | Already-authenticated user visiting `/admin/login` is redirected away immediately | positive | P2 | Login once, then `page.goto("/admin/login")`, assert immediate redirect, login form never rendered. |
| AUTH-15 | **[existing]** Logout clears the session; `/admin` then redirects to login again | positive | P1 | Already covered. |
| AUTH-16 | Session cookie has `Path=/admin` and is not sent on storefront requests | security | P3 | Inspect cookies via `context.cookies()`; assert `path === "/admin"`; optionally assert a request to `/` doesn't carry the cookie. |
| AUTH-17 | Session cookie is `httpOnly` and (in a prod-like config) `Secure` | security | P3 | Static assertion on cookie flags from `context.cookies()`. |

## 2. Studio shell / layout (`e2e/admin-auth.spec.ts` or a new `admin-layout.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| UI-01 | **[existing]** Sidebar stays fixed-width and independent from content scroll at desktop viewport | positive | P3 | Already covered. |
| UI-02 | **[existing]** Topbar stays pinned to the top while the page scrolls | positive | P3 | Already covered. |
| UI-03 | **[existing]** No horizontal overflow on `/admin/products` at narrow viewport (778px) | positive | P3 | Already covered. |
| UI-04 | Open-issue counter is visible in the sidebar/topbar when `AdminIssue` rows with `status="OPEN"` exist, and links to the right section | positive | P2 | Seed an open issue (or trigger a scan against a broken-media fixture) then assert the badge count and its `href`. |
| UI-05 | Mobile menu exposes every nav section, theme toggle, and logout at a small viewport | positive | P3 | `page.setViewportSize` to a phone width, open hamburger, assert nav items + "Log out" button. |
| UI-06 | Theme toggle switches and persists across navigation | positive | P3 | Click toggle, navigate to another admin page, assert the theme attribute/class persisted. |
| UI-07 | Dashboard stat tiles reflect actual counts (Pages/Products/Collections/Categories/Tags) | positive | P2 | Create a product via API/action helper, reload `/admin`, assert the Products tile incremented. |

## 3. Products — list & filters (`e2e/admin-products.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| PROD-L01 | Search by product name filters the list (case-insensitive) | positive | P2 | Client-side filter in `products-cms.tsx`; no network wait needed. |
| PROD-L02 | Search by SKU filters the list | positive | P2 | |
| PROD-L03 | Search by slug filters the list | positive | P3 | |
| PROD-L04 | Search with no matches shows the empty state | edge | P3 | |
| PROD-L05 | Status filter `PUBLISHED` shows only active+public products | positive | P2 | |
| PROD-L06 | Status filter `DRAFT` shows only draft products | positive | P2 | |
| PROD-L07 | Status filter `ARCHIVED` shows only archived products | positive | P2 | |
| PROD-L08 | Category filter narrows to one category's products | positive | P2 | |
| PROD-L09 | Collection filter narrows to one collection's products | positive | P2 | |
| PROD-L10 | Search + status + category filters combine with AND semantics | edge | P3 | |

## 4. Products — create & edit (`e2e/admin-products.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| PROD-C01 | Creating a product with name, SKU, price saves as Draft and redirects to its edit route | positive | P1 | `saveProductAction`. |
| PROD-C02 | Empty name shows "Enter a product name." at the field and blocks save | negative | P1 | |
| PROD-C03 | Empty SKU shows "Enter an SKU." at the field and blocks save | negative | P1 | |
| PROD-C04 | Price of `0` or negative shows "Enter a price greater than 0." and blocks save | negative | P2 | |
| PROD-C05 | Non-numeric price shows the same field error and blocks save | edge | P3 | |
| PROD-C06 | Publishing without a primary image is blocked: "Product image is required before publishing." | negative | P1 | Applies both to the save-as-published form path and to the quick "Publish" row action (`updateProductStatusAction`). |
| PROD-C07 | Publishing with a primary image succeeds and product is reachable at its public URL | positive | P1 | Cross-check against the storefront route, e.g. `/products/[slug]`. |
| PROD-C08 | Quick "Publish" button in the table is blocked the same way as PROD-C06 when the product has no image | negative | P2 | |
| PROD-C09 | Slug auto-generates from the name while untouched | positive | P2 | |
| PROD-C10 | Slug generation handles diacritics/unicode correctly (`Ámbar` → `ambar`, not empty) | edge | P2 | Regression case per the code comment in `lib/text/slug.ts`. |
| PROD-C11 | Manually edited slug stops auto-updating when the name changes afterward | edge | P3 | |
| PROD-C12 | Clearing the slug field manually re-enables auto-generation from the name | edge | P3 | |
| PROD-C13 | Creating with a slug or SKU that belongs to another product shows a field conflict and leaves the existing product unchanged | negative | P1 | Regression coverage also exists in `app/admin/actions/__tests__/products.test.ts`. |
| PROD-C14 | Uploading a valid JPEG/PNG/WebP under 10MB through Product gallery creates a Draft if needed and makes the first item the cover | positive | P1 | |
| PROD-C15 | Uploading an image over 10MB is rejected: "Image must be 10 MB or smaller." | negative | P2 | Use `page.setInputFiles` with a generated oversized buffer. |
| PROD-C16 | Uploading a non-image file (e.g. `.pdf`) as the image field is rejected | negative | P2 | |
| PROD-C17 | Uploading a corrupted file with a valid image extension is rejected: "The uploaded file is not a valid JPEG, PNG, WebP, or AVIF image." | negative | P3 | Sharp decode failure path in `lib/media/local-upload.ts`. |
| PROD-C18 | Removing the first gallery image promotes the next image to primary without removing the product | edge | P2 | |
| PROD-C19 | Comma-separated tags normalize to slugs, dedupe, and drop empties (`"Lava, heritage, Symbolic!!"` → `lava, heritage, symbolic`) | positive | P2 | `parseTags` + `slugify`. |
| PROD-C20 | A brand-new tag name typed into the product form auto-creates a `Tag` row | positive | P3 | Assert it shows up on `/admin/tags` afterward. |
| PROD-C21 | Assigning a category makes the product show up under that category filter | positive | P2 | |
| PROD-C22 | Assigning a collection makes the product show up under that collection filter | positive | P2 | |
| PROD-C23 | Changing a product's collection from A to B unassigns A | edge | P3 | `productCollection.deleteMany` then re-create. |
| PROD-C24 | A TEXT characteristic (e.g. "Size") saves and reloads correctly | positive | P2 | |
| PROD-C25 | A NUMBER characteristic (e.g. "Length" in mm) saves with its unit and reloads correctly | positive | P2 | |
| PROD-C26 | Non-numeric input in a NUMBER characteristic field is silently dropped, not a hard form error | edge | P3 | `parseCharacteristicsForm` returns `[]` for that entry when `!Number.isFinite`. |
| PROD-C27 | A BOOLEAN characteristic checkbox saves as "Yes" when checked | positive | P3 | |
| PROD-C28 | A certificate URL on an unchecked BOOLEAN characteristic (e.g. REACH) is still persisted | edge | P3 | Explicit carve-out in `parseCharacteristicsForm`. |
| PROD-C29 | Leaving all characteristic fields empty saves the product with an empty characteristics list, no errors | edge | P3 | |
| PROD-C30 | A partially filled material card (title only, no body/image) is dropped on save | negative | P3 | `materials.filter(item => item.title && item.body && item.image)`. |
| PROD-C31 | A fully filled material card (title + body + image) persists and reloads | positive | P2 | |
| PROD-C32 | An incomplete process stat pair (value without label, or vice versa) is dropped | negative | P3 | |
| PROD-C33 | A lookbook entry without an image is dropped even if it has a label | negative | P3 | |
| PROD-C34 | A lookbook entry's "featured" flag persists | positive | P3 | |
| PROD-C35 | Only fully filled attribute label/value pairs (of up to 8) persist, regardless of which indexes are used | edge | P3 | |
| PROD-C36 | Filling the name field on the create form (without clicking Save) autosaves a Draft product in the background | positive | P2 | `autosaveProductDraftAction` fires on a debounce via `useDraftAutosave`; assert the record shows up in `/admin/products` after navigating away. This is a background/debounced effect — needs an explicit wait, not just an immediate assertion. |
| PROD-C37 | Leaving the create form completely empty does not create a stray autosaved record | negative | P2 | `hasMeaningfulDraftInput` guard. |
| PROD-C38 | Editing an existing product's description and saving persists the change and bumps `updatedAt` | positive | P1 | |
| PROD-C39 | Cancelling the save-confirmation modal discards the pending change | negative | P3 | |
| PROD-C40 | Moving a gallery image left/right persists its new order and keeps position 1 as primary | positive | P1 | |
| PROD-C41 | "Move to first" makes the chosen image the catalog cover | positive | P1 | |

## 5. Products — status transitions & deletion (`e2e/admin-products.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| PROD-S01 | Draft → Publish (image present) makes the product live on the storefront | positive | P1 | |
| PROD-S02 | Publish → Draft hides it from the storefront without deleting it | positive | P1 | |
| PROD-S03 | Publish → Archive hides it and excludes it from non-archived QA taxonomy checks | positive | P2 | Cross-check against ISS-04. |
| PROD-S04 | Archive → Draft/Publish transitions back correctly | edge | P3 | |
| PROD-S05 | Deleting an unlinked (non-Shopify) product removes it entirely; its public URL 404s afterward | positive | P1 | |
| PROD-S06 | Deleting a Shopify-linked product (Shopify configured) deletes it remotely too | positive | P2 | Requires a Shopify sandbox — mark `test.skip` when not configured, mirroring the pattern in `admin-auth.spec.ts`. |
| PROD-S07 | A Shopify deletion failure aborts the local delete, leaving the record intact | negative | P2 | Mock/force a Shopify API failure if feasible; otherwise document as manual-only. |
| PROD-S08 | Cancelling the delete confirmation modal leaves the product untouched | negative | P3 | |

## 6. Shopify sync (`e2e/admin-shopify-sync.spec.ts`, gate on a configured sandbox store)

All cases here should `test.skip()` when Shopify Admin API env vars aren't
present, the same way `admin-auth.spec.ts` skips on missing legacy
credentials. This suite is inherently the most "integration-y" and least
suited to CI without a dedicated sandbox store + fixtures.

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| SYNC-01 | "Test Shopify connection" succeeds and reports shop name/product/location/publication counts | positive | P2 | |
| SYNC-02 | "Test Shopify connection" reports missing env vars when unconfigured | negative | P2 | Doesn't require a sandbox — can run by unsetting env in a dedicated project config. |
| SYNC-03 | "Test Shopify connection" reports missing scopes for an under-scoped token | negative | P3 | Needs a deliberately under-scoped test token. |
| SYNC-04 | "Preview sync" lists remote/push/archive candidates without mutating anything | positive | P2 | Assert DB/UI state unchanged after preview. |
| SYNC-05 | Pushing a brand-new local product creates it in Shopify and stores `shopifyProductId`/`shopifyHandle` locally | positive | P1 | |
| SYNC-06 | Pulling remote changes updates Shopify-owned fields while leaving Synarava-only content (materials, symbolism, etc.) untouched | positive | P1 | Core "two owners" guarantee — worth its own explicit assertion on an untouched field. |
| SYNC-07 | Simultaneous local + remote changes surface `CONFLICT` and block unconfirmed push/pull | negative | P2 | |
| SYNC-08 | Resolving a conflict via "Use Shopify version" overwrites local Shopify-owned fields only | positive | P2 | |
| SYNC-09 | Resolving a conflict via "Keep Synarava and push" pushes local values to Shopify | positive | P2 | |
| SYNC-10 | A remotely-deleted linked product reports `REMOTE_MISSING` and blocks push/pull without `force` | negative | P2 | |
| SYNC-11 | "Import all Shopify changes" bulk-imports non-conflicting remote changes, surfaces conflicts as failures rather than silently skipping | positive | P2 | |
| SYNC-12 | "Push all local products" bulk-pushes all pending local products | positive | P2 | |
| SYNC-13 | "Archive selected" archives confirmed-missing local products with `syncError` set | positive | P2 | |
| SYNC-14 | Archiving after the catalog changed since the last preview is rejected: "The catalog changed after preview. Run Preview sync again before archiving." | negative | P3 | `archiveMissingShopifyProductsAction` re-validates against a fresh preview. |
| SYNC-15 | Push is disabled ("Save core fields first") for a product with zero variants | edge | P3 | Autosaved drafts before the first full save. |
| SYNC-16 | Full product CRUD works normally when Shopify is entirely unconfigured | positive | P1 | This is the default CI state — should already be exercised implicitly by PROD-C* cases, but worth one explicit assertion that the sync panel shows "not configured" rather than erroring. |

## 7. Categories (`e2e/admin-categories.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| CAT-01 | Creating a category with just a name succeeds, slug auto-generates | positive | P1 | |
| CAT-02 | Empty name blocks save: "Category name is required." | negative | P1 | |
| CAT-03 | Search matches name, slug, or description | positive | P2 | Client-side filter. |
| CAT-04 | `sortOrder` controls list ordering | edge | P3 | |
| CAT-05 | Editing a category's name/description persists | positive | P2 | |
| CAT-06 | Deleting a category with no products succeeds | positive | P1 | |
| CAT-07 | Deleting a category that has products detaches them (products remain, `categoryId` becomes null) rather than deleting the products | positive | P1 | Critical data-integrity guarantee — assert the product still exists via its edit page after category deletion. |
| CAT-08 | After CAT-07, a QA scan surfaces a "Missing category" warning for the affected product | positive | P2 | Chains into ISS-03. |
| CAT-09 | Cancelling the delete-confirmation modal leaves the category intact | negative | P3 | |

## 8. Tags (`e2e/admin-tags.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| TAG-01 | Creating a tag with just a name succeeds, slug auto-generates | positive | P1 | |
| TAG-02 | Empty name blocks save: "Tag name is required." | negative | P1 | |
| TAG-03 | Search matches name or slug | positive | P2 | |
| TAG-04 | Deleting a tag used by products detaches it from them without deleting the products | positive | P1 | |
| TAG-05 | After TAG-04, a QA scan surfaces "Missing tags" for a product left with zero tags | positive | P2 | |
| TAG-06 | Editing a tag's name updates it while preserving existing product associations | edge | P3 | |

## 9. Collections (`e2e/admin-collections.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| COL-01 | Creating a collection with all required fields (incl. hero image) succeeds and is inserted at `sortOrder=1`, shifting others down | positive | P1 | |
| COL-02 | Creating without a hero image fails with a field-level error on the image field specifically (not a generic error) | negative | P1 | `fieldErrors.heroImageFile` — assert the error renders next to that field. |
| COL-03 | Leaving summary/manifesto/searchSummary empty fails with a field-specific error for each | negative | P2 | Test each field independently. |
| COL-04 | Publishing a Draft collection makes it visible on the public collections page | positive | P1 | |
| COL-05 | Moving a non-first collection up swaps it with its neighbor and resequences `sortOrder` | positive | P2 | |
| COL-06 | Moving the first collection up is a no-op (no out-of-bounds reorder) | edge | P3 | |
| COL-07 | Deleting a collection with assigned products removes the collection and its sections but leaves the products intact, unassigned; remaining collections' `sortOrder` is resequenced with no gaps | positive | P1 | |
| COL-08 | Replacing an existing hero image swaps it cleanly | edge | P3 | |
| COL-09 | Removing the hero image via the "remove image" flag interacts with the required-image rule — verify actual behavior | edge | P2 | Same class of ambiguity as PROD-C18; pin down actual behavior before asserting. |
| COL-10 | Filling one field on the create form without saving autosaves a Draft collection | positive | P3 | `autosaveCollectionDraftAction`. |

## 10. Pages (`e2e/admin-pages.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| PAGE-01 | Creating a custom page with title + slug succeeds and is publicly reachable once published | positive | P1 | |
| PAGE-02 | Empty title blocks save: "Page slug and title are required." | negative | P1 | |
| PAGE-03 | Editing the `home` system page's "Hero headline" field persists and the field label reflects home-specific copy | positive | P2 | |
| PAGE-04 | Editing the `about` system page's "Studio introduction" field persists | positive | P2 | |
| PAGE-05 | The delete control is absent from the UI for `home` | positive | P1 | `!isProtectedPage(page.slug)` gate. |
| PAGE-06 | Calling `deletePageAction` directly for `slug: "home"` (bypassing the UI) is rejected server-side: "System pages cannot be deleted." | security | P1 | UI-level hiding isn't a security boundary by itself — must verify the server also refuses. Same for `about` and `manifesto`. |
| PAGE-07 | Deleting a non-protected custom page succeeds and its public URL 404s afterward | positive | P1 | |
| PAGE-08 | Filling the PT-translation fields persists them independently of the main content | positive | P3 | |
| PAGE-09 | Saving with all PT fields empty succeeds without error | positive | P3 | |
| PAGE-10 | Publish → Draft → Archive transitions update `status`/`visibility` correctly at each step | positive | P2 | |
| PAGE-11 | Slug auto-generates from the title while untouched | positive | P2 | |
| PAGE-12 | Uploading then removing a hero image round-trips correctly | edge | P3 | |

## 11. Videos (`e2e/admin-videos.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| VID-01 | Uploading a valid MP4 under 500MB to one slot succeeds via the direct-to-bucket presigned flow | positive | P1 | Requires a real or mocked S3-compatible endpoint; consider mocking `fetch` to `/admin/api/videos` and the bucket PUT for CI speed. |
| VID-02 | Uploading a valid WebM succeeds | positive | P2 | |
| VID-03 | Selecting files for multiple slots in one submit uploads and reports all of them (`"N videos uploaded"`) | positive | P2 | |
| VID-04 | Submitting with no file selected in any slot shows: "Choose at least one MP4 or WebM video to upload." | negative | P2 | Pure client-side check before any network call. |
| VID-05 | Selecting an unsupported format (e.g. `.mov`) is rejected | negative | P2 | `accept="video/mp4,video/webm"` plus server-side `VIDEO_TYPES` check — test the server rejection path, not just the file picker's `accept` filter. |
| VID-06 | A file over 500MB is rejected: "Video must be 500 MB or smaller." | negative | P2 | Can assert against the `/admin/api/videos` `prepare` action directly with a fabricated `sizeBytes` to avoid uploading a real 500MB+ fixture. |
| VID-07 | Mismatched actual object size/type vs. declared metadata at `complete` time is caught by the server's `HeadObjectCommand` verification | security | P3 | Hard to exercise end-to-end without a controllable bucket double; document as integration-only if not mockable. |
| VID-08 | Replacing an existing slot's video updates the preview and the stored URL | positive | P2 | |

## 12. Issues / QA scan (`e2e/admin-issues.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| ISS-01 | Running a scan on a clean catalog reports zero open/new problems | positive | P2 | |
| ISS-02 | A product with a broken image URL is flagged as an ERROR "... image is broken" | positive | P1 | Seed a product with a nonexistent local image path (`/uploads/...` that doesn't exist on disk). |
| ISS-03 | A non-archived product missing category/tags/collection is flagged with WARNING "Missing ..." for each | positive | P1 | Three independent assertions (category, tags, collection). |
| ISS-04 | An archived product missing a category is NOT flagged for taxonomy, but its broken images still are | edge | P2 | Two-part assertion distinguishing the archived-skip rule from the always-on media check. |
| ISS-05 | Re-running the scan after fixing a flagged issue (e.g. assigning a category) marks it `RESOLVED` and drops it from the open count | positive | P1 | |
| ISS-06 | Clicking "Open problem" navigates to the target entity's edit page with the right field anchored/focused | positive | P2 | Assert URL hash `#field-...` and that the element is scrolled into view. |
| ISS-07 | After deleting a category still assigned to products (CAT-07), a scan + issue link leads to the affected product's category field | positive | P2 | Cross-suite chain — can live in either spec, referenced from both. |
| ISS-08 | A new issue triggers an email notification when `RESEND_API_KEY`/`ADMIN_ISSUE_EMAIL_TO` are configured | positive | P3 | Needs an email-sending double; likely integration/manual-only. |
| ISS-09 | Scan completes normally with no email attempt when email env vars are absent | positive | P3 | Default CI state — assert no error surfaces in the UI. |

## 13. Account (`e2e/admin-account.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| ACC-01 | `/admin/account` shows the current session's username and an access badge | positive | P3 | |
| ACC-02 | Calling `updateAdminCredentialsAction` directly returns the "managed through environment variables" message and changes nothing | positive | P3 | No UI form exists for this — action-level test only. |

## 14. Cross-cutting & security (`e2e/admin-security.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| SEC-01 | A server action invoked after the session cookie is cleared is rejected / redirects to login | security | P1 | Clear cookies mid-session via `context.clearCookies()`, then attempt a mutating action. |
| SEC-02 | HTML/script injected into a text field (product name, page body, etc.) is rendered inert, not executed | security | P1 | `<script>alert(1)</script>` in a text field; assert on the storefront-rendered page that no dialog fires and the text is escaped in the DOM. |
| SEC-03 | A file named with a double extension or a mismatched MIME type is rejected by content sniffing, not filename | security | P2 | E.g. an executable renamed to `.jpg`; server validates via `sharp` decode + `file.type`, not the filename. |
| SEC-04 | Rapid repeated submit clicks don't create duplicate records (submit button disables while `isPending`) | edge | P2 | Assert only one record created; assert button `disabled` state during the transition. |
| SEC-05 | `POST /admin/api/videos` without a valid session returns `401` | security | P1 | Direct `request.post()` call bypassing the UI, with cookies cleared. |
| SEC-06 | Injection-style strings (`' OR 1=1 --`) in search/filter inputs return empty or literal-match results, no server error | security | P2 | Client-side filters mean this mostly just needs "doesn't crash the page," but worth a smoke check. |
| SEC-07 | Very long text field input (tens of thousands of characters) saves cleanly or fails gracefully, no page crash | edge | P3 | |

## 15. End-to-end lifecycle smoke tests (`e2e/admin-lifecycle.spec.ts`)

| ID | Scenario | Type | Priority | Notes |
|----|----------|------|----------|-------|
| E2E-01 | Full product lifecycle: create → fill characteristics/materials/lookbook → upload image → publish → verify on storefront → archive → verify removed from storefront → delete | positive | P1 | Good candidate for a single long serial test mirroring the `test.describe.configure({ mode: "serial" })` pattern already used in `admin-auth.spec.ts`. |
| E2E-02 | Full collection lifecycle with products: create collection → assign products to it → publish → delete collection → verify products remain but are unassigned → QA scan surfaces "Missing collection" | positive | P1 | |

---

## Open questions to confirm with the team before automating

These are places where the code's behavior is inferable but not 100%
unambiguous from static reading alone — worth a quick manual check (see the
matching manual test case) before locking in an assertion:

1. **PROD-C13 / slug collision on create**: creating a new product whose
   slug matches an existing one appears to `upsert` onto the existing row
   (`db.product.upsert({ where: { slug } })` when no `productId` is passed).
   Confirm whether this is intended "idempotent create" behavior or an
   unintended silent-overwrite footgun before asserting either way.
2. **PROD-C18 / COL-09 — removing the required image while keeping
   Published/required state**: confirm whether the form blocks the save,
   silently demotes to Draft, or allows saving with a null image while still
   marked Published.
3. **Autosave timing (PROD-C36, COL-10)**: `useDraftAutosave` debounces at
   `debounceMs = 700` by default (`components/admin/use-draft-autosave.ts`).
   Wait comfortably past that (e.g. poll/assert with a ~1.5s timeout rather
   than a bare `waitForTimeout(700)`) to avoid flakiness under CI load.
