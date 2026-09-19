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
- [ ] Header sticky под topbar на desktop/mobile и не перекрывает modal/toast.
- [ ] ARIA tabs поддерживают Arrow/Home/End, focus и session-persisted locale.

**Verification:**
- [ ] Component accessibility/keyboard tests и manual responsive check.

**Dependencies:** Task 2  
**Files likely touched:** `components/admin/shared/admin-locale-workspace.tsx`, `components/admin/shared/__tests__/admin-locale-workspace.test.tsx`, `app/globals.css`, `components/admin/shared/admin-primitives.tsx`  
**Estimated scope:** Medium (4 files)

### Task 4: Защитить form state при смене вкладки

**Description:** Ввести общий panel/form-state pattern без потери ввода, errors и shared selections.

**Acceptance criteria:**
- [ ] EN/PT ввод переживает переключения, submit содержит обе locale payloads и один shared payload.
- [ ] Validation автоматически открывает locale первой ошибки.

**Verification:**
- [ ] Integration test: EN edit → PT edit → EN → submit; media/collection remain shared.

**Dependencies:** Task 3  
**Files likely touched:** `components/admin/shared/admin-locale-panel.tsx`, `components/admin/shared/admin-form-validation.tsx`, `components/admin/shared/__tests__/admin-locale-form.test.tsx`  
**Estimated scope:** Medium (3 files)

### Checkpoint 2: UX foundation

- [ ] Demo form проходит keyboard/mobile review.
- [ ] Sticky проверен с topbar, toast и modal.
- [ ] `pnpm test:run` и `pnpm exec tsc --noEmit` проходят.

## Phase 3 — Generic Shopify translation platform

### Task 5: Обобщить Shopify Translation client

**Description:** Превратить product-only helpers в resource-agnostic query/register/remove client с pagination и normalized errors.

**Acceptance criteria:**
- [ ] Client принимает resource ID/type, locale и typed key/value map.
- [ ] Fresh digest обязателен; stale digest получает один refetch/retry; blank использует `translationsRemove`.

**Verification:**
- [ ] Unit tests register/remove/pagination/digest/userErrors; Product regression tests зелёные.

**Dependencies:** Task 2  
**Files likely touched:** `lib/shopify/translations.ts`, `lib/shopify/translation-types.ts`, `lib/shopify/__tests__/translations.test.ts`  
**Estimated scope:** Medium (3 files)

### Task 6: Добавить generic bindings и durable sync events

**Description:** Хранить Shopify identity/snapshots и retryable state для Product, Collection, Page и Metaobject отдельно от commerce sync.

**Acceptance criteria:**
- [ ] Binding уникален по local entity/Shopify target; каждое направление имеет event/audit trail.
- [ ] Failed event повторяется идемпотентно без потери local copy.

**Verification:**
- [ ] Prisma migration на clean/existing DB; state-transition tests.

**Dependencies:** Tasks 2, 5  
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_translation_bindings/migration.sql`, `lib/shopify/translation-sync.ts`, `lib/shopify/__tests__/translation-sync.test.ts`  
**Estimated scope:** Medium (4 files)

### Task 7: Реализовать generic conflict/reconcile engine

**Description:** Сравнивать base snapshot, current local и Shopify по каждому field и выдавать PUSH/PULL/CONFLICT/NOOP.

**Acceptance criteria:**
- [ ] Remote-only, local-only и two-sided edits определяются детерминированно.
- [ ] Conflict хранит field-level local/remote; dry reconcile ничего не пишет.

**Verification:**
- [ ] Table-driven tests, включая partial multi-field conflict и pagination.

**Dependencies:** Task 6  
**Files likely touched:** `lib/shopify/translation-reconciliation.ts`, `lib/shopify/__tests__/translation-reconciliation.test.ts`, `app/admin/actions/translation-sync.ts`  
**Estimated scope:** Medium (3 files)

### Task 8: Добавить locale/scopes/metaobject health checks

**Description:** Проверять `pt-PT`, translation scopes и metaobject capabilities/access до write.

**Acceptance criteria:**
- [ ] Admin показывает actionable причины disabled sync.
- [ ] Missing locale/scope/definition не маскируется commerce success.

**Verification:**
- [ ] Unit tests missing scope/locale/definition/capability; manual dev-store check.

**Dependencies:** Tasks 5, 6  
**Files likely touched:** `lib/shopify/admin.ts`, `lib/shopify/metaobjects.ts`, `lib/shopify/__tests__/admin.test.ts`, `components/admin/account/shopify-connection-panel.tsx`  
**Estimated scope:** Medium (4 files)

### Checkpoint 3: Shopify foundation

- [ ] Existing Product PT sync regression suite проходит.
- [ ] Generic client проверен на одном test resource без массового write.
- [ ] Scopes, locale и metaobject contract подтверждены.

## Phase 4 — Catalog vertical slices

### Task 9: Перевести Product editor на общий workspace

**Description:** Сохранить ProductTranslation/sync, заменив локальный tabs/form adapter на shared foundation.

**Acceptance criteria:**
- [ ] EN/PT имеют одинаковую структуру localized fields.
- [ ] Commerce, collections и media assets показаны один раз; statuses/conflict actions сохранены.

**Verification:**
- [ ] Product component tests и E2E save/reload обеих локалей/shared selections.

**Dependencies:** Tasks 3–7  
**Files likely touched:** `components/admin/products/product-form-fields.tsx`, `components/admin/products/product-types.ts`, `components/admin/products/__tests__/product-edit-form.test.tsx`, `app/admin/actions/products.ts`  
**Estimated scope:** Medium (4 files)

### Task 10: Покрыть Product nested localized content

**Description:** Добавить detail labels/text, option names/values и media alt/caption в registry, persistence и Shopify adapters.

**Acceptance criteria:**
- [ ] Все buyer-facing nested поля имеют EN/PT; assets/order остаются shared.
- [ ] Options/values/media используют native Shopify IDs, где доступны.

**Verification:**
- [ ] Adapter tests и sandbox PT storefront check.

**Dependencies:** Task 9  
**Files likely touched:** `prisma/schema.prisma`, `app/admin/actions/products.ts`, `components/admin/products/product-form-fields.tsx`, `lib/shopify/product-sync.ts`, `lib/shopify/__tests__/product-sync.test.ts`  
**Estimated scope:** Medium (5 files)

### Task 11: Добавить CollectionTranslation и sync adapter

**Description:** Создать EN/PT model для collection copy/sections и `COLLECTION`/`COLLECTION_IMAGE`/metaobject mapping.

**Acceptance criteria:**
- [ ] Existing EN backfill не меняет storefront output; PT имеет review/sync state.
- [ ] Membership/order/status/image identity не дублируются.

**Verification:**
- [ ] Migration/backfill/adapter tests; membership regression tests зелёные.

**Dependencies:** Tasks 5–7  
**Files likely touched:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_collection_translations/migration.sql`, `lib/collections/localization.ts`, `lib/shopify/collection-translations.ts`, `lib/shopify/__tests__/collection-translations.test.ts`  
**Estimated scope:** Medium (5 files)

### Task 12: Перевести Collection editor на общий workspace

**Description:** Удалить декоративные EN/BE/RU tabs и добавить полноценные EN/PT panels с единым shared разделом.

**Acceptance criteria:**
- [ ] Copy/symbolism/sections/SEO переключаются; code/slug/image/membership/workflow shared.
- [ ] Save/reload и validation независимы для обеих локалей.

**Verification:**
- [ ] Create/edit tests, E2E и Shopify localized collection check.

**Dependencies:** Tasks 3, 4, 11  
**Files likely touched:** `components/admin/collections/collection-fields.tsx`, `components/admin/collections/collection-types.ts`, `app/admin/actions/collections.ts`, `components/admin/collections/__tests__/collection-edit-form.test.tsx`  
**Estimated scope:** Medium (4 files)

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
