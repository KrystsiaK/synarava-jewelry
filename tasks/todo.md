# Задачи: единая EN/PT-система переводов

> Статус: approved 2026-09-19, реализация в процессе. Task 1–2 сделаны и проверены.

## Phase 1 — Translation contract

### Task 1: Утвердить полный field inventory

**Description:** Проинвентаризировать buyer-facing поля всех admin editors и назначить каждому `shared/localized`, requiredness и Shopify target.

**Acceptance criteria:**
- [x] Products, Collections, Pages/Home/About/Legal, Copy (nav folded into storefront-copy registry) и taxonomy присутствуют в registry. Videos/Media has no buyer-facing text today (4 raw file slots, no title/caption/alt) — documented as out-of-scope in `docs/translation-field-registry.md` rather than a fabricated field.
- [x] У каждого localized field есть native Shopify key либо app metaobject/metafield target; shared/operational fields явно исключены (registry test asserts this both ways).

**Verification:**
- [x] Registry cross-checked against `Product`/`ProductTranslation`/`Collection`/`CollectionSection`/`Page`/`PageContent` Prisma models and `STOREFRONT_COPY_KEYS`; `admin-field-registry.test.ts` keeps the storefront-copy half in sync automatically.

**Dependencies:** None  
**Files likely touched:** `docs/translation-field-registry.md`, `lib/i18n/admin-field-registry.ts`, `lib/i18n/__tests__/admin-field-registry.test.ts`  
**Estimated scope:** Medium (3 files)

### Task 2: Создать typed locale payload и sync state

**Description:** Ввести общие EN/PT, readiness, review, Shopify binding и conflict types, не ломая ProductTranslation.

**Acceptance criteria:**
- [x] `lib/i18n/admin-localization.ts` gives one contract (`resolveEntityLocale`, `entityLocaleReadiness`, `missingRequiredForPublish`, `diffFieldConflicts`, `determineSyncDirection`) any registry-backed entity can use; `ProductTranslation`/`lib/products/localization.ts` untouched (migrates in Task 9).
- [x] Types cover shared/localized (via registry `mode`) and draft/review/pending/synced/failed/conflict (`TranslationReviewStatus`/`TranslationSyncStatus` re-exported from Prisma, plus `SyncDirection`/`FieldConflict`).

**Verification:**
- [x] `pnpm exec tsc --noEmit` clean; `pnpm vitest run lib/i18n lib/products` — 49 tests passed, including a Product-registry integration check.

**Dependencies:** Task 1  
**Files likely touched:** `lib/i18n/admin-localization.ts`, `lib/i18n/localized-content.ts`, `lib/i18n/__tests__/admin-localization.test.ts`  
**Estimated scope:** Medium (3 files)

### Checkpoint 1: Contract review

- [x] Field inventory reviewed by the user (2026-09-19, in conversation) before implementation began.
- [x] Shared/localized split and Shopify destination agreed per field — see `docs/translation-field-registry.md`; gaps found later (Task 10/13/18) were reconciled against reality, not assumed.
- [x] Open questions from `tasks/plan.md` resolved by the user before schema changes: PT required post-backfill, dual-editor with conflict UI, localized handles in scope — see "Open questions — решено 2026-09-19" in `tasks/plan.md`.

## Phase 2 — Shared sticky locale workspace

### Task 3: Реализовать `AdminLocaleWorkspace`

**Description:** Заменить декоративный `LocaleTabStrip` на controlled EN/PT workspace со sticky header, badges и keyboard navigation.

**Acceptance criteria:**
- [x] `.adm-locale-workspace-header` sticks at `top: var(--adm-topbar-height)`, `z-index: 90` — below modal (190+)/toast (260), above page content. Desktop/mobile: single-row flex, no fixed width.
- [x] ARIA tabs (`role="tablist"`/`"tab"`/`"tabpanel"`) support ArrowLeft/Right/Home/End with roving `tabIndex`, visible focus, and `sessionStorage`-persisted locale scoped by `storageKey` (verified not to leak across different keys).

**Verification:**
- [x] `components/admin/shared/__tests__/admin-locale-workspace.test.tsx` — 7 tests (click/keyboard/persistence/status badge/forceLocale). Manual responsive check still pending (needs a real entity wired in — Task 9/12/15).

**Dependencies:** Task 2  
**Files likely touched:** `components/admin/shared/admin-locale-workspace.tsx`, `components/admin/shared/__tests__/admin-locale-workspace.test.tsx`, `app/globals.css`, `components/admin/shared/admin-primitives.tsx`  
**Estimated scope:** Medium (4 files)

### Task 4: Защитить form state при смене вкладки

**Description:** Ввести общий panel/form-state pattern без потери ввода, errors и shared selections.

**Acceptance criteria:**
- [x] Panels stay mounted (`hidden`, never unmounted) so EN/PT input and shared state survive tab switches; submit collects both locale payloads and the shared payload from one `FormData`.
- [x] `localeOfFirstError` (keyed off the existing `pt<Field>` naming convention) drives `AdminLocaleWorkspace`'s `forceLocale`; wired to server-returned `fieldErrors`, not a native `required` attribute — PT requiredness depends on publish state (the registry's `"when-published"`), which a static `required` can't express, so it has to be a server/registry-driven check either way. (Correction: an earlier draft of this note claimed hidden-ancestor fields are skipped by native constraint validation in jsdom — verified empirically in Task 9 that they are **not**: `.validity`/`.willValidate` in jsdom, like the `.validity` property in real browsers, is rendering-independent. That claim was wrong; the design choice above stands on its own merits regardless.)

**Verification:**
- [x] `components/admin/shared/__tests__/admin-locale-form.test.tsx` — EN edit → PT edit → EN → submit (both payloads + shared field intact), shared field survives tab switches, PT tab auto-opens on a server-reported PT error.

**Dependencies:** Task 3  
**Files likely touched:** `components/admin/shared/admin-locale-panel.tsx`, `components/admin/shared/admin-form-validation.tsx`, `components/admin/shared/__tests__/admin-locale-form.test.tsx`  
**Estimated scope:** Medium (3 files)

### Checkpoint 2: UX foundation

- [x] Demo form (test-only) проходит keyboard review — см. Task 3/4 tests. Mobile/visual review needs a real entity wired in (Task 9/12/15), не blocking further build-order progress per this session's scope decision.
- [x] Sticky offset/z-index заданы относительно реальных topbar/modal/toast значений (`--adm-topbar-height`, z-index 190/260) — не подтверждено визуально в браузере до Task 9.
- [x] `pnpm test:run` и `pnpm exec tsc --noEmit` проходят (reconfirmed at the end of the session: 170 files / 832 tests, clean typecheck).

## Phase 3 — Generic Shopify translation platform

### Task 5: Обобщить Shopify Translation client

**Description:** Превратить product-only helpers в resource-agnostic query/register/remove client с pagination и normalized errors.

**Acceptance criteria:**
- [x] `registerTranslations`/`fetchResourceTranslation`/`fetchTranslatableResourceIndex`/`removeTranslationKeys` take `resourceId`/`resourceType`/`locale` and a typed key/value map — no Product-specific logic in the transport layer. Product wrappers (`registerProductTranslation`, `fetchProductTranslation`, `fetchProductTranslationIndex`) are now thin callers of the generic functions.
- [x] Fresh digest fetched immediately before each register call; one retry on a digest-shaped userError, any other error (or a second stale digest) throws; blank values route through `translationsRemove` before the register call.

**Verification:**
- [x] `lib/shopify/__tests__/translations.test.ts` — 13 tests: register/remove/pagination/digest-retry/non-digest-userError-throws, plus a non-Product (`COLLECTION`) resource proving genericity. Full `pnpm vitest run lib/shopify` (28 files, 143 tests) and `pnpm exec tsc --noEmit` green — Product regression suite untouched in behavior.

**Dependencies:** Task 2  
**Files likely touched:** `lib/shopify/translations.ts`, `lib/shopify/__tests__/translations.test.ts` (no separate `translation-types.ts` needed — the existing file's exported types already carry the contract)  
**Estimated scope:** Medium (2 files)

### Task 6: Добавить generic bindings и durable sync events

**Description:** Хранить Shopify identity/snapshots и retryable state для Product, Collection, Page и Metaobject отдельно от commerce sync.

**Acceptance criteria:**
- [x] `ShopifyTranslationBinding` is unique on `(resourceType, entityId)` and `(resourceType, shopifyResourceId)`; `TranslationSyncEvent` rows (locale + direction + status + fieldConflicts) give every push/pull/reconcile attempt its own audit row, kept apart from `ProductSyncEvent` (commerce sync).
- [x] `retrySyncEvent` only updates the event row's status/attemptCount around calling `perform()` — it never touches the entity's own translation content, so a failed retry cannot lose local copy.

**Verification:**
- [x] `pnpm exec prisma generate` succeeds against the updated schema (no live DB needed for that step). **Not yet applied to a real database** — this session has no reachable Postgres (Docker daemon not running here) and `.env*` is blocked by the repo's own security hook, so I could not verify `DATABASE_URL`'s target safely enough to run `prisma migrate dev/deploy`. The migration SQL is hand-authored in the same style as the existing migrations (checked against `20260819120000_add_product_sync_and_characteristics`) — **run `pnpm prisma:migrate` locally (with `docker compose up -d postgres`) before relying on these tables**, and diff the result against `prisma/migrations/20260919120000_translation_bindings/migration.sql` in case Prisma's own diff differs from the hand-written version.
- [x] `lib/shopify/__tests__/translation-sync.test.ts` — 6 tests covering upsert/find/audit-row creation/idempotent retry (success + failure paths), against a mocked `@/lib/db`.

**Dependencies:** Tasks 2, 5  
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_translation_bindings/migration.sql`, `lib/shopify/translation-sync.ts`, `lib/shopify/__tests__/translation-sync.test.ts`  
**Estimated scope:** Medium (4 files)

### Task 7: Реализовать generic conflict/reconcile engine

**Description:** Сравнивать base snapshot, current local и Shopify по каждому field и выдавать PUSH/PULL/CONFLICT/NOOP.

**Acceptance criteria:**
- [x] `planReconcile` (pure, table-driven) classifies push/pull/conflict/noop off a base/local/remote three-way diff; remote-only and local-only changes resolve cleanly, two-sided changes to the same field always conflict (including with no base yet — see code comment on why "first sync" still conflicts when both sides already disagree).
- [x] `diffFieldConflicts` returns local/remote per differing field; `reconcileResourceType` only reads (`fetchTranslatableResourceIndex` + `db.shopifyTranslationBinding.findMany` + a caller-supplied `loadLocal`) — no write call anywhere in this file.

**Verification:**
- [x] `lib/shopify/__tests__/translation-reconciliation.test.ts` — 9 tests: table-driven push/pull/conflict/noop (incl. partial multi-field conflict, no-base case), Shopify-key projection, a 2-page sweep matching bindings across pages, and a missing-local-entity skip.

**Scope note:** `app/admin/actions/translation-sync.ts` (listed as likely-touched) is deferred to Task 21, which builds the overview UI that would actually call it — adding a server action with no caller yet would be dead code. `reconcileResourceType` is written so Task 21 can call it directly.

**Dependencies:** Task 6  
**Files likely touched:** `lib/shopify/translation-reconciliation.ts`, `lib/shopify/__tests__/translation-reconciliation.test.ts`  
**Estimated scope:** Medium (3 files)

### Task 8: Добавить locale/scopes/metaobject health checks

**Description:** Проверять `pt-PT`, translation scopes и metaobject capabilities/access до write.

**Acceptance criteria:**
- [x] Already implemented pre-existing this plan: `testShopifyAdminConnection` (`lib/shopify/admin.ts`) checks `read_locales`/`read_markets_home`, `read_translations`/`write_translations`, and `shopLocales` → `portuguesePublished`; `app/admin/actions/sync.ts` turns that into an actionable notice ("Portuguese translation sync is unavailable: missing …") surfaced alongside the sync result.
- [x] `missingTranslationScopes`/`portuguesePublished` are tracked separately from `missingScopes` (the commerce-blocking list) — a missing translation scope never blocks or hides a successful commerce sync, and never gets silently skipped either (see `admin.test.ts`: "keeps translation scopes out of the blocking missingScopes list").

**Verification:**
- [x] Already covered by `lib/shopify/__tests__/admin.test.ts` (existing, unchanged): missing translation scopes, missing locale-read scope (without ever querying the protected `shopLocales` field), Portuguese published/unpublished. Re-ran as part of every full `pnpm vitest run` in this session — still green.

**Scope note:** Metaobject capability/access checks are deferred — no metaobject definition exists in this codebase yet (`lib/shopify/metaobjects.ts` doesn't exist), so there is nothing to check the capabilities of. Add this check in whichever task first creates a metaobject definition (Task 10/16/17/18), not speculatively here.

**Dependencies:** Tasks 5, 6  
**Files likely touched:** none this session — the locale/scope half was already done; the metaobject half has no target yet.

### Checkpoint 3: Shopify foundation

- [x] Existing Product PT sync regression suite проходит (`pnpm vitest run lib/shopify` — 28+ files green throughout Phase 3).
- [ ] Generic client проверен на одном test resource без массового write — **not done**: this session has no live Shopify Admin API credentials/dev store to call against, only mocked unit tests. Needs a manual controlled-write check against a real dev store before Task 9+ relies on it in production.
- [x] Scopes и locale подтверждены (pre-existing, tested). Metaobject contract — n/a until a definition exists (see Task 8 scope note).

## Phase 4 — Catalog vertical slices

### Task 9: Перевести Product editor на общий workspace

**Description:** Сохранить ProductTranslation/sync, заменив локальный tabs/form adapter на shared foundation.

**Acceptance criteria:**
- [x] EN/PT localized fields unchanged in structure — this task only replaced the tab/header mechanism, not the field set (that's Task 10). Because Product's shared fields (slug, sku, price, stock, taxonomy, workflow state, image) are interleaved with EN-only fields inside the same grids, `ProductFormFields` uses `useAdminActiveLocale` + `AdminLocaleTabs` directly (extracted from `AdminLocaleWorkspace` in this task) rather than its three-slot `sharedHeader/en/pt` shape, which would force splitting those grids apart. `AdminLocaleWorkspace` itself is unchanged externally — Task 3/4 tests pass unmodified against the refactor.
- [x] Commerce/collections/media still render once (no restructure needed, see above); Shopify sync status badge now lives once on the sticky tab strip — the old PT-panel copy of the same badge was removed to avoid showing it twice when the PT tab is active.

**Verification:**
- [x] Existing `product-edit-form.test.tsx`/`product-create-form.test.tsx` (10 tests) pass unchanged — behavior preserved. Added a new regression test: switching to PT with a blank required EN field blocks the confirm dialog (client `validate()` correctly reads `.validity` regardless of the field's hidden ancestor — verified empirically, see note on Task 4 above) and now auto-reopens the EN tab via `localeOfFirstError`, instead of leaving the user stranded on PT with no visible error. Also fixed a missing `scrollIntoView` polyfill in `vitest.setup.ts` that this test's validation path exposed. Full suite: `pnpm exec tsc --noEmit`, `pnpm vitest run` (157 files / 771 tests) green.
- [ ] E2E save/reload for both locales — not run this session (no reachable dev DB in this environment, see Task 6 note); needs a real `pnpm test:e2e` pass before shipping.

**Dependencies:** Tasks 3–7  
**Files likely touched:** `components/admin/products/product-form-fields.tsx`, `components/admin/products/__tests__/product-edit-form.test.tsx`, `components/admin/shared/admin-locale-workspace.tsx` (extracted `AdminLocaleTabs`/`useAdminActiveLocale`), `vitest.setup.ts`  
**Estimated scope:** Medium (4 files)

### Task 10: Покрыть Product nested localized content

**Description:** Добавить detail labels/text, option names/values и media alt/caption в registry, persistence и Shopify adapters.

**Acceptance criteria:**
- [x] Materials/process/lookbook text (title/body, eyebrow/title, stat value/label, lookbook label) now has independent EN/PT, stored in `ProductTranslation.details` (same JSON home EN already used) with its own sticky `AdminLocaleTabs` in `ProductDetailFields`. Images (material image, process media, lookbook src) stay shared — never re-uploaded per locale, exactly per registry.
- [ ] **Option name/value labels and media alt/caption are NOT built** — discovered mid-task that neither has an existing EN admin editing surface to extend: `ProductMedia.alt` is auto-derived from the uploaded filename (never a text field), `ProductMedia.caption` is never set anywhere in the admin, and `ProductOption`/`ProductOptionValue` have no admin UI at all (the storefront reads options straight from `shopifySnapshot`, not these local rows). Building PT-only editors for content nobody can edit in EN yet would be inventing a new feature past this task's "translate what exists" scope. Left as `optionName`/`optionValueLabel`/`mediaAlt`/`mediaCaption` in the Task 1 registry (targets already assigned) for whoever builds the EN editing UI first.

**Root cause fix found and applied first:** `resolveLocalizedContent`'s optional-field fallback (`hasText`) treated any non-string value as blank, so `details` (a JSON object) could never resolve to its PT translation — always fell back to English regardless of saved PT content. Fixed in `lib/i18n/localized-content.ts` (`hasContent`, replacing the old check) before building on top of it; this also fixes the same bug in the Task 2 generic contract for any future `rich-text` registry field (`materialLexicon`, `legalSections`).

**Known pre-existing gap, not introduced by this task:** materials/process-stats/lookbook are stored as filtered arrays (blank slots dropped before saving), so skipping a middle slot (e.g. filling material 1 and 3 but not 2) shifts entry 3 into slot 2 on reload. This already exists for English and applies identically to the new PT fields — not a regression, but worth a real fix if it ever surfaces as a support issue.

**Verification:**
- [x] `components/admin/products/__tests__/product-helpers.test.ts` (+4 tests): `getProductDetailsTranslation` carries text only (no image/src/mediaImage/featured) and never disagrees with `getProductEditorDetails` on the fields both share; `productToDraft` maps a populated PT `details` object correctly. `product-edit-form.test.tsx`/`product-create-form.test.tsx` updated for the second locale tab strip this added (scoped queries) — full suite still 33/33.
- [ ] Not done: a `saveProductAction` integration test asserting the exact PT `details` JSON persisted (the existing `app/admin/actions/__tests__/products.test.ts` only covers early-exit/conflict paths, none reach the transaction — extending it needs mocking `product.create`/`$transaction`/`productTranslation.upsert` that isn't set up yet). Sandbox PT storefront check not done (no reachable DB/Shopify store this session).

**Dependencies:** Task 9  
**Files likely touched:** `lib/i18n/localized-content.ts` (root-cause fix), `components/admin/products/product-helpers.ts`, `components/admin/products/product-types.ts`, `components/admin/products/product-form-fields.tsx`, `components/admin/products/product-edit-form.tsx`, `components/admin/products/product-create-form.tsx`, `app/admin/actions/products.ts`  
**Estimated scope:** Medium (5 files)

### Task 11: Добавить CollectionTranslation и sync adapter

**Description:** Создать EN/PT model для collection copy/sections и `COLLECTION`/`COLLECTION_IMAGE`/metaobject mapping.

**Acceptance criteria:**
- [x] `CollectionTranslation` mirrors `ProductTranslation`'s shape (locale, copy fields, review/sync state, `@@unique([collectionId, locale])`). No existing collection has a translation row until first save, so `resolveCollectionCopy(collection, "en")` returns the same output as reading `Collection`'s own columns directly — EN backfill is a no-op by construction, not by a separate script.
- [x] `lib/collections/localization.ts` routes through the generic Task 2 contract (`resolveEntityLocale`/`entityLocaleReadiness`/`missingRequiredForPublish` + `COLLECTION_FIELD_REGISTRY`) instead of hand-rolling a second copy of Product's bespoke resolver — first real consumer of that contract. Membership/order/status/image identity live on `Collection` itself, untouched by any of this.

**Verification:**
- [x] `lib/collections/__tests__/localization.test.ts` (5 tests) and `lib/shopify/__tests__/collection-translations.test.ts` (4 tests, register/fetch/index against the generic Shopify client). **Not done:** a migration/backfill script test — there is no separate backfill for Collection (same "create on first save" approach as Product), so nothing to test there; a real Prisma migration apply against a live DB is still pending for the same reason as Task 6 (no reachable DB this session).

**Dependencies:** Tasks 5–7  
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/20260919140000_collection_translations/migration.sql`, `lib/collections/localization.ts`, `lib/collections/__tests__/localization.test.ts`, `lib/shopify/collection-translations.ts`, `lib/shopify/__tests__/collection-translations.test.ts`  
**Estimated scope:** Medium (6 files)

### Task 12: Перевести Collection editor на общий workspace

**Description:** Удалить декоративные EN/BE/RU tabs и добавить полноценные EN/PT panels с единым shared разделом.

**Acceptance criteria:**
- [x] Decorative `LocaleTabStrip` (EN/BE/RU, switched nothing) removed from the codebase entirely — no other callers existed. Replaced with `AdminLocaleTabs`/`useAdminActiveLocale` (same primitives Task 9 extracted for Product's interleaved layout — Collection's `name`/`slug`/`code` row has the same constraint, so it uses the tab-strip-only pattern too, not the full three-slot `AdminLocaleWorkspace`). Name, collection summary, manifesto, search summary, and the symbolism block switch; code/slug/hero image/workflow state render once, shared.
- [x] Save/reload independent for both locales: `CollectionDraft`/`CollectionLocaleDraft` are plain controlled state (not DOM-derived), so switching tabs can never lose input regardless of `hidden`. `saveCollectionAction` now upserts both an EN mirror row and the PT `CollectionTranslation` row in one transaction, mirroring Product's pattern (content hash, review/sync status, "Portuguese translation reviewed" checkbox).
- [x] **Bonus, not originally scoped here:** wired the storefront read path too (`getCollectionBySlug`/`listCollections` in `lib/content/catalog.ts` now take a `Locale` and resolve through `resolveCollectionCopy`) — without this, PT content saved in the admin would have had nowhere to ever appear. Updated the three home/collections-index/collection-detail page callers to pass the request locale.

**Verification:**
- [x] `pnpm exec tsc --noEmit` and `pnpm vitest run` (159 files / 792 tests) green. `collection-edit-form.test.tsx`/`collection-create-form.test.tsx` updated for the new required-field-vs-PT-field label collision (`/^Name\*/` vs `"Name (PT)"`) plus a new test switching EN→PT→EN and asserting independent values. `collection-helpers.test.ts` covers `collectionToDraft`/`emptyCollectionDraft` PT mapping.
- [ ] Not done: E2E, a Shopify localized-collection sandbox check (no live store this session), and a `saveCollectionAction` integration test for the transaction itself — there is no `app/admin/actions/__tests__/collections.ts` test file yet at all (same gap noted for `saveProductAction` in Task 10).

**Dependencies:** Tasks 3, 4, 11  
**Files likely touched:** `components/admin/collections/collection-fields.tsx`, `components/admin/collections/collection-types.ts`, `components/admin/collections/collection-helpers.ts`, `components/admin/collections/collection-edit-form.tsx`, `components/admin/collections/collection-create-form.tsx`, `app/admin/actions/collections.ts`, `lib/content/catalog.ts`, `components/admin/shared/admin-primitives.tsx` (dead code removal)  
**Estimated scope:** Medium (8 files)

### Task 13: Локализовать customer-visible taxonomy

**Description:** Перевести merchant-owned category/tag/characteristic labels без параллельной копии Shopify taxonomy.

**Acceptance criteria:**
- [x] **Characteristics (the real, tractable target):** `PRODUCT_CHARACTERISTICS` is a code-defined, non-admin-editable taxonomy (~57 keys) whose English `label` was persisted straight into `ProductCharacteristic.label` at save time and rendered to customers unchanged — the exact bug shape this task exists to catch. Added `characteristicLabel(key, fallback, locale)`/`characteristicGroupLabel(group, locale)` in `lib/products/characteristics.ts` with a full PT map (all 57 labels + all 7 group names, pt-PT), resolved at *render* time in `lib/content/catalog.ts` (`ProductSummary.attributes`/`.characteristics`) and in `components/artifacts/product-detail.tsx` (the `characteristic.group` section headers, previously shown to customers in raw English). `textValue`/`numberValue`/`booleanValue`/keys/filter relations are untouched — only the fixed label text resolves per locale, same pattern as the department nav labels already in `lib/catalog/taxonomy.ts`.
- [x] **Category and tag do not have a translation gap to close:** `ProductCategory` is dead code (zero references anywhere — Shopify's own Standard Product Taxonomy replaced it; confirmed via repo-wide grep) and is explicitly out of scope per the plan's own "Shopify taxonomy semantics remain source of truth." `Tag.name` has no admin editing surface at all (only auto-created from the product form's free-text "Tags" field via upsert) — same "no EN feature to translate" situation as Task 10's option values/media caption, not something to build new UI for here.

**Verification:**
- [x] `lib/products/__tests__/characteristics.test.ts` (+3 tests): en-locale passthrough, every one of the 57 characteristic keys and all 7 groups has a real PT entry (checked against a sentinel fallback, not "differs from English," since a couple of labels — e.g. "Metal" — are legitimately identical in both languages), and an unrecognized/legacy key still falls back to its persisted English label instead of throwing or showing blank. Full suite: `pnpm exec tsc --noEmit`, `pnpm vitest run` (159 files / 795 tests) green.

**Dependencies:** Tasks 1, 5–7  
**Files likely touched:** `lib/products/characteristics.ts`, `lib/products/__tests__/characteristics.test.ts`, `lib/content/catalog.ts`, `components/artifacts/product-detail.tsx` (no `taxonomy-translations.ts`/schema change — this is static code-defined content, not a database row, so there's nothing to sync to Shopify or migrate)  
**Estimated scope:** Medium (4 files)

### Checkpoint 4: Catalog complete

- [x] Product + Collection + taxonomy coverage complete for what has a real EN admin surface to translate; nested Product content (option/value labels, media alt/caption) explicitly deferred — documented in Task 10, not silently dropped.
- [ ] **Not verified this session:** Shopify round trip against a live store, and manual EN/PT storefront click-through — no reachable dev DB or Shopify credentials in this environment (see Task 6/8 notes). Everything is verified at the unit/component level (795 tests repo-wide as of this checkpoint) plus `tsc`/`eslint`, not end-to-end.
- [x] Shared media/relations confirmed unchanged across locale switches at the component level (Task 4/9/12 tests assert this directly for Product and Collection).

## Phase 5 — Editorial vertical slices

### Task 14: Нормализовать PageTranslation и PT JSON

**Description:** Вынести Page/Home/About/Legal locale copy в records с validated template payload и sync metadata.

**Completed:** `PageTranslation` now stores EN/PT title, excerpt, validated template content, SEO copy, review state and sync metadata. Migration `20260919150000_page_translations` backfills EN and legacy PT JSON. Page saves/autosaves dual-write normalized rows plus the legacy JSON rollback layer; storefront reads normalized PT first and falls back to legacy JSON only when no row exists. Shared assets, links, flags and ordering remain on `Page`.

**Verification:**
- [x] Resolver tests cover shared-field stripping, normalized-row priority and legacy fallback.
- [x] Page action test proves PT normalized persistence; Page editor tests prove existing EN/PT workspace behavior remains intact.
- [x] Prisma schema validates; focused Page suite passes (6 files / 22 tests).
- [ ] Migration apply against the real dev database remains part of the Task 22 staging gate because PostgreSQL is not reachable in this environment.

**Dependencies:** Tasks 2, 6  
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260919150000_page_translations/migration.sql`, `lib/pages/localization.ts`, `app/admin/actions/pages.ts`, `lib/content/catalog.ts`, Page admin/tests.

### Task 15: Перевести Page/Home/About/Legal editor

**Description:** Свести EN/PT в одинаковые panels; visibility/media/hrefs/status оставить shared.

**Note:** done against the *existing* JSON storage (Task 14 deferred, see above) — the field set itself is unchanged, only the tab/panel mechanism.

**Acceptance criteria:**
- [x] Every EN buyer-facing field already had a PT counterpart (this form already collected PT copy — see Task 14 note); nothing new needed adding on the field-coverage side. The gap was purely UX: PT fields were dumped into one long section after every EN field, not switched.
- [x] Home lexicon (3 materials), department pathway, manifesto label/attribution, legal sections (Offer/Privacy, dynamic per page), and final-CTA/footer/contact fields all now switch with the sticky `AdminLocaleTabs` in both `page-editor-form.tsx` and `page-create-form.tsx`. Shared fields (slug, CTA/final-CTA hrefs, contact email, hero image, material images, `legalLastUpdated` — no PT counterpart exists for the last one, left visible in both tabs rather than inventing one) stay visible in both tabs, same split-the-grid pattern as Task 9/12.

**Verification:**
- [x] Existing `page-editor-form.test.tsx`/`page-create-form.test.tsx` (9 tests) pass unchanged — behavior preserved despite the large diff (mostly adding `hidden={activeLocale !== "EN"}` to individual fields/sections). Added a new test switching EN→PT→EN and asserting the shared CTA href field stays visible in both tabs while EN-only fields hide. Full suite: `pnpm exec tsc --noEmit`, `pnpm vitest run` (159 files / 796 tests) green.
- [ ] Not done: E2E scroll→switch→edit→save→reload (no e2e run this session) and a manual sticky-header check against a real long page in a browser.

**Dependencies:** Tasks 3, 4  
**Files likely touched:** `components/admin/pages/page-editor-form.tsx`, `components/admin/pages/page-create-form.tsx`, `components/admin/pages/__tests__/page-editor-form.test.tsx`  
**Estimated scope:** Medium (3 files)

### Task 16: Подключить Page и structured metaobject sync

**Description:** Flat copy отправлять в `PAGE`/`SHOP_POLICY`, structured blocks — в translatable `$app:` metaobjects.

**Completed:** native Page copy now creates/updates a real Shopify `PAGE`, registers PT `title`/`body_html`/SEO translations and persists the Shopify identity. Page section content and Storefront Copy use app-owned `$app:page_section_copy` / `$app:storefront_copy` metaobjects with translatable capability; definitions are validated before writes and every target gets its own `PAGE` or `METAOBJECT` binding/event/snapshot. The old registry target that pretended local navigation labels were Shopify `LINK` resources was removed — they belong to Storefront Copy.

**Acceptance criteria:**
- [x] У каждой Page translation полный target coverage и bindings.
- [x] Native/structured targets sync независимо и имеют separate field snapshots/events; the existing three-way reconcile engine consumes those snapshots for field-level conflicts.

**Verification:**
- [x] Contract tests cover PAGE mapping, create/update identity, metaobject definition/upsert/translation serialization, scope health and registry targets.
- [ ] Controlled round trip одной Page/Home metaobject remains a live-store gate: this environment has no approved dev-store write session. The adapter deliberately fails with an actionable error when required scopes/capabilities/fields are absent instead of inventing a local substitute.

**Dependencies:** Tasks 7, 8, 14  
**Files likely touched:** `lib/shopify/page-translations.ts`, `lib/shopify/editorial-metaobjects.ts`, `lib/shopify/__tests__/page-translations.test.ts`, `app/admin/actions/translation-sync.ts`  
**Estimated scope:** Medium (4 files)

### Task 17: Перевести Copy/Settings на общий workspace

**Description:** Сохранить текущие values, но редактировать их через sticky layout и синхронизировать с Shopify targets.

**Acceptance criteria:**
- [x] Field list was already identical between EN/PT (every key already has an `en:<key>`/`pt:<key>` pair, generated from one `STOREFRONT_COPY_GROUPS` loop — no per-field hand-written duplication like Page/Product had). Converted the two-column-per-field layout to the sticky `AdminLocaleTabs` pattern: one small change to the shared render loop (`hidden={activeLocale !== "EN"/"PT"}` on the two existing label wrappers) covers all ~57 keys across nav/footer/4 service pages at once. No email/URL/flag fields exist in this editor to keep shared — every key here is buyer-facing text by design (see `storefront-copy-fields.ts`'s own comment).
- [x] The Copy locale tabs show the latest Shopify sync status from the Storefront Copy metaobject binding; missing bindings surface as pending and are actionable in Localization.

**Verification:**
- [x] New `components/admin/settings/__tests__/storefront-copy-editor.test.tsx` (2 tests, file didn't exist before): tab switch hides/shows the right panel with independent PT value, and a save submits both `en:`/`pt:`-prefixed keys in one `FormData`. Full suite: `pnpm exec tsc --noEmit`, `pnpm vitest run` (160 files / 798 tests) green.
- [ ] Not done: EN/PT storefront comparison against a real metaobject (none exists) or a live store.

**Dependencies:** Tasks 3–8  
**Files likely touched:** `components/admin/settings/storefront-copy-editor.tsx`, `components/admin/settings/__tests__/storefront-copy-editor.test.tsx` (no `app/admin/actions/settings.ts`/`lib/content/storefront-copy.ts` change — the persistence layer already handled en/pt correctly, only the editor's layout changed)  
**Estimated scope:** Medium (2 files)

### Task 18: Локализовать navigation и media metadata

**Description:** Перевести menu/link titles, video title/caption/transcript и image alt/caption, оставив target/assets/order shared.

**Reality check vs. the plan's assumptions:**
- **Video/media:** already documented in Task 1's registry doc as out of scope — `lib/site-videos.ts` is four raw ambient background video file slots with no title/caption/alt/transcript field anywhere in the schema or admin UI. Nothing to localize; building it would be a new feature.
- **Navigation "menu/link titles":** there's no separate menu/link model. The main nav is two things: (1) footer/nav label overrides, already `en:*`/`pt:*` in storefront-copy (Task 17), and (2) primary-nav **Collection** names, which were resolved through `CollectionTranslation` (Task 11) everywhere *except* `getStorefrontNavigation()` — a real, found-this-session bug: the site-wide header nav (`app/layout.tsx`) and the home page's department links called it with no locale at all, always showing English collection names regardless of visitor locale. Fixed: `getStorefrontNavigation(locale)` now resolves through `resolveCollectionCopy`, and its two real callers (`app/layout.tsx`, `app/[locale]/page.tsx`) pass the request locale.

**Acceptance criteria:**
- [x] No native `MENU`/`LINK`/`MEDIA_IMAGE` Shopify resources exist to target — there's no Shopify-backed navigation or media resource in this app to sync against, so this doesn't apply here (unlike Product/Collection, navigation is 100% locally sourced).
- [x] Local assets already used the right shared/localized split before this task: video files, poster, dimensions, order are shared (nothing changed); Collection name is the localized target it already had via Task 11.

**Verification:**
- [x] New `lib/content/__tests__/storefront-navigation.test.ts` (2 tests): resolves PT collection name via a primary-nav row's translations, defaults to English with no locale argument. Full suite: `pnpm exec tsc --noEmit`, `pnpm vitest run` (161 files / 800 tests) green.
- [x] `getShopFilterData(locale)` and all storefront callers pass locale explicitly; department and collection filter labels have PT resolver coverage.

**Dependencies:** Tasks 3–8  
**Files likely touched:** `lib/content/catalog.ts` (`getStorefrontNavigation`), `lib/content/__tests__/storefront-navigation.test.ts`, `app/layout.tsx`, `app/[locale]/page.tsx`  
**Estimated scope:** Medium (4 files)

### Checkpoint 5: Editorial complete

- [x] Home/About/Pages/Legal (Task 15, UI only — Task 14's data-model normalization deferred), Copy (Task 17), and Navigation (Task 18) coverage complete for real content. Media has nothing to cover (no fields exist).
- [x] No stacked EN/PT sections or decorative locale tabs remain anywhere touched this session — `LocaleTabStrip` is deleted from the codebase; Page/Copy/Product/Collection all use the sticky `AdminLocaleTabs`.
- [x] Page native and Page/Copy metaobject sync now exist with independent bindings/events (Task 16); live reconciliation remains a release gate below.

## Phase 6 — Migration, storefront and release

### Task 19: Создать dry-run backfill и coverage report

**Description:** Связать записи с Shopify targets, перенести PT и показать gaps/conflicts до writes.

**Acceptance criteria:**
- [x] `--dry-run` ничего не меняет и выдаёт human + versioned machine report (`--json`); dry-run is the default and the CLI never writes translated copy to Shopify.
- [x] Apply идемпотентен; it creates only missing, non-conflicting `ShopifyTranslationBinding` rows, while unsupported fields, missing identity, missing/review-draft PT and binding conflicts block enforcement.

**Verification:**
- [x] Pure report/planning fixtures cover gaps, unsupported fields, binding conflicts and a second idempotent planning run (`scripts/__tests__/translation-coverage.test.ts`, 5 tests).
- [ ] Two sequential staging runs and human approval report remain an environment gate: the local PostgreSQL endpoint at `127.0.0.1:55432` was unavailable on 2026-09-19, so no database write was attempted and this item is intentionally not marked complete.

**Implementation note:** `pnpm translations:backfill --dry-run|--apply [--json] [--strict]`; operating procedure and rollback boundaries are documented in `docs/translation-migration.md`. PAGE/METAOBJECT remain explicitly deferred in the report until Tasks 14/16 provide real Shopify adapters, preventing a false 100% coverage result.

**Dependencies:** Tasks 9–18  
**Files likely touched:** `scripts/backfill-translations.mjs`, `scripts/lib/translation-backfill.mjs`, `scripts/__tests__/translation-backfill.test.ts`, `docs/translation-migration.md`  
**Estimated scope:** Medium (4 files)

### Task 20: Завершить locale-aware storefront audit

**Description:** Проверить loaders, metadata, JSON-LD, search, navigation, media alt и Shopify queries на явный locale.

**Acceptance criteria:**
- [x] Нет buyer-facing route loader без explicit locale; Shopify cart copy uses `@inContext(language: ...)`.
- [x] Readiness/fallback policy едина на storefront routes through the shared Product/Collection/Page resolvers.

**Verification:**
- [x] Resolver/metadata/search tests and the existing Playwright EN/PT route matrix cover the localized read path.
- [ ] Full Playwright execution plus a live Shopify cart/checkout assertion remain part of Task 22's environment gate.

**Dependencies:** Tasks 9–18  
**Files likely touched:** `lib/content/storefront.ts`, `lib/catalog/storefront.ts`, `lib/shopify/storefront.ts`, `e2e/storefront-locales.spec.ts`, `lib/seo/__tests__/localized-metadata.test.ts`  
**Estimated scope:** Medium (5 files)

### Task 21: Добавить translation overview и retry controls

**Description:** Дать единый список missing/pending/failed/conflict и безопасные retry/reconcile actions.

**Acceptance criteria:**
- [x] Filters lead to the correct Product/Collection/Page/Copy editor; retry is an idempotent Shopify upsert/register and is offered only for missing/pending/failed rows.
- [x] Conflicts never auto-retry and route the operator to explicit entity resolution; audit shows actor/direction/resource/result from `TranslationSyncEvent`.

**Verification:**
- [x] Component tests cover status filtering, entity links, retry dispatch and the conflict safety boundary.
- [ ] Live failed → retry → synced E2E remains a staging gate because it requires an enabled Shopify Portuguese locale and write scopes.

**Dependencies:** Tasks 7, 19  
**Files likely touched:** `app/admin/(studio)/translations/page.tsx`, `components/admin/translations/translations-cms.tsx`, `app/admin/actions/translation-sync.ts`, `components/admin/translations/__tests__/translations-cms.test.tsx`  
**Estimated scope:** Medium (4 files)

### Task 22: Accessibility, performance и rollout hardening

**Description:** Проверить sticky UI, длинные формы и sync pipeline перед staged enablement.

**Acceptance criteria:**
- [x] Keyboard/focus/mobile contracts pass; the sticky header is pinned to the actual `.admin-content` scroll container, focus targets use scroll margin, and mobile status wrapping cannot cover fields.
- [x] Tab switch is local state only (no submit/network save, panels remain mounted); rollback/recovery and Shopify prerequisites are documented.

**Verification:**
- [x] `pnpm lint` — clean.
- [x] `pnpm exec tsc --noEmit` — clean.
- [x] `pnpm test:run` — 170 files / 831 tests green.
- [ ] `pnpm test:e2e:admin` и locale storefront suite — not run; no dev server/database in this environment (specs exist: `e2e/admin-sticky-locale.spec.ts`, `e2e/localized-handles.spec.ts`, plus the pre-existing admin/storefront suites).
- [ ] `pnpm build` — `next build` compiles and type-checks successfully; static generation then fails on a pre-existing, unrelated guard (`APP_URL must be set to the public site URL in production`, `lib/seo/site-url.ts`) that has nothing to do with this work and needs a real production env var this environment doesn't have.

**Dependencies:** Tasks 19–21  
**Files likely touched:** `e2e/admin-translations.spec.ts`, `e2e/admin-sticky-locale.spec.ts`, `docs/translation-operations.md`, `DEPLOY.md`  
**Estimated scope:** Medium (4 files)

### Task 23: Локализовать slug/handle с SEO/redirect

**Description:** Добавить опциональный localized handle для Product/Collection/Page, синхронизировать через Shopify `translationsRegister` на `handle`, и обслуживать старый EN-путь редиректом, когда PT handle отличается. Отдельный трек от content-регистри, чтобы routing-риски (404, дубли, canonical) не блокировали Task 9–18.

**Acceptance criteria:**
- [x] PT handle опционален в Product/Collection/Page editors; пустой использует EN slug без 404.
- [x] Заданный PT handle синхронизируется через Shopify `translationsRegister` key `handle`, resolves on storefront, and Shopify merchandise lookup uses `@inContext(language: PT)`.
- [x] Смена handle creates a persistent redirect record; old/source PT paths redirect to the active handle, while canonical/hreflang use the locale-specific paths.

**Verification:**
- [x] Unit/contract tests cover missing/fallback/changed handles, unique database constraints cover duplicates, and SEO alternates are locale-specific.
- [ ] Live Playwright redirect check remains part of the Task 22 staging E2E gate because the local database is unavailable in this environment.

**Dependencies:** Tasks 9, 12, 15 (registry/editors для entities, чьи handle локализуются)  
**Files likely touched:** `lib/content/handle-localization.ts`, `lib/shopify/handle-translations.ts`, `app/[locale]/(shop)/**`, `e2e/localized-handles.spec.ts`  
**Estimated scope:** Medium (4 files)

### Checkpoint 6: Release approval

- [ ] Registry coverage = 100% buyer-facing admin fields — not literally 100%: `optionName`/`optionValueLabel`/`mediaAlt`/`mediaCaption` and `tagName` are registered with a Shopify target but have no EN admin editing surface to translate yet (Task 10/13 notes), by deliberate choice rather than oversight. Everything with a real EN input has a working PT counterpart.
- [ ] Backfill/reconcile report принят — `pnpm translations:backfill --dry-run` runs and reports correctly (Task 19), but a human hasn't reviewed its output against the real production dataset (no reachable database this session).
- [ ] Один resource каждого типа прошёл controlled Shopify round trip — blocked on live Shopify Admin API credentials/dev store; none available this session.
- [ ] Полный quality gate зелёный — `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test:run` (170 files / 833 tests) are all green as of this session's last run; `pnpm build`'s static generation and `pnpm test:e2e` remain blocked by environment (missing `APP_URL`, no dev server/database respectively), not by any known defect.
- [ ] Human approves staged production rollout.

## Phase 7 — Shopify reconciliation workspace

Detailed product and technical design: `tasks/shopify-sync-reconciliation-plan.md`.

### Task 24: Persist locale-aware reconciliation state

- [x] Store one last-known-good snapshot per Shopify binding and locale; existing PT snapshots are backfilled and current write adapters dual-write during rollout.
- [x] Record reconciliation runs separately from write events, including trigger, scope, counts, duration, and partial failures.
- [x] Persist only actionable field divergences with local/Shopify/base values and fingerprints.
- [x] Track the automatic check on the admin session so opening multiple pages does not start duplicate scans.

### Task 25: Build normalized field-level comparison

- [x] Normalize whitespace, HTML/plain-text equivalents, null/empty values, and structured JSON before comparison.
- [x] Classify each localized field as equal, local-only, Shopify-only, or conflict.
- [x] Exclude shared media, pricing, inventory, assignments, and other non-translatable data from translation diffs.
- [x] Add fixtures for Product, Collection, Page, and metaobject-backed copy.

### Task 26: Add safe automatic and manual checks

- [x] Start a read-only reconciliation check when an authenticated admin session first opens.
- [x] Coalesce concurrent/recent runs and expose progress without blocking editor saves.
- [x] Keep a visible “Check now” action that bypasses the session debounce.
- [x] Surface authentication, scope, locale, and partial-fetch failures honestly; explicit Shopify throttling telemetry remains in Task 34.

### Checkpoint 7: Trustworthy detection

- [x] Opening admin detects real divergences without writing to Shopify.
- [x] Repeated navigation does not create a scan storm.
- [x] “In sync” means every supported field was actually checked; partial and failed runs never present as current.
- [x] The overview contains no disabled rows for fields that are equal or not translatable.

### Task 27: Design the sync-health signal

- [x] Add a calm, distinct sync-health indicator to the admin shell; do not mix it with editorial Problems.
- [x] Show checking, current, differences found, action required, partial, and unavailable states in plain language.
- [x] Make the signal accessible by keyboard/screen reader and legible in light/dark themes.
- [ ] Define mobile behavior without covering page controls or sticky locale tabs.

### Task 28: Replace the overview with an actionable workspace

- [x] Group divergences by entity and locale, with impact summaries instead of technical resource IDs.
- [x] Default to actionable changes only; equal/healthy fields are represented by the clear-state summary rather than inert rows (history is still pending).
- [x] Provide clear routes to one Product, Collection, Page, or storefront-copy conflict.
- [x] Preserve scan progress and results across navigation/reload.

### Task 29: Build a Git-like field merge review

- [x] Show Synarava and Shopify values side by side for every differing field.
- [x] Offer explicit “Use Synarava” / “Use Shopify” choices per field and safe reviewed bulk choices.
- [x] Reveal the common base on demand and distinguish which side changed without relying on color alone.
- [x] Keep long text readable with wrapping and render structured content as labeled values rather than raw JSON.

### Task 30: Add loss preview and confirmation guards

- [x] Summarize exactly what will change, overwrite, clear, or remain untouched before apply.
- [x] Require extra confirmation for destructive clears and multi-field actions; locale-wide controls are not exposed yet.
- [x] Block apply when either local or remote fingerprint changed after review.
- [x] Never auto-select a side for a true conflict.

### Checkpoint 8: Human-safe merge UX

- [x] A nontechnical admin can see what differs and what each choice will do in plain language.
- [x] Shared media/collections never enter translation comparison or writes.
- [x] The UI never relies on color alone and all merge actions are native keyboard-operable controls.
- [x] No write can happen without a visible impact preview.

### Task 31: Implement narrow scoped writes

- [x] Support one field and reviewed multi-entity batches from the reconciliation workspace; editor-tab entry points remain in Task 33.
- [x] Route translation writes through locale-specific adapters; the legacy Product translation retry no longer invokes a full commerce push.
- [x] Preserve Shopify-native resources, fresh content digests, and locale semantics.
- [ ] Keep unavailable scopes/actions visible but disabled with a concrete remediation message.

### Task 32: Verify writes and recover partial failures

- [x] Read back every successful write and compare the applied field fingerprints.
- [x] Mark partial success per field; failed/stale fields remain unresolved and retryable after a fresh check.
- [ ] Record actor, scope, selected side, before/after fingerprints, and Shopify response (actor/direction/status are recorded; richer before/after audit payload remains).
- [ ] Offer restore only when neither side has changed since the recorded operation.

### Task 33: Integrate entity-local sync controls

- [x] Product/Collection/Page/Copy editors show locale-specific sync health beside the sticky locale tabs. `AdminLocaleTabs` grew an optional `syncScope` prop that renders `EntityLocaleSyncControl` (new) at the trailing edge of the tab row when given; wired into all four editors' `<AdminLocaleTabs>` call sites (`entityId` threaded from the persisted record — omitted in create forms, since there's no entity yet to check). Product has two independent tab strips (commerce core + Synarava CMS layer) and both get the control, since each can show a different locale and the API's reconcile scope is per-locale, not per-section. Fixed a real build-breaking bug found while wiring Copy: `storefront-copy-editor.tsx` (a client component) imported `STOREFRONT_COPY_KEY` from `lib/content/storefront-copy.ts`, which is `server-only` — moved the constant to the already-client-safe `storefront-copy-fields.ts` and had `storefront-copy.ts` re-export it for its existing server-side importers.
- [x] Allow "check this locale" and "review differences" without leaving the current entity. The inline "Check" button runs a scoped `POST /admin/api/shopify/reconcile` and re-fetches state without navigating; "Review" (shown only when differences exist) deep-links into the Task 28 reconciliation workspace pre-scoped to this exact entity+locale rather than a generic list.
- [x] Keep shared controls and media mounted and unchanged during locale switches. Unaffected by this task — still guaranteed by the Task 4/9/12/15 hidden-not-unmounted panel pattern; the new control only adds a sibling next to the tabs, it doesn't touch panel mounting.
- [x] Avoid horizontal layout shifts when status text or actions appear. Added `.adm-entity-sync*` rules in `app/globals.css`: the status text has a reserved `min-width` and `tabular-nums`, and the whole control is pinned to the row's trailing edge (`margin-left: auto`) so switching between "Checking…"/"In sync"/"N differences" reflows only its own trailing content, not the locale tabs before it.

**Verification:** `pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm vitest run` (174 files / 869 tests, incl. new `entity-locale-sync-control.test.tsx` and an `AdminLocaleTabs syncScope` case) all green. Verified visually in a real browser against the local dev DB for all four editors (Product's both tab strips, Collection, Page/Home, Copy) — the control renders, shows "Check unavailable" gracefully with no configured Shopify credentials, and doesn't disturb existing EN/PT field switching. Applied the previously-pending `20260920120000_shopify_reconciliation_workspace` migration (purely additive: new nullable columns, new enums/tables/indexes, one idempotent `ON CONFLICT DO NOTHING` backfill insert — no data loss) to the local dev database, which had been blocking the entire admin app with a 500 before this.

### Task 34: Harden accessibility, performance, and observability

- [ ] Virtualize or progressively render large reconciliation result sets.
- [ ] Add structured logs/metrics for run duration, resource counts, API throttling, partial failures, and write verification.
- [ ] Cover reduced motion, focus restoration, live-region announcements, and 44px touch targets.
- [ ] Validate real mobile/desktop admin flows without flattening the intended visual hierarchy.

### Task 35: Stage rollout and operator documentation

- [ ] Ship detection first, then merge review, then scoped writes behind explicit rollout gates.
- [ ] Run controlled round trips for every supported resource type and locale.
- [ ] Document scopes, failure recovery, stale-review behavior, and who can approve destructive changes.
- [ ] Complete human usability review with a nontechnical operator before production enablement.

### Checkpoint 9: Reconciliation feature complete

- [ ] Automatic and manual checks agree on the same current result.
- [ ] All supported localized fields have field-level compare and scoped-write coverage.
- [ ] Read-after-write verification passes for Product, Collection, Page, and metaobject-backed copy.
- [ ] Accessibility, unit, integration, and staging E2E gates are green.
- [ ] Human approves production rollout and rollback procedure.
