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

- [ ] Field inventory просмотрен человеком.
- [ ] Shared/localized и Shopify destination согласованы для каждого поля.
- [ ] Open questions из `tasks/plan.md` решены до schema changes.

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
- [ ] `pnpm test:run` и `pnpm exec tsc --noEmit` проходят.

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
- [ ] Merchant labels имеют EN/PT и target; canonical IDs/filter keys/relations shared.
- [ ] Shopify taxonomy semantics остаются source of truth.

**Verification:**
- [ ] Resolver/filter/search tests и manual EN/PT catalog check.

**Dependencies:** Tasks 1, 5–7  
**Files likely touched:** `prisma/schema.prisma`, `lib/catalog/taxonomy.ts`, `lib/products/characteristics.ts`, `lib/shopify/taxonomy-translations.ts`, `lib/catalog/__tests__/taxonomy.test.ts`  
**Estimated scope:** Medium (5 files)

### Checkpoint 4: Catalog complete

- [ ] Product + Collection + nested/taxonomy coverage = 100%.
- [ ] Admin, Shopify round trip и storefront EN/PT проверены.
- [ ] Shared media/relations не меняются при locale switch.

## Phase 5 — Editorial vertical slices

### Task 14: Нормализовать PageTranslation и PT JSON

**Description:** Вынести Page/Home/About/Legal locale copy в records с validated template payload и sync metadata.

**Acceptance criteria:**
- [ ] EN/PT backfill идемпотентен; Home/Legal payload валидируется.
- [ ] Dual-read безопасен, новые writes идут в новую model.

**Verification:**
- [ ] Migration fixtures для Home/About/custom/Offer/Privacy; storefront output equivalent.

**Dependencies:** Tasks 2, 6  
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_page_translations/migration.sql`, `components/admin/pages/page-types.ts`, `lib/content/page-localization.ts`, `lib/content/__tests__/page-localization.test.ts`  
**Estimated scope:** Medium (5 files)

### Task 15: Перевести Page/Home/About/Legal editor

**Description:** Свести EN/PT в одинаковые panels; visibility/media/hrefs/status оставить shared.

**Acceptance criteria:**
- [ ] Каждый EN buyer-facing field имеет PT counterpart по registry.
- [ ] Home lexicon/manifesto/footer и legal sections не пропущены; sticky tabs работают на длинной форме.

**Verification:**
- [ ] Template component tests; E2E scroll → switch → edit → save → reload.

**Dependencies:** Tasks 3, 4, 14  
**Files likely touched:** `components/admin/pages/page-editor-form.tsx`, `components/admin/pages/page-create-form.tsx`, `app/admin/actions/pages.ts`, `components/admin/pages/__tests__/page-editor-form.test.tsx`  
**Estimated scope:** Medium (4 files)

### Task 16: Подключить Page и structured metaobject sync

**Description:** Flat copy отправлять в `PAGE`/`SHOP_POLICY`, structured blocks — в translatable `$app:` metaobjects.

**Acceptance criteria:**
- [ ] У каждой Page translation полный target coverage и bindings.
- [ ] Native/structured targets sync независимо и имеют field-level conflicts.

**Verification:**
- [ ] Contract tests и controlled round trip одной Page/Home metaobject.

**Dependencies:** Tasks 7, 8, 14  
**Files likely touched:** `lib/shopify/page-translations.ts`, `lib/shopify/editorial-metaobjects.ts`, `lib/shopify/__tests__/page-translations.test.ts`, `app/admin/actions/translation-sync.ts`  
**Estimated scope:** Medium (4 files)

### Task 17: Перевести Copy/Settings на общий workspace

**Description:** Сохранить текущие values, но редактировать их через sticky layout и синхронизировать с Shopify targets.

**Acceptance criteria:**
- [ ] Одинаковый field list в EN/PT; email/URLs/flags shared.
- [ ] Missing PT и sync status видны на tabs/overview.

**Verification:**
- [ ] Component test и EN/PT storefront/metaobject comparison.

**Dependencies:** Tasks 3–8  
**Files likely touched:** `components/admin/settings/storefront-copy-editor.tsx`, `app/admin/actions/settings.ts`, `lib/content/storefront-copy.ts`, `components/admin/settings/__tests__/storefront-copy-editor.test.tsx`  
**Estimated scope:** Medium (4 files)

### Task 18: Локализовать navigation и media metadata

**Description:** Перевести menu/link titles, video title/caption/transcript и image alt/caption, оставив target/assets/order shared.

**Acceptance criteria:**
- [ ] Native MENU/LINK/MEDIA_IMAGE используются при наличии Shopify resources.
- [ ] Local assets используют translatable metaobject target; URL/file/placement shared.

**Verification:**
- [ ] Adapter/component tests и manual EN/PT menu/media accessibility check.

**Dependencies:** Tasks 3–8  
**Files likely touched:** `components/admin/site-videos/site-videos-cms.tsx`, `app/admin/actions/videos.ts`, `lib/shopify/navigation-translations.ts`, `lib/shopify/media-translations.ts`, `lib/shopify/__tests__/media-translations.test.ts`  
**Estimated scope:** Medium (5 files)

### Checkpoint 5: Editorial complete

- [ ] Home, About, Pages, Legal, Copy, Navigation и Media coverage = 100%.
- [ ] Нет stacked EN/PT sections или декоративных locale tabs.
- [ ] Native resources и metaobjects reconcile успешно.

## Phase 6 — Migration, storefront and release

### Task 19: Создать dry-run backfill и coverage report

**Description:** Связать записи с Shopify targets, перенести PT и показать gaps/conflicts до writes.

**Acceptance criteria:**
- [ ] `--dry-run` ничего не меняет и выдаёт human + machine report.
- [ ] Apply идемпотентен; unsupported/missing identity блокирует enforcement.

**Verification:**
- [ ] Script fixtures и два последовательных staging runs; human approval report.

**Dependencies:** Tasks 9–18  
**Files likely touched:** `scripts/backfill-translations.mjs`, `scripts/lib/translation-backfill.mjs`, `scripts/__tests__/translation-backfill.test.ts`, `docs/translation-migration.md`  
**Estimated scope:** Medium (4 files)

### Task 20: Завершить locale-aware storefront audit

**Description:** Проверить loaders, metadata, JSON-LD, search, navigation, media alt и Shopify queries на явный locale.

**Acceptance criteria:**
- [ ] Нет buyer-facing loader без locale; Shopify uses `@inContext(language: ...)`.
- [ ] Readiness/fallback policy едина на всех storefront routes.

**Verification:**
- [ ] Resolver/metadata/search tests; Playwright EN/PT matrix и cart/checkout assertion.

**Dependencies:** Tasks 9–18  
**Files likely touched:** `lib/content/storefront.ts`, `lib/catalog/storefront.ts`, `lib/shopify/storefront.ts`, `e2e/storefront-locales.spec.ts`, `lib/seo/__tests__/localized-metadata.test.ts`  
**Estimated scope:** Medium (5 files)

### Task 21: Добавить translation overview и retry controls

**Description:** Дать единый список missing/pending/failed/conflict и безопасные retry/reconcile actions.

**Acceptance criteria:**
- [ ] Фильтры ведут к нужной entity/locale; retry идемпотентен.
- [ ] Conflict требует выбора; audit показывает actor/direction/resource/result.

**Verification:**
- [ ] Action/component tests и E2E failed → retry → synced.

**Dependencies:** Tasks 7, 19  
**Files likely touched:** `app/admin/(studio)/translations/page.tsx`, `components/admin/translations/translations-cms.tsx`, `app/admin/actions/translation-sync.ts`, `components/admin/translations/__tests__/translations-cms.test.tsx`  
**Estimated scope:** Medium (4 files)

### Task 22: Accessibility, performance и rollout hardening

**Description:** Проверить sticky UI, длинные формы и sync pipeline перед staged enablement.

**Acceptance criteria:**
- [ ] Keyboard/focus/mobile проходят; header не перекрывает content и не вызывает layout shift.
- [ ] Tab switch не делает network save/дорогой full-form rerender; rollback/recovery документированы.

**Verification:**
- [ ] `pnpm lint`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm test:run`
- [ ] `pnpm test:e2e:admin` и locale storefront suite
- [ ] `pnpm build`

**Dependencies:** Tasks 19–21  
**Files likely touched:** `e2e/admin-translations.spec.ts`, `e2e/admin-sticky-locale.spec.ts`, `docs/translation-operations.md`, `DEPLOY.md`  
**Estimated scope:** Medium (4 files)

### Task 23: Локализовать slug/handle с SEO/redirect

**Description:** Добавить опциональный localized handle для Product/Collection/Page, синхронизировать через Shopify `translationsRegister` на `handle`, и обслуживать старый EN-путь редиректом, когда PT handle отличается. Отдельный трек от content-регистри, чтобы routing-риски (404, дубли, canonical) не блокировали Task 9–18.

**Acceptance criteria:**
- [ ] PT handle опционален; пустой — использует EN slug (без 404).
- [ ] Заданный PT handle синхронизируется с Shopify (`PRODUCT`/`COLLECTION` handle translation) и резолвится на storefront по `pt-PT` контексту.
- [ ] Смена handle создаёт redirect с старого пути, canonical/hreflang указывают на активный handle на верном locale.

**Verification:**
- [ ] Route resolver tests (missing/duplicate/changed handle); Playwright redirect check EN→PT и наоборот.

**Dependencies:** Tasks 9, 12, 15 (registry/editors для entities, чьи handle локализуются)  
**Files likely touched:** `lib/content/handle-localization.ts`, `lib/shopify/handle-translations.ts`, `app/[locale]/(shop)/**`, `e2e/localized-handles.spec.ts`  
**Estimated scope:** Medium (4 files)

### Checkpoint 6: Release approval

- [ ] Registry coverage = 100% buyer-facing admin fields.
- [ ] Backfill/reconcile report принят.
- [ ] Один resource каждого типа прошёл controlled Shopify round trip.
- [ ] Полный quality gate зелёный.
- [ ] Human approves staged production rollout.
