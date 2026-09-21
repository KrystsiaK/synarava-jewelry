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

- [ ] Product/Collection/Page translations, localized-handle redirects,
  sync events and snapshots use registry locale codes.
- [ ] Migration preserves all EN/PT records and their unique indexes.
- [ ] New locale insertion requires no Prisma migration.

**Verification:** migration test against a fixture DB and before/after count
report; `prisma generate`; typecheck.

#### Task U4: Replace EN/PT form payloads with dynamic locale drafts

**Acceptance criteria:**

- [ ] `AdminLocaleWorkspace` renders every active locale as ARIA tabs.
- [ ] Switching tabs never loses unsaved values.
- [ ] Requiredness, review status, sync status and first-error focus work per
  locale, without `pt*` form field names.

**Verification:** component tests with EN/PT/RU and keyboard/mobile checks.

### Phase 3 — Generic content and Shopify synchronization

#### Task U5: Generalize Shopify locale adapters and reconciliation

**Acceptance criteria:**

- [ ] All adapters receive a registry locale rather than importing a
  Portuguese constant.
- [ ] Push, pull, snapshot, retry and conflict resolution work independently
  for every published target locale.
- [ ] Locale health reports the exact missing Shopify scope/publication for
  the affected language.

**Verification:** mocked GraphQL tests for `pt-PT` and `ru`, plus a
reconciliation dry-run containing two non-default locales.

#### Task U6: Move fixed storefront copy and service/legal pages into the locale contract

**Acceptance criteria:**

- [ ] No buyer-facing `locale === "pt"` branch remains.
- [ ] Static UI copy is editable per locale and has English fallback.
- [ ] Legal/service content stays deliberately reviewed per locale; fallback
  is visible in Admin and never misreported as complete.

**Verification:** route rendering and accessibility tests for a partially
translated third locale.

### Phase 4 — Vertical migrations and RU rollout

#### Task U7: Product end-to-end migration

**Acceptance criteria:** product edit, localized handle, storefront render,
SEO, Shopify sync and conflict UI work for EN/PT/RU.

#### Task U8: Collection and Page end-to-end migration

**Acceptance criteria:** same guarantees for collections, editorial pages,
Home, About and Legal.

#### Task U9: Storefront Copy and navigation migration

**Acceptance criteria:** all Chrome copy uses the dynamic locale store; no
new JSON file is needed to enable a language.

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
