
# План: универсальная локализация и Shopify Markets

## Статус

Предложен 2026-09-21. Этот план **не заменяет** текущий `tasks/plan.md` и не
закрывает его EN/PT-задачи. Он описывает следующий архитектурный этап: убрать
предположение, что в магазине всегда только English и Portuguese, и сделать
новые языки конфигурацией данных, а не изменением схемы и исходного кода.

## Цель

После завершения добавление языка (например, German) требует только:

1. включить и опубликовать язык в Shopify Markets;
2. синхронизировать его в Synarava Admin и выбрать стабильный URL-сегмент;
3. заполнить или импортировать переводы и пройти review.

Добавление языка не требует изменения Prisma enum, TypeScript union, регулярных
выражений маршрутизации, формы товара/страницы/коллекции или Shopify adapter.

## Зафиксированные решения

### Shopify — источник правды для commerce locales

`shopLocales` определяет, какие переводы вообще допустимы в Shopify. Synarava
хранит локальную проекцию этого списка для маршрутизации, редакторов,
readiness и SEO. Локальная запись не может сделать commerce locale доступной,
если Shopify не вернул его как enabled/published.

### Реестр локалей

Вводится `StorefrontLocale` со следующими полями:

| Поле | Назначение |
|---|---|
| `code` | стабильный внутренний код, например `en`, `pt`, `ru` |
| `routeSegment` | URL-сегмент, например `pt`; уникален и не меняется молча |
| `shopifyLocale` | BCP-47 код Shopify, например `pt-PT` или `ru` |
| `intlLocale` | код для `Intl`, например `pt-PT` |
| `name` / `nativeName` | подписи для admin и language switcher |
| `isDefault`, `isPublished`, `sortOrder` | публичное состояние и порядок |
| `shopifyUpdatedAt` | дата последней синхронизации с Shopify |

EN остаётся source locale. Для совместимости существующие canonical URLs
сохраняются: Portuguese продолжает использовать `/pt`, хотя Shopify locale —
`pt-PT`.

### Переводы — произвольные locale codes, не PostgreSQL enum

Все поля `locale`, которые сейчас используют `ContentLocale`, становятся
строковыми кодами реестра с ограничением длины и внешним ключом там, где это
возможно. Новая миграция конвертирует существующие `EN`/`PT` записи в `en`/`pt`
и создаёт записи реестра. После неё добавление `ru` или другого языка не
требует миграции базы.

### Один locale-agnostic payload для Admin

Новые и мигрированные формы используют:

```ts
type LocalizedDraft<T> = {
  source: T;
  translations: Record<string, Partial<T>>;
  localeState: Record<string, LocaleSyncState>;
};
```

`AdminLocaleWorkspace` получает список locale из реестра и рендерит tabs
динамически. Никаких полей вида `ptTitle`, `ptHandle`, `portugueseReviewed` или
условий `locale === "pt"` в новых путях быть не должно.

### Единый источник buyer-facing UI copy

`messages/en.json` остаётся встроенным английским аварийным fallback. Все
ключи интерфейса, включая nav, footer, cart, формы, service и legal copy,
получают translation rows / locale-keyed copy в CMS. Для нового языка сразу
показывается EN fallback, но admin отображает его как неполный перевод.

### Shopify translation sync обрабатывает список локалей

Generic transport уже принимает locale. Product, Collection, Page, Metaobject
и Storefront Copy adapters должны вызывать его для каждого опубликованного
non-default locale из реестра. Sync states, snapshots, conflicts и retry
хранятся по `(resource, locale)`, не по специальному PT-полю.

## Миграционная стратегия

1. Добавить реестр и новые string locale columns/additive relations, не удаляя
   EN/PT чтение.
2. Backfill: создать `en` и `pt`; конвертировать enum-значения; сверить row
   counts и unique constraints.
3. Перевести readers на реестр + dual-read, writers — на новые locale payloads.
4. Перевести один vertical slice полностью: Product → storefront → Shopify
   push/pull → admin UI.
5. Повторить для Collection, Page, Storefront Copy и service/legal content.
6. Включить RU через реестр и Shopify; провести dry-run/backfill/reconcile.
7. После стабильного периода удалить legacy PT-only code и enum.

Ни один шаг не должен удалять перевод, binding, snapshot или audit event.
Rollback выключает writes для locale/resource, но сохраняет данные.

## План задач

### Phase 1 — Locale registry and routing foundation

#### Task U1: Создать locale registry и Shopify sync

**Acceptance criteria:**

- [x] `StorefrontLocale` хранит EN/PT и любую новую locale без schema change.
  Additive migration `20260921150000_storefront_locale_registry` (applied
  via `prisma migrate deploy`, not `migrate dev` — the local DB has
  unrelated pre-existing drift from legacy tables that made `migrate dev`
  want to reset it; hand-written SQL avoided that). Backfills `en`/`pt` as
  registry rows.
- [x] Shopify `shopLocales` synchronizes enabled/published state without
  overwriting a manually approved `routeSegment`. `lib/shopify/storefront-locale-sync.ts`
  matches registry rows to Shopify locales by `shopifyLocale` (case-insensitive),
  only ever writes `isPublished`/`shopifyUpdatedAt`, never creates rows for
  an unmatched Shopify locale (surfaced as `unmatched`, needs an operator to
  choose a `routeSegment`), and marks a row `orphaned`/unpublished if Shopify
  stops reporting its locale. Verified live against the real dev store
  (2026-09-21): "Check Shopify" on `/admin/translations` refreshed both
  rows' "Last checked" timestamps with EN/PT still Published, `routeSegment`
  unchanged.
- [x] Admin показывает Shopify locale, publication state и конфликт segment.
  `LocaleRegistryPanel` on `/admin/translations` ("Localization" in the
  sidebar) lists code/route/Shopify locale/published/last-checked per row
  and surfaces `findDuplicateRouteSegments`/`findEnglishSourceViolation` as
  inline alerts.

**Verification:** unit tests for BCP-47 validation, Shopify projection,
segment uniqueness and EN source invariant — `lib/i18n/__tests__/bcp47.test.ts`,
`lib/i18n/__tests__/storefront-locale-registry.test.ts`,
`lib/shopify/__tests__/storefront-locale-sync.test.ts` (15 tests). Full
suite green: `pnpm exec tsc --noEmit`, `pnpm exec eslint`, `pnpm vitest run`
(181 files / 900 tests).

#### Task U2: Сделать routing и SEO registry-driven

**Acceptance criteria:**

- [x] Proxy, `[locale]` layout, sitemap, alternates derive public locales
  from the registry (`lib/i18n/storefront-locale-cache.ts`, a 30s-TTL
  in-memory cache in front of the registry — `proxy.ts` runs in the Node
  runtime here, not Edge, confirmed empirically, so it can read the DB
  directly, but every request still shouldn't hit Postgres). Language
  switcher is registry-aware but intersected with `SUPPORTED_LOCALES`
  (buyer-facing UI copy is still hardcoded until Task U6) — see note below.
  Revalidation (`lib/content/revalidate-storefront.ts`) deliberately left
  on `SUPPORTED_LOCALES`: it revalidates rendered content templates, which
  are still EN/PT-only until Task U3, so widening it now would be a no-op
  change with real ripple cost (called from many admin actions).
- [x] `/en` and `/pt` keep their current canonical behavior — unchanged
  redirect codes (308 no cookie / 307 cookie), CSP headers, admin-cookie
  handling; verified via the full proxy test suite and live curl.
- [x] Unknown/disabled locale returns 404; bare paths still redirect to the
  default or valid cookie locale. A registered-but-unpublished locale
  (e.g. `ru` if it were unpublished) passes through proxy and gets a real
  `notFound()` in `[locale]/layout.tsx`, not a redirect loop; an
  unregistered segment (e.g. `/de`) is treated as a bare path and
  redirects with the default locale prepended, 404ing naturally.

**Note — language switcher scope:** did not widen it to show every
published registry locale. `ru` is published in Shopify but the storefront
UI copy (`messages/en.json`/`pt.json`, `TranslationProvider`) is still
hardcoded to EN/PT — showing "Russian" as a switcher option today would let
a customer pick it and see English, before Task U6 gives it a real fallback
story. Verified live: switcher shows English/Português only; `/ru` and
`/ru/shop` are still directly reachable (200, `lang="en"`, correct
fallback semantics) for anyone who lands there via a link or the
now-registry-driven sitemap/alternates.

**Verification:** proxy tests (`__tests__/proxy.test.ts`, 11 tests,
`@/lib/db` mocked — registry, cookie validity, unpublished vs. unregistered
segments, DB-unreachable fallback), `lib/i18n/__tests__/storefront-locale-cache.test.ts`
(6 tests: TTL reuse, invalidation, stale-on-error fallback),
`app/[locale]/__tests__/layout.test.tsx` (4 tests: generateStaticParams,
published/unpublished/unregistered notFound), plus the existing
`localized-page-metadata.test.ts` updated for async `buildAlternates`.
Live-verified against the real dev store: `/en`, `/pt` unchanged; `/ru` and
`/ru/shop` return 200; `/de` 308-redirects to `/en/de` which 404s; a
`synarava-locale=ru` cookie 307-redirects `/shop` → `/ru/shop` (ru is
published); sitemap.xml includes `ru` alternates; language switcher shows
only English/Português. Full suite green: `pnpm exec tsc --noEmit`,
`pnpm exec eslint .`, `pnpm vitest run` (183 files / 917 tests).

**Risk:** Proxy is on the request path. Cache registry reads with bounded TTL
and explicit invalidation; do not query Shopify during a request.

### Phase 2 — Generic persistence and admin contract

#### Task U3: Replace two-value persistence safely

**Acceptance criteria:**

- [x] Product/Collection/Page translations, localized-handle redirects,
  sync events and snapshots use registry locale codes. `ContentLocale`
  enum dropped from the schema; `CollectionTranslation`, `ProductTranslation`,
  `PageTranslation`, `LocalizedHandleRedirect`, `TranslationSyncEvent`
  all take a plain `String` locale now, lowercase ("en"/"pt") to match the
  registry's `code`. Every persisted-value read/write across
  `lib/content/catalog.ts`, `lib/products/localization.ts`,
  `lib/collections/localization.ts`, the Shopify sync adapters
  (`reconciliation-source.ts`, `reconciliation-apply.ts`,
  `editorial-translation-sync.ts`, `product-sync.ts`), the admin actions
  (products/collections/pages.ts, translation-sync.ts) and the backfill
  scripts was swept from the old uppercase enum values to the registry
  codes — `storefrontLocaleToContentLocale()` (storefront→persisted) and
  the uppercase branch of `contentLocaleForShopify()` (Shopify→persisted)
  are gone/lowercased, since the persisted value *is* the storefront/registry
  code now. `findLocalizedHandleRedirect`/`recordLocalizedHandleRedirect`
  gained an explicit `locale` param instead of hardcoding `"PT"`.
  Deliberately **not** touched: the admin editors' own UI tab state
  (`useAdminActiveLocale(..., "EN")`, `AdminLocaleTabs` visibility) and
  `Page.content.translations.pt` (dead legacy JSON, pre-dates
  `PageTranslation`) — both are UI/legacy concerns, not persistence, and
  belong to Task U4 or nowhere at all.
- [x] Migration preserves all EN/PT records and their unique indexes.
  `20260921170000_content_locale_to_string`: `ALTER COLUMN ... TYPE TEXT
  USING lower(locale::TEXT)` per table, additive only. Before/after count
  report against the real dev DB: `PageTranslation` 11 EN + 7 PT,
  `ProductTranslation` 10 EN + 1 PT before → identical counts after, now
  lowercase (`CollectionTranslation`/`LocalizedHandleRedirect`/`TranslationSyncEvent`
  were empty in this DB). Applied via `migrate deploy`, not `migrate dev`,
  same reason as Task U1.
- [x] New locale insertion requires no Prisma migration — confirmed by
  Task U1's `ru` row: no schema change was needed to route `/ru`.

**Verification:** before/after row-count report above stands in for a
migration test (no fixture-DB harness exists in this repo to run one
against; this ran against the real dev DB with a real snapshot instead).
`prisma generate` clean. Full suite green: `pnpm exec tsc --noEmit`,
`pnpm exec eslint .`, `pnpm vitest run` (183 files / 916 tests — 16 test
fixtures across products/collections/pages localization, admin action, and
Shopify sync tests updated from uppercase to lowercase locale literals to
match). Live-verified: admin product editor's PT tab still loads the
migrated translation ("Colar Turquesa AXIS"), readiness badges (EN 100% /
PT 100%) still compute correctly, and `/pt/products/axis-turquoise-necklace`
still resolves the Portuguese title end to end.

#### Task U4: Replace EN/PT form payloads with dynamic locale drafts

**Status: done (2026-09-22).**
Right after fixing a production outage caused by an earlier task's Next.js
rendering assumption, a full rewrite of the Product/Collection/Page save
actions (real commerce data, ~4900 lines across 7 files) didn't feel like
the right thing to do carelessly in one sitting. Did the tab mechanism
first, then took Collection all the way through as the proof this pattern
actually holds on live commerce data, then Product — the largest and
riskiest of the three (commerce fields, a nested materials/process/lookbook
`details` JSON, a second save path for autosaved drafts, and Shopify
sync-status bookkeeping) — then Page, the last of the three editors.

- [x] `AdminLocaleTabs`/`useAdminActiveLocale` render every locale in a
  passed-in list as ARIA tabs — `AdminLocale` widened from a closed
  `"EN" | "PT"` union to `string`, `LOCALE_TABS` is no longer a hardcoded
  module constant. Proven generic with a live 3-tab (en/pt/ru) test, not
  just "still shows 2 by default." `AdminLocaleWorkspace` (the 3-slot
  `en`/`pt` wrapper) turned out to be unused by any real editor — every
  actual consumer (Product, Collection, Page, Storefront Copy) already used
  `AdminLocaleTabs` directly — so it was left as the one EN/PT-named
  convenience shape it actually is, not force-generalized for no caller.
- [x] Switching tabs never loses unsaved values — unchanged from before
  (already true), not re-verified beyond the existing test coverage.
- [x] **Collection editor** — fully N-locale, `pt*` fields gone entirely:
  `CollectionDraft.pt` → `translations: Record<string, CollectionLocaleDraft>`;
  `collection-fields.tsx` renders every registry translation locale off
  `translationLocales`, not a hardcoded PT panel; new
  `lib/i18n/admin-locale-fields.ts` (`adminLocaleFieldName`/`readLocaleField`)
  gives every editor a shared, locale-agnostic FormData naming scheme
  instead of each one growing its own `pt*` convention; new
  `lib/i18n/admin-translation-locales.ts` (`getAdminTranslationLocales()`)
  reads every non-default registered locale from `StorefrontLocale`, not a
  hardcoded pair; `saveCollectionAction` builds one upsert per locale via
  `.map()` over that list inside a single `db.$transaction`, replacing the
  old fixed EN+PT upsert pair.
- [x] **Product editor** — fully N-locale, `pt*` fields gone entirely:
  `ProductDraft.pt` → `translations: Record<string, ProductLocaleDraft>`;
  `product-form-fields.tsx`'s two independent tab strips (commerce/copy
  and the extended materials/process/lookbook `details` section) both
  render every registry translation locale, using the same
  `adminLocaleFieldName`/`getAdminTranslationLocales()` pair Collection
  established; `saveProductAction` and `autosaveProductDraftAction` both
  build one `ProductTranslation` upsert per registry locale via `.map()`,
  replacing the old fixed EN+PT pair — including the per-locale Shopify
  `syncStatus` carry-forward logic (SYNCED survives an unchanged re-save,
  PENDING otherwise) that Collection's simpler translations didn't need.
  `validateProductPublication` (the publish-readiness gate) generalized
  from a fixed `portuguese`/`portugueseReviewed` pair to a `translations`
  array, with its own two callers (save and the publish-status action)
  and tests updated. Required-field native validation for the EN "Name"
  field keeps its own dedicated, real (non-hidden-mirrored) DOM node
  exactly as before — `localeOfFirstError` (the force-tab-open-on-error
  fix from Task 4) gained an optional locale-list argument so it still
  works for N locales without changing `AdminLocaleWorkspace`'s
  still-EN/PT-only default behavior.
  **Real bug caught only by live browser testing, not by the unit or
  integration tests:** the translation-only Title/URL-handle/Reviewed
  fields were first built as a single shared input whose `name` attribute
  switched with the active tab — meaning only whichever locale was active
  *at submit time* actually had a real, named DOM node, so every other
  locale's typed value silently vanished on save. Fixed by giving those
  three fields the same always-rendered hidden-mirror pattern (one per
  locale, real submitted values) already used for every other translated
  field, with the one visible input left as a pure, unnamed editing
  surface. Confirmed fixed by re-testing in a real browser: typed PT and
  RU titles, switched tabs, saved, reloaded, and read both back correctly.
- [x] **Page editor** — fully N-locale, `pt*` fields gone entirely from both
  `page-editor-form.tsx` and `page-create-form.tsx`. Page's `PageTranslation`
  table already mirrors Product/Collection's shape, and — unlike
  Product — none of Page's fields are natively `required`, so the whole
  editor could adopt the single-switching-value + always-hidden-mirror
  pattern uniformly (title, materials, dynamic `legal:{id}:title`/
  `service:{id}:title` section fields included) with no special-cased
  DOM node anywhere. The one field that still needed its own state map and
  hidden mirrors was the URL handle — applying the exact fix Product needed
  reactively, this time proactively, since it's the same "translation-only
  field with no EN counterpart" shape that bit Product. `readSectionFields`
  (dynamic per-section legal/service fields) generalized from a literal
  `"legal"`/`"ptLegal"` prefix pair to `adminLocaleFieldName(locale,
  \`${kind}:${id}:title\`, "en")` — the same helper handles colon-containing
  keys with no special-casing. `savePageAction` and `autosavePageDraftAction`
  both build one `PageTranslation` upsert per registry locale via `.map()`.
  The pre-`PageTranslation`-table `content.translations.pt` JSON blob (a
  Portuguese-only legacy fallback the admin form still reads when no real
  translation row exists yet) was deliberately left PT-only and untouched —
  no other locale ever had one, real rows always take precedence once they
  exist, and generalizing a fallback for data that structurally cannot
  exist for a new locale would have been complexity with no payoff.
  `CreatePageForm` (the separate, simpler "blank custom page" form) kept its
  existing physically-duplicated-fields-per-locale shape, generalized to
  loop over `translationLocales`, since every field there is real, uniquely
  named, and non-shared — no hidden-mirror pattern needed there at all.
- [ ] **Shopify sync/reconciliation adapters (`lib/shopify/product-sync.ts`,
  `editorial-translation-sync.ts`, `reconciliation-source.ts`, etc.) are
  still `locale === "pt"`-hardcoded for both Product and Collection.**
  Deliberately left alone here — that's Task U5's job ("Generalize Shopify
  locale adapters and reconciliation"), not U4's; U4 only covers the admin
  editor forms and their own save actions, which now round-trip any
  registry locale end to end before a push/pull ever touches Shopify.

**Verification:** `admin-locale-workspace.test.tsx` — 2 new tests (3-tab
render + keyboard nav in range with a non-EN/PT list; source-locale label
derived from `locales[0]`, not hardcoded "EN"), 11/11 passing.
`lib/i18n/__tests__/admin-locale-fields.test.ts` — 7 tests for the shared
FormData naming helpers. `lib/i18n/__tests__/product-save-integration.test.ts`
— real-DB integration test mirroring the Collection one below: saves a
product with EN/PT/RU translations in one call and asserts all three
`ProductTranslation` rows land correctly, including the unreviewed-blank-RU
fallback case. `lib/i18n/__tests__/collection-save-integration.test.ts`
— real-DB integration test (no UI mocking beyond auth/registry/cache) that
saves a Collection with EN/PT/RU translations in one call and asserts all
three `CollectionTranslation` rows land correctly, including RU's fallback
to the EN name when left blank and unreviewed. Chosen over further
browser-automation testing after discovering every collection in the local
dev DB predates the form's required-field validation (a pre-existing
data-quality gap, unrelated to this change) — a real-DB integration test
exercises the actual save logic without fighting stale fixture data.
`lib/products/__tests__/localization.test.ts` — 2 new tests for the
generalized `validateProductPublication`. `lib/i18n/__tests__/page-save-integration.test.ts`
— the same real-DB pattern for Page: saves a page with EN/PT/RU
translations in one call and asserts all three `PageTranslation` rows land
correctly, including RU falling back to the English title when left blank.
Both Product's and Page's editors were also live-verified end to end in a
real browser (typed EN/PT/RU content, switched tabs, saved, reloaded,
confirmed every locale round-tripped independently with no cross-locale
bleed, deleted the test record) — Product's pass is what caught the
shared-input submission bug above; Page's pass, applying that lesson from
the start, found nothing wrong. The integration tests alone would not have
caught that class of bug, since they build FormData by hand rather than
driving the actual form. Full suite green: tsc, eslint, 932 tests.

Task U4 is now fully done: all three admin editors (Collection, Product,
Page) are N-locale end to end, driven entirely by the `StorefrontLocale`
registry with zero hardcoded `pt`/`PT` left in any of their save actions
or form field lists. Adding a language from here on is a registry row —
Task U1 — not a code change to any of these three editors.

### Phase 3 — Generic content and Shopify synchronization

#### Task U5: Generalize Shopify locale adapters and reconciliation

**Status: done (2026-09-22).**

- [x] All adapters receive a registry locale rather than importing a
  Portuguese constant. `SHOPIFY_PORTUGUESE_ADMIN_LOCALE` deleted outright
  (zero remaining consumers). `registerProductTranslation`/
  `fetchProductTranslation`/`fetchProductTranslationIndex`
  (`lib/shopify/translations.ts`), the equivalent Page/Collection/editorial
  metaobject functions, and `editorial-translation-sync.ts`'s sync targets
  all now take an explicit `locale` param instead of a hardcoded one.
  `reconciliation-source.ts`'s `contentLocaleForShopify` replaced a
  string-prefix heuristic with a real registry lookup
  (`getPublishedStorefrontLocales().find(l => l.shopifyLocale === locale)`),
  throwing for any locale the registry doesn't know about instead of
  silently guessing.
- [x] Push, pull, snapshot, retry and conflict resolution work independently
  for every published target locale. `product-sync.ts`'s pull/push/preview
  paths, `translation-sync.ts`'s snapshot writer, and
  `reconciliation-run.ts`'s sweep all loop
  `getPublishedStorefrontLocales().filter(l => !l.isDefault)` instead of a
  fixed EN/PT pair. `ShopifyTranslationBinding.lastSyncedSnapshot` (a single
  JSON column that can only hold one locale) is a rollout-era shim that
  structurally cannot generalize to N locales — left unwritten going
  forward (still read as a graceful legacy fallback) rather than force-fit.
  **Real bug caught only during the rewrite, not by any test beforehand:**
  `reconciliation-run.ts`'s main loop fetched
  `fetchResourceTranslationState` once per binding using a hardcoded PT
  locale and reused that single fetch for every locale being checked —
  meaning a non-PT locale's reconcile check was silently comparing against
  Portuguese's remote state. Fixed by moving the fetch inside the per-locale
  loop so each locale gets its own independent Shopify read.
  **Pre-existing regression from Task U4, found and fixed while working in
  this area:** `EntityLocaleSyncControl`'s client-side
  `locale === "EN" ? "en" : "pt-PT"` mapping had been broken since Task U4
  switched the admin editors to lowercase registry codes — every "Check"
  click, regardless of which locale tab was open, queried Shopify using
  `pt-PT`. Fixed by dropping the client-side mapping entirely; the API
  route now resolves the registry code to a Shopify locale server-side via
  a new `resolveShopifyLocale()` helper.
- [x] Locale health reports the exact missing Shopify scope/publication for
  the affected language. `testShopifyAdminConnection`'s `portuguesePublished:
  boolean` field replaced with `unpublishedLocales: { code, name,
  shopifyLocale }[]`, computed by diffing every registered non-default
  locale against Shopify's actually-published `shopLocales`. The two
  duplicated hardcoded-PT admin-notice strings in `app/admin/actions/sync.ts`
  collapsed into one `translationLocaleNotice()` helper driven by that list.
- [x] `StorefrontCopy` deliberately left out of scope — its DB shape is a
  fixed `{en, pt}` pair (not a per-locale row table like Product/Collection/
  Page), so generalizing its Shopify sync now would mean redesigning its
  schema, which is Task U9's job, not U5's. `syncStorefrontCopyTranslation`
  and its one `STOREFRONT_COPY_PT_LOCALE` constant were kept exactly as
  they were, with a comment pointing at U9.

**Verification:** mocked-GraphQL tests added for a second locale (Russian)
alongside every existing Portuguese case — `translations.test.ts` (register
+ fetch round-trip), `reconciliation-run.test.ts` (a reconcile sweep
asserting one binding is checked independently against `["en", "pt-PT",
"ru"]`, not a hardcoded pair), `admin.test.ts` (the new `unpublishedLocales`
shape). Full suite green: tsc, eslint, 934 tests. Live-verified against the
real connected Shopify store: opened a genuinely Shopify-linked product
("AXIS Turquoise Necklace"), switched to its RU tab (confirmed the initial
GET-driven sync-status check already resolved correctly for a non-PT
locale), then clicked "Check" to trigger a live POST reconcile request for
RU specifically — completed with no error and stayed "In sync," which
exercises `resolveShopifyLocale()` and `runTranslationReconciliation()`
end to end for a locale that was hardcoded-PT before this task.

#### Task U6: Move fixed storefront copy and service/legal pages into the locale contract

**Status: done (2026-09-22).**

- [x] No buyer-facing `locale === "pt"` branch remains. Swept every hardcoded
  `locale === "pt"` / `isPt` conditional out of the 7 legal/service route
  files that had one — `privacy`, `offer`, `care`, `faq`, `shipping`,
  `returns`, `dispute-resolution` — plus `components/home/home-page.tsx`'s
  `EditShowcase` section and `lib/products/characteristics.ts`'s boolean
  Yes/No label. Chrome strings (page title, "Last updated", "Contents",
  "Back to store", nav labels) now come from `getServerTranslations()`'s
  `t()` (server) or `useTranslations()`'s `t()` (client) — the same
  `messages/{en,pt}.json` + `StorefrontCopy`-override + English-fallback
  mechanism every other UI string already used; these pages just weren't
  using it yet. `lib/content/catalog.ts`'s legacy `content.translations.pt`
  fallback read became `content.translations?.[locale]` — a one-line,
  behaviorally-identical generalization (that field only ever had a `pt`
  key written into it, so the lookup returns the same value for `pt` and
  the same `undefined` for every other locale as the ternary did).
- [x] Static UI copy is editable per locale and has English fallback. This
  was already true of everything routed through `t()` before this task —
  `getServerTranslations()`/`useTranslations()` already merge a DB-backed
  `StorefrontCopy` admin override on top of the static JSON dictionary and
  fall back to the English dictionary for any missing key. Moving the 7
  legal/service pages' chrome strings onto `t()` (previous bullet) is what
  makes *that* copy editable-with-fallback too; no new mechanism was built.
  The section/intro/title **default content** for privacy and the 5 service
  pages (`lib/content/privacy-defaults.ts`, `service-page-defaults.ts`) was
  restructured from parallel `_EN`/`_PT`-suffixed constants into single
  `Record<Locale, ...>` exports (`PRIVACY_SECTIONS`, `PRIVACY_SECTION_DEFAULTS`,
  `SERVICE_PAGE_TITLE_DEFAULTS`, `SERVICE_PAGE_INTRO_DEFAULTS`,
  `SERVICE_SECTION_DEFAULTS`) — every page component now does
  `X[locale]` instead of a ternary, and adding RU defaults later (Task U10)
  is a new object key, not a new conditional or file.
- [x] Legal/service content stays deliberately reviewed per locale; fallback
  is visible in Admin and never misreported as complete. The actual body
  content of these pages already flows through the N-locale Page/
  `PageTranslation` editor built in Task U4 — this task didn't need to
  rebuild that. What U6 fixes is that a locale with no admin-saved content
  yet no longer needs a hardcoded language branch to fall back correctly:
  the default-content lookups above resolve per locale automatically, the
  same way every other N-locale editor already does.
- [x] Scope boundaries, deliberately left alone:
  - `terms-and-conditions` and `legal-notice` pages have no `locale === "pt"`
    branch to remove — they're single-language (English) legal content by
    design, already documented as such in `terms-defaults.ts`/
    `legal-notice-defaults.ts` ("mirrors the /offer pattern"). Not touched.
  - `StorefrontCopy`'s persisted `{en, pt}` JSON shape (`lib/content/storefront-copy.ts`)
    and its Shopify sync adapter (`syncStorefrontCopyTranslation`) stay
    exactly as Task U5 left them — redesigning that schema to N locales is
    Task U9's job, confirmed twice now by existing in-code comments; U6
    generalizing the *page-level* copy above didn't require touching it.
  - `lib/i18n/format.ts`'s `shopifyLanguage()` (Storefront API `@inContext`
    language for cart/checkout) stays `pt`-only. Buyer-facing routing is
    still gated to `en`/`pt` by `SUPPORTED_LOCALES` (Task U2's explicit,
    documented boundary), so this function is never called with anything
    else today; generalizing it needs a new registry field (Storefront
    API's `LanguageCode` enum differs from the Admin API `shopifyLocale`
    already stored) with no live caller yet — same "no real payoff today"
    call Task U5 made for `StorefrontCopy`. Left for U9/U10, when routing
    actually widens.
  - `components/admin/products/products-cms.tsx`'s
    `product.translations.find(t => t.locale === "pt")` is an admin-only
    list-view convenience (a PT-completeness indicator in the product
    table), not a buyer-facing route. Out of this task's scope.

**Verification:** existing coverage already exercised both branches of every
changed function (`lib/products/__tests__/characteristics.test.ts`'s
"localizes boolean display values" test, `lib/content/__tests__/legal-sections.test.ts`,
`legal-document-backfill.test.ts`, `localized-page-metadata.test.ts`) and
all passed unchanged against the restructured `Record<Locale, ...>` exports
— no test needed updating, which is itself a sign the restructuring was
behavior-preserving. Full suite green: tsc, eslint, 934 tests. Live-verified
against the running dev server: `/en/privacy` and `/pt/privacy` render their
respective chrome strings ("Last updated"/"Última atualização", "Contents"/
"Índice", "Back to store"/"Voltar à loja", "Terms & Conditions →"/"Termos e
Condições →"); `/en/offer` and `/pt/offer`, `/en/care` and `/pt/care`, and
`/{en,pt}` (home page's "The Edit"/"A Seleção" and "View all products"/"Ver
todos os produtos") likewise; `/{en,pt}/{faq,shipping,returns,dispute-resolution}`
all 200. One pre-existing (not introduced by this task, confirmed via
`git stash`) content gap noticed along the way: `/pt/offer`'s `<title>`
shows the English "Public Offer Agreement" because that Page row has an
admin-saved English title but no Portuguese translation yet — `page?.title`
correctly takes precedence over the localized fallback either way; this is
a content gap for an editor to fill in Admin, not a code branch.

### Phase 4 — Vertical migrations and RU rollout

#### Task U7: Product end-to-end migration

**Acceptance criteria:** product edit, localized handle, storefront render,
SEO, Shopify sync and conflict UI work for EN/PT/RU.

#### Task U8: Collection and Page end-to-end migration

**Acceptance criteria:** same guarantees for collections, editorial pages,
Home, About and Legal.

#### Task U9: Storefront Copy and navigation migration

**Status: done (2026-09-22).**

Done ahead of Task U7 — the plan's own vertical-migration tasks (U7, U8)
need Product/Collection/Page storefront rendering to genuinely work for a
third locale, and that was still blocked on Storefront Copy's fixed
`{en, pt}` shape (deferred here explicitly by both Task U5 and Task U6's
completion notes). Doing U9 first unblocks U7/U8 for real instead of just
partially.

- [x] All Chrome copy uses the dynamic locale store. "Chrome copy" here is
  the already-curated, admin-editable subset — `STOREFRONT_COPY_GROUPS`'
  nav + footer, 20 keys (`lib/content/storefront-copy-fields.ts`); the rest
  of the site's static strings are either on admin-editable Page records
  (N-locale since Task U4) or developer-owned `messages/*.json` UI strings
  never meant to be admin-editable, both out of this task's "Chrome copy"
  scope. `lib/content/storefront-copy.ts`'s persisted shape widened from a
  literal `{ en: Record<string,string>; pt: Record<string,string> }` to
  `Record<string, Record<string,string>>`, keyed by registry locale code —
  `getStorefrontCopy`/`setStorefrontCopy` now loop over whatever locales are
  present instead of reading/writing two hardcoded fields.
  `components/admin/settings/storefront-copy-editor.tsx` — which had never
  been migrated onto the N-locale `AdminLocaleTabs` pattern Task U4 built
  for Product/Collection/Page, still defaulting to the old hardcoded
  `EN_PT_LOCALE_TABS` — now takes a `locales` prop and renders one
  always-present (hidden-if-inactive), really-named field per locale via
  `.map()`, the same pattern Collection's editor already used (this one
  never had Product's single-shared-input bug, since every locale already
  got its own permanently-rendered input). `app/admin/actions/storefront-copy.ts`
  builds its FormData-derived update per registry locale instead of two
  hardcoded `en:`/`pt:` reads. `app/admin/(admin)/settings/page.tsx` now
  fetches `getStorefrontLocales()` (all registered, not just published —
  staff can prep a translation before go-live, same reasoning as
  `getAdminTranslationLocales()`) and passes it through; the admin now shows
  an RU tab for Storefront Copy immediately, since `ru` was already a
  registered locale from Task U1.
- [x] Shopify sync generalized too, closing the gap Task U5 explicitly left
  open: `lib/shopify/editorial-translation-sync.ts`'s `syncStorefrontCopyTranslation`
  dropped its hardcoded `STOREFRONT_COPY_PT_LOCALE` constant and now takes a
  `locale: SyncTargetLocale` param like every other sync function;
  `app/admin/actions/translation-sync.ts`'s `STOREFRONT_COPY` branch now
  resolves the requested locale the same way `PRODUCT`/`COLLECTION`/`PAGE`
  already did instead of ignoring the caller's `localeCode` entirely.
  `lib/shopify/reconciliation-source.ts`'s two `english ? current.en :
  current.pt` spots (read and write) became `current[contentLocale]` —
  simpler than before, not just more general, since the ternary disappears
  along with the branch.
- [x] No new JSON file is needed to enable a language. This was already true
  in spirit before this task for the ~513 keys `messages/en.json`/`pt.json`
  don't share with Storefront Copy — `getServerTranslations()`/
  `useTranslations()` already fall back to the English dictionary for any
  locale with no dictionary file, which is the plan's own explicitly stated
  design ("for a new language, EN fallback shows immediately, admin marks
  it incomplete"), not a gap to close. What this task adds is that the 20
  curated Chrome keys are *also* real per-locale data now, not two hardcoded
  fields — so enabling a language needs zero code changes and zero new
  files anywhere in the Storefront Copy path, only registry + admin data,
  same as every other N-locale entity.
- [x] Found and fixed one leftover `locale === "pt"` branch outside Task U6's
  sweep: `app/layout.tsx`'s skip-link text used `initialLocale === "pt"`
  directly (missed because the variable is named `initialLocale`, not
  `locale`). Switched the layout to `getServerTranslations()` (was calling
  `getRequestLocale()` directly) and the skip link now reads `t("a11y.skip")`
  — a key that already existed in both message files, unused until now.

**Verification:** `lib/content/__tests__/storefront-copy.test.ts` — fixed
the one test asserting the old `{en:{}, pt:{}}` empty shape (now `{}`), plus
a new test proving a non-EN/PT locale (`ru`) round-trips through
`get`/`setStorefrontCopy` the same way. `components/admin/settings/__tests__/storefront-copy-editor.test.tsx`
— updated both existing tests for the new required `locales` prop, plus a
new test rendering a third locale (`ru`) tab, switching to it, and asserting
its value both displays and submits correctly. Full suite green: tsc,
eslint, 936 tests. Live-verified against the dev server: `/en` and `/pt`
nav/footer copy unchanged after the persistence-shape rewrite; the skip-link
fix renders "Skip to main content" on `/en` and "Saltar para o conteúdo
principal" on `/pt`; `/admin/settings` 307-redirects to login (unauthenticated)
rather than erroring, confirming the new `getStorefrontLocales()` call and
widened prop types don't break server rendering. The interactive N-locale
tab-switching itself is covered by the new RTL test above rather than a live
browser session — the Chrome extension wasn't connected this session.

#### Task U10: Enable Russian through the new path

**Acceptance criteria:**

- [ ] `ru` is imported from published Shopify locale data.
- [ ] Admin displays RU tabs in all migrated editors.
- [ ] Russian copy is imported/entered and reviewed; required buyer-facing
  fields meet the selected publication policy.
- [ ] `pnpm translations:backfill --dry-run --strict` reports no unsupported
  RU mappings before writes are enabled.

### Phase 5 — Cleanup and release hardening

#### Task U11: Remove legacy EN/PT-only paths

**Acceptance criteria:** no `ContentLocale` enum, `SHOPIFY_PORTUGUESE_*`
dependency in generic code, or buyer-facing Portuguese-specific conditional
remains outside deliberate Portuguese legal substance.

#### Task U12: Release gates

**Acceptance criteria:**

- [ ] Full unit, integration, lint and typecheck suites pass.
- [ ] Browser route matrix covers default, regional (`pt-PT`) and simple
  (`ru`) locales.
- [ ] Shopify connection health confirms every published locale.
- [ ] Documentation explains adding a new language in three data/config steps.

## Non-goals

- Automatic machine translation without human review.
- Making a language public before the merchant accepts the selected fallback
  policy for buyer-facing and legal copy.
- Replacing Shopify Markets with a parallel catalog or commerce model.
- Changing market, currency, tax or delivery rules merely because a language
  is enabled.

## Key risks and safeguards

| Risk | Safeguard |
|---|---|
| Breaking existing indexed `/pt` URLs | Preserve route segments and test redirects/alternates before migration. |
| Losing EN/PT content in enum conversion | Additive migration, dual-read, count report, backups/audit history untouched. |
| Per-request database cost in Proxy | Cached registry projection with explicit invalidation and no Shopify request on the hot path. |
| A language appears complete due to fallback | Completeness uses raw translation values; fallback is presentation-only. |
| Shopify language code differs from URL code | Registry stores both explicitly; adapters never infer one from the other. |
| Scope or publication missing | Per-locale connection health blocks sync writes but preserves local drafts. |

## Definition of done

The architecture is complete when adding a new published Shopify language is a
data operation visible in Synarava Admin, and the following command-and-review
workflow needs no source or schema change: synchronize locales → choose route
segment → populate/review translations → run dry-run/reconcile → publish.
