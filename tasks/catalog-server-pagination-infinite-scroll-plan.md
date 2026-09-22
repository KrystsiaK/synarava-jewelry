# План реализации: серверный каталог, курсорная пагинация и бесконечная прокрутка

## Цель

Перевести `/[locale]/shop` с загрузки всего каталога и клиентских `filter/sort` на серверную выборку. Первый набор карточек должен прийти в SSR, а последующие — загружаться по курсору при достижении sentinel внизу сетки. URL остаётся ссылочным, SEO- и refresh-friendly описанием выбранных фильтров и сортировки.

Изначальный узкий момент уже частично устранён: раньше `app/[locale]/shop/page.tsx` запрашивал `listShopListingProducts(locale)` без лимита, а `ShopPage` фильтровал весь массив в браузере. Теперь эта часть заменена первой серверной страницей и отдельной подгрузкой; оставшиеся ограничения перечислены ниже.

## Состояние ветки на 2026-09-22

В `codex/catalog-conflict-ux-docs` уже есть SSR первой страницы, `GET /api/catalog/products`, client-side append через `IntersectionObserver`, кнопка загрузки и focused tests. Это частичная реализация плана. `ShopCatalogClient` держит страницы только в `useState`; browser Back после remount начинает с `initialPage` и снова подгружает пройденные страницы. Проверка кода не нашла page cache, IndexedDB, scroll anchor или E2E сценария «глубокая прокрутка → PDP → Back». Кроме того, loader выбирает максимум `CATALOG_CANDIDATE_CAP = 1000` строк и сортирует их в памяти на каждом запросе: дойти до 100 000-го товара с этим кодом невозможно. Перед заявлением о поддержке глубокого каталога нужны Task 3/4 в настоящем keyset-варианте, затем Task 8/8a.

## Решения, которые предлагается принять

### 1. Источник торговых данных

Shopify остаётся source of truth. Локальная Prisma БД — явно синхронизированная storefront-проекция: она уже содержит публичные товары, варианты, связи с коллекциями, теги и характеристики. Каталог читает эту проекцию, а Shopify sync обязан обновлять нужные поля и ranking. Не строить отдельную локальную сущность каталога.

Причины:

- текущая витрина уже получает карточки из этой проекции;
- серверная фильтрация по редакционным полям и локализованному контенту возможна без exposing Storefront token в браузер;
- карточки, availability и фильтры будут согласованы с остальной витриной;
- при прямом Storefront API часть существующих Synarava-полей потребует повторного моделирования.

Перед началом нужно подтвердить freshness SLA проекции (например, webhook/sync + допустимая задержка). При требованиях к availability «в реальном времени» отдельным решением остаётся чтение availability из Shopify с коротким серверным cache, а не перенос фильтрации обратно в браузер.

### 2. Пагинация — keyset/cursor, не `offset`

API возвращает `nodes`, `pageInfo: { hasNextPage, endCursor }` и, при необходимости для счётчика, `totalCount`. `endCursor` — opaque/versioned токен, содержащий только:

- версию формата;
- отпечаток нормализованных `locale + filters + sort`;
- значения сортировочного tuple последней записи и стабильный `product.id` как tie-breaker.

Сервер отвергает cursor, если его отпечаток не совпадает с текущим запросом. Cursor никогда не кладётся в canonical URL: он относится к конкретной выдаче и может устареть после изменения данных.

Для каждого режима сортировки нужен детерминированный tuple:

| UI sort | Серверный порядок | Cursor tuple |
|---|---|---|
| `featured` | порядок storefront/featured collection, затем published/created, затем id | featured position, published date, id |
| `popular` | сохранённый Shopify BEST_SELLING rank, затем id | popularity rank, id |
| `newest` | published date desc, created date desc, id | published date, created date, id |
| `price-asc` / `price-desc` | вычисленная listing price, затем id | price cents, id |
| `name-asc` | локализованный title в согласованной collation, затем id | normalized title, id |

Нельзя использовать `skip`/`take` с номером страницы: большие offset становятся медленнее, а изменения товара дают пропуски и дубли. Нельзя применять Prisma `cursor: { id }` при сортировке по другому полю без доказательства корректности tuple-предиката.

### 3. Состояние пользователя: URL сначала, `sessionStorage` — только для возврата

`localStorage` **не должен быть основным источником фильтров, сортировки или списка товаров**. Он не участвует в SSR, плохо работает с ссылками/несколькими вкладками и легко показывает устаревшую выдачу.

| Что сохраняем | Механизм | Причина |
|---|---|---|
| фильтры и sort | canonical URL query (`q`, `department`, …, `sort`) | share/reload/back-forward/SSR/SEO |
| загруженные страницы и их cursor при переходе с каталога | memory cache текущей вкладки + IndexedDB для восстановления после remount/reload | возврат к уже просмотренным товарам без повторных запросов |
| указатель на конкретную историю просмотра и видимую карточку | маленькая запись в `history.state` | восстановление именно того посещения каталога, даже при нескольких разных фильтрах |
| «восстановить прошлые фильтры» при новом визите без query | существующий opt-in UX, но `sessionStorage` | текущая сессия, не неожиданный старый каталог через недели |
| только явное предпочтение «запоминать мой каталог» | versioned `localStorage` с TTL, locale и schema version | optional convenience, а не состояние страницы |

Ключ выдачи включает `historyEntryId + locale + hash(canonical filters)`. Memory cache держит уже загруженные страницы без ограничения в 100–120 карточек в течение жизни вкладки. IndexedDB хранит страницы отдельными записями (`viewKey`, `pageIndex`, `nodes`, `endCursor`) и метаданные выдачи; сохранение одной новой страницы не сериализует заново весь список. `sessionStorage` остаётся только для существующего opt-in восстановления фильтров и небольших метаданных. Персональные данные и Shopify token в cache не записывать.

При входе по явному URL тот всегда побеждает. При browser back сначала полагаться на нативный history/BFCache; cache нужен как fallback при remount/eviction страницы. Перед удалением старых выдач проверять, не принадлежат ли они текущей записи истории. Очищать по TTL/LRU лишь неактивные выдачи; ошибки IndexedDB/quota должны быть заметны в диагностике и приводить к безопасному восстановлению по якорю, а не к молчаливому сбросу в начало.

### 3a. Точный контракт возврата в каталог

Требование «вернулся — вижу тот же скролл и уже подгруженные страницы» — обязательная часть feature, а не best effort. Нужен небольшой scoped `CatalogViewStore`, но **не Redux**:

- Redux сам по себе сохраняет состояние только пока живёт JS runtime; для reload/return всё равно понадобятся browser history и persistent page cache.
- Глобальный Redux-store добавит dependency и риск смешать разные locale/filter tabs; для одного route-domain достаточно React context/reducer или маленького module store без новой библиотеки.
- Store владеет только UI cache выдачи, но не canonical filters и не product source of truth.

```ts
type CatalogViewSnapshot = {
  version: 1;
  viewKey: string;           // history entry + locale + canonical filter/sort query
  savedAt: number;
  completedPageCount: number;
  endCursor: string | null;
  hasNextPage: boolean;
  anchor: { productId: string; offsetPx: number; scrollY: number };
};

type CatalogCachedPage = {
  viewKey: string;
  pageIndex: number;
  nodes: ShopListingProduct[];
  endCursor: string | null;
  measuredHeightPx?: number; // размер сегмента для virtualized placeholders
};
```

Lifecycle должен быть таким:

1. При initial SSR store стартует с `initialPage`. На Back/Forward по `historyEntryId` сначала проверяется сохранённое состояние в памяти; после remount/reload считываются metadata и нужные page records из IndexedDB. Уже загруженные страницы не запрашиваются по API повторно.
2. После каждого успешного append сохраняются новая страница и cursor. Текущая history entry получает только `viewKey` и anchor через `history.replaceState({ ...existing, catalogViewKey, catalogAnchor }, "")`; важно сохранить Next.js поля в `history.state`.
3. При переходе в PDP `<Link>` сохраняет текущий anchor (`product.id` верхней видимой карточки + смещение от viewport top) и отправляет ожидающие записи в IndexedDB **до navigation**. Для `pagehide` нужен дополнительный flush.
4. На возврате observer загрузки выключен до окончания восстановления. Сначала восстанавливается структура списка или virtualized placeholders прежней высоты, затем после layout пересчитывается позиция anchor и выполняется scroll. `scrollY` — запасной вариант, когда карточка удалена; одно лишь старое числовое `scrollY` не гарантирует попадания на тот же товар после изменения высот/ширины экрана.
5. Когда нужный anchor отрисован и скролл выполнен, observer включается снова. Следующий запрос начинается только после последнего сохранённого cursor, при дальнейшем движении пользователя вниз. Валидация query/locale/viewKey исключает подмешивание другой выдачи.
6. При изменении filter/sort/query создаётся новая history entry и новый viewKey; старые page records остаются доступными для Browser Back. Прямая новая навигация на тот же URL не должна автоматически подтягивать старое посещение без его history key.

Anchor capture следует throttle-ить (например, animation frame/500 ms для scroll), а page records записывать один раз после успешного ответа. При длинных выдачах (пример: пользователь дошёл до 100 000-го товара) DOM должен быть виртуализирован по страницам/сегментам с сохранёнными высотами: держать 100 000 карточек одновременно в React/DOM недопустимо. Сами просмотренные страницы остаются в page cache; при Back восстанавливаются anchor и соседние сегменты без сетевого «пролистывания» всех предшествующих страниц. Отдельный performance test должен проверить большой synthetic catalog, квоту IndexedDB и скорость восстановления.

### 4. API boundary

Добавить same-origin `GET /api/catalog/products` (путь уточнить по соглашениям проекта) с query параметрами из общего нормализатора. Route Handler валидирует параметры на сервере, ограничивает `limit` (например, default 24, max 48), декодирует cursor и возвращает только публичный DTO карточки.

Отдельный endpoint не заменяет начальный SSR: `page.tsx` вызывает тот же серверный loader для первой страницы. Таким образом SSR и client-fetch никогда не расходятся в правилах доступности, локали, фильтрации, сортировки и сериализации.

## Целевая схема потока

```text
URL query ──> normalize/validate ShopCatalogQuery
                    │
       page.tsx ────┼──> listCatalogPage(query, null) ──> SSR first 24 cards
                    │
GET /api/catalog/products?…&cursor=… ─┘                 ──> next cards + pageInfo
                                                                  │
ShopCatalogClient <── FilterBar / sentinel / retry <─────────────┘
        │
        ├─ URL via router.push/replace (without cursor)
        └─ history view key + memory/IndexedDB page cache + item anchor
```

## Контракт данных

### Общие типы и нормализация

Вынести из `components/shop/types.ts` server-safe контракт в `lib/catalog` (например, `shop-query.ts`):

- `ShopCatalogFilters`, `ShopCatalogSort`, `ShopCatalogQuery`, `CatalogPage<T>`;
- allow-list и нормализация каждого URL параметра: trim/lowercase where appropriate, `q` max length, enum для `availability` и sort, known characteristic keys для certification;
- `canonicalSearchParams()` с предсказуемым порядком параметров;
- `queryFingerprint()` и безопасные `encodeCursor`/`decodeCursor`;
- преобразование старого `ShopFilters` на период миграции, затем удаление дублирования.

Недопустимые значения не должны попадать в Prisma/SQL. Неизвестные параметры игнорируются либо возвращают controlled `400` в API; выбрать один вариант и зафиксировать тестами. Для browser URL предпочтителен normalizing redirect/replace, а не ошибка страницы.

### Серверный loader

Заменить `listShopListingProducts()` на `listShopCatalogPage(query, cursor, locale)`; при необходимости оставить старую функцию только для discovery-rail до её миграции.

Loader обязан:

1. Ограничить товары `ACTIVE` + `PUBLIC` до join/пагинации.
2. Применить все фильтры в БД: department, availability, Shopify taxonomy category, type, collection, tag, filterable characteristics и certification.
3. Выполнить локализованный поиск на сервере. Проверить индекс/стратегию для EN и PT: текущий `searchDocument` не должен молча давать неполный PT поиск. Для production-каталога выбрать indexed Postgres full-text/trigram search либо документированную временную `contains`-стратегию с измеренным лимитом.
4. Вычислить именно ту цену и availability, которые использует карточка. Если цена берётся из первого purchasable variant, materialize/denormalize listing price в storefront-проекцию либо сделать единую SQL/Prisma strategy; не сортировать по `Product.priceCents`, если карточка показывает цену варианта.
5. Применить sort и keyset predicate, запросить `limit + 1`, сформировать `hasNextPage` и cursor.
6. Hydrate only returned IDs/relations и сохранить server order при маппинге в `ShopListingProduct`.

Для `popular` подготовить Shopify-native projection: current `listBestSellingShopifyProductIds()` не годится как сортировка страницы, поскольку отдаёт ranking отдельно и клиент применяет его только после полного списка. Добавить/persist обновляемый `bestSellingRank` (или равнозначную server-side ranked ID projection) из `Collection.products(sortKey: BEST_SELLING)` для storefront-default collection. При недоступности Shopify использовать явно документированный fallback `featured`, вернуть `popularAvailable: false` и не утверждать, что выдача «популярная».

### Данные фильтров и discovery

`getShopFilterData(locale)` остаётся серверным loader, но его запросы нужно измерить и при необходимости cache/tag invalidation привязать к product/collection sync. Counts в UI — count той же server-side выдачи, а не `filteredProducts.length`.

Discovery («new arrivals», «most popular», product-type tiles) не должен требовать полного `archiveProducts`:

- отдельные bounded queries (например, 8 карточек) с нужным sort/filter;
- product-type tile получает cover/count агрегатом или первым ID из серверного запроса;
- popular rail использует ту же rank projection.

## UX бесконечной прокрутки

- Внизу `ProductGrid` находится sentinel с `IntersectionObserver`; `rootMargin` около 600–800 px предзагружает следующую страницу до видимой паузы.
- В один момент допускается только один in-flight запрос. `AbortController` отменяет предыдущий запрос при смене URL/filter/sort, а `requestKey` не позволяет запоздалому ответу добавить чужие товары.
- На изменение фильтра/sort/query: URL обновляется, loaded nodes/cursor/error сбрасываются, запрос возвращает первую страницу; scroll к `#shop-products` выполняется один раз после user action. Для text search сохранить debounce 350 ms, но отменять/заменять запросы.
- Сетку не remount-ить по `JSON.stringify(filters)`: ключом результата служит canonical query fingerprint. Это исключает потерю focus и лишние анимации.
- Показать анонс `aria-live`: число найденных/показанных результатов, «Loading more products», «N more products loaded», «All products loaded». Sentinel не является единственным способом: при отсутствии `IntersectionObserver`, reduced-data/reduced-motion или ошибке доступна кнопка «Load more».
- Ошибка следующей страницы не стирает уже видимые карточки; рядом с sentinel отображается retry. Initial-page ошибка использует текущий resilient empty/error pattern. Пустая выдача имеет «Show all products» с canonical URL.
- В дедупликации использовать стабильный `product.id`, а не локализованный slug. Новый/изменившийся каталог между страницами может сдвинуть выдачу; возможные дубли silently de-dupe, но cursor contract и устойчивый order минимизируют пропуски. При строгом snapshot-требовании добавить revision в cursor как последующую задачу.

## Пошаговый план

### Phase 0 — контракт и измерение

#### Task 1: Зафиксировать query/cursor contract

**Description:** Описать типы, canonical URL, лимиты, cursor payload и fallback каждого sort до изменения UI.

**Acceptance criteria:**

- [ ] Каждый текущий URL-параметр каталога имеет allow-list, default и validation rule.
- [ ] Cursor несовместим с другим locale/filter/sort и не раскрывает внутренние данные кроме безопасного opaque token.
- [ ] Поведение `popular`, PT-search и listing price документировано и подтверждено на реальных данных/staging.

**Verification:** unit tests normalizer/cursor; EXPLAIN/benchmark representative filters; review Shopify rank sync.

**Dependencies:** None. **Scope:** S.

#### Task 2: Базовые performance-метрики

**Description:** Замерить текущий payload, server query time и client render при текущем и synthetic large catalog; задать release budgets.

**Acceptance criteria:**

- [ ] Есть baseline для `/shop`, сложного filter и search.
- [ ] Согласованы page size и budgets (p75 initial query, next-page query, HTML/RSC payload, no long task while appending).

**Verification:** Playwright trace/Lighthouse or Web Vitals capture written in plan/PR. **Dependencies:** Task 1. **Scope:** S.

### Phase 1 — серверный каталог

#### Task 3: Создать единый server-side query builder и page loader

**Description:** Реализовать normalized query, predicate builder, deterministic ordering, `limit + 1` и DTO page loader поверх текущей storefront-проекции.

**Acceptance criteria:**

- [ ] Ни один filter/sort не вызывает загрузку полного public catalog.
- [ ] Две последовательные страницы не содержат повторов и вместе соответствуют первой `2 × limit` записи стабильной выдачи.
- [ ] EN/PT title и search ведут себя предсказуемо; price/in-stock совпадают с карточкой.

**Verification:** Vitest matrix filters × sorts × locales; integration test seeded > 2 pages; query-count assertion. **Dependencies:** Tasks 1–2. **Scope:** M.

#### Task 4: Сделать rank/price пригодными для server sorting

**Description:** Добавить минимальную projection/индексы/миграцию, необходимые для `popular` и цены; обновить Shopify sync и docs data ownership.

**Acceptance criteria:**

- [ ] BEST_SELLING order воспроизводится серверно или sort скрыт с честным fallback.
- [ ] Price order соответствует цене на `ProductCard`.
- [ ] Sync/reconciliation обновляет новые derived fields и не создаёт параллельного source of truth.

**Verification:** migration test; sync/reconciliation tests; comparison with Shopify fixture. **Dependencies:** Task 3. **Scope:** M.

#### Checkpoint: серверная выборка

- [ ] `pnpm test:run` focused suites pass.
- [ ] Server output identical in semantics to current catalog for a fixture set.
- [ ] Query plan uses intended indexes and page-size budget.

### Phase 2 — SSR и API

#### Task 5: Перевести `/[locale]/shop` на первую серверную страницу

**Description:** Page получает filters из `searchParams`, запрашивает first page и bounded discovery data; `ShopPage` получает `initialPage`, не массив всего архива.

**Acceptance criteria:**

- [ ] Direct URL SSR-рендерит корректные first-page cards, title/count и empty state.
- [ ] Discovery не зависит от полного product array.
- [ ] Canonical/locale routes и metadata не меняются непреднамеренно.

**Verification:** page/component tests; existing `e2e/catalog-resilience.spec.ts`. **Dependencies:** Tasks 3–4. **Scope:** M.

#### Task 6: Добавить защищённый route handler next-page API

**Description:** Route Handler вызывает тот же loader, сериализует DTO/pageInfo и возвращает typed controlled errors.

**Acceptance criteria:**

- [ ] API validates query, cursor and page size; no private/draft product can be fetched.
- [ ] Bad/mismatched cursor returns actionable 400; upstream/database failure returns safe 5xx payload without stack/secret.
- [ ] First-page loader and API give identical result for equal query/cursor.

**Verification:** route tests for valid, invalid, stale/mismatched cursor and EN/PT; lint. **Dependencies:** Task 5. **Scope:** S.

### Phase 3 — клиентская прокрутка и восстановление

#### Task 7: Выделить `ShopCatalogClient` и подключить sentinel

**Description:** Убрать `filterAndSortShopProducts` из rendering path; реализовать append, loading/error/retry states, cancellation, dedupe и accessible fallback button.

**Acceptance criteria:**

- [ ] При visible sentinel загружается следующая страница ровно один раз.
- [ ] Смена filter/sort/search не смешивает карточки разных запросов.
- [ ] Не отключённый JS всё ещё показывает SSR first page и usable filter links/forms where available.

**Verification:** component tests with mocked IntersectionObserver/fetch; Playwright network assertions. **Dependencies:** Tasks 5–6. **Scope:** M.

#### Task 8: Согласовать URL, history и storage

**Description:** Заменить ручной competing state flow на canonical URL navigation, scoped `CatalogViewStore`, memory page cache, IndexedDB page records, history anchor и opt-in restore фильтров.

**Acceptance criteria:**

- [ ] URL можно открыть в новой вкладке и получить ту же first page without storage.
- [ ] После `filter → load 2+ pages → PDP → Back` видны те же карточки, следующий cursor и та же карточка-якорь в прежнем положении; сеть не перезапрашивает уже сохранённые страницы.
- [ ] Back/forward после нескольких посещённых URL восстанавливают matching view по history entry; direct link начинает новую выдачу.
- [ ] После remount/reload в той же вкладке page records читаются из IndexedDB; corrupted/mismatched records безопасно игнорируются с видимым recovery path.
- [ ] Пока список и anchor восстанавливаются, sentinel не инициирует новую загрузку.

**Verification:** unit tests cache/version/history mapping and cursor-invalid recovery; Playwright network assertions: filter → load 2 pages → PDP → Back with zero repeat page requests, reload in same tab, two-tab isolation, browser back/forward. **Dependencies:** Task 7. **Scope:** M.

#### Task 8a: Виртуализировать длинную сетку с восстановлением по anchor

**Description:** Рендерить только видимые сегменты карточек и ближайший buffer, сохранять measured heights и восстанавливать положение по `product.id + offsetPx` после layout.

**Acceptance criteria:**

- [ ] Глубокая прокрутка не увеличивает DOM и время React render пропорционально числу уже просмотренных карточек.
- [ ] Back к ранее видимой карточке не вызывает последовательной повторной загрузки промежуточных страниц.
- [ ] После смены ширины viewport или загрузки изображений anchor остаётся на той же карточке в пределах допустимого pixel tolerance.

**Verification:** browser performance test на synthetic catalog с десятками тысяч карточек; Playwright scroll-to-deep-item → PDP → Back с подсчётом API запросов и проверкой anchor. **Dependencies:** Task 8. **Scope:** M.

#### Checkpoint: основной пользовательский путь

- [ ] Filter → sort → deep scroll → open product → Back восстанавливает тот же item/offset и продолжает загрузку после последнего сохранённого cursor на desktop/mobile.
- [ ] Keyboard/focus, screen reader announcements and retry/load-more fallback pass review.
- [ ] No duplicate request or card under fast filter changes and slow network.

### Phase 4 — hardening и выпуск

#### Task 9: Нагрузочное тестирование, observability и документация

**Description:** Добавить telemetry/query timing without PII, update product-data ownership and run staged release.

**Acceptance criteria:**

- [ ] Logged/metric fields include normalized sort, page size, query duration, result count and cursor errors; raw search terms and customer data excluded.
- [ ] Documentation describes projection freshness, API contract, cache/storage TTL, fallback and rollback.
- [ ] Feature can be toggled/rolled back to SSR first page + explicit Load more without reintroducing full client filtering.

**Verification:** production-like load test; `pnpm lint`, `pnpm test:run`, relevant Playwright; docs review. **Dependencies:** Tasks 1–8. **Scope:** M.

## Файлы, вероятно затронутые при реализации

- `app/[locale]/shop/page.tsx` — first page SSR and bounded discovery.
- `app/api/catalog/products/route.ts` — new page API.
- `lib/content/shop-listing.ts` и новый `lib/catalog/*` — page loader, query, cursor, mapping.
- `lib/content/catalog.ts`, `lib/catalog/shop-sort.ts` — filter data/rank contract.
- `components/shop/shop-page.tsx`, `components/shop/filter-bar.tsx`, `components/shop/shop-product-filtering.ts` — client boundary and removal of in-memory filtering.
- `components/shop/types.ts` — browser-only adapter/storage cleanup.
- `prisma/schema.prisma`, migration, Shopify sync/reconciliation — only if Task 4 needs persisted rank/listing price.
- `components/shop/__tests__/*`, `lib/content/__tests__/*`, `e2e/catalog-resilience.spec.ts` plus new pagination/history E2E specs.
- `docs/product-data-ownership.md` and, if contract is public to frontend, an API/catalog doc.

## Риски и меры

| Риск | Влияние | Мера |
|---|---|---|
| Цена карточки и DB `priceCents` различаются из-за variants | неверная сортировка | единый listing-price projection + contract tests |
| `popular` зависит от live Shopify | нестабильный порядок/latency | persist rank in synced projection; honest featured fallback |
| Поиск PT не индексирован | медленная/неполная выдача | validate locale query plan before release; add dedicated index/search vector |
| Cursor при изменении каталога | duplicates/gaps | stable tie-breaker, de-dupe, short-lived cursor; consider catalog revision if strict snapshot needed |
| Состояние lost при PDP → Back | пользователь снова ждёт несколько page loads | memory + IndexedDB page cache, history anchor, mandatory E2E network assertion |
| Длинный каталог перегружает DOM и browser storage | тормоза и отказ cache на глубокой прокрутке | segment virtualization, page records, quota/performance tests, явная стратегия восстановления при quota error |
| localStorage показывает stale state | confusing restore | URL canonical; versioned view records keyed to history entry |
| IntersectionObserver отсутствует или запрос упал | inaccessible dead end | visible Load more + retry, no hidden-only trigger |
| Изменение API раскрывает draft data | commerce/privacy issue | server validation, public `where` at query root, route tests |

## Definition of Done

- Каталог не передаёт и не сортирует весь public product array в браузере.
- Все текущие фильтры, поиск и пять сортировок исполняются на сервере с deterministic cursor pagination.
- Первая страница SSR, следующие страницы append по sentinel и доступны через кнопку fallback/retry.
- URL полностью описывает фильтр/сортировку; per-tab page cache восстанавливает все уже просмотренные страницы и item anchor при возврате без повторных запросов, даже после глубокой прокрутки.
- EN/PT, accessibility, browser history, slow network, empty/error states и Shopify ranking fallback покрыты тестами.
- Query performance и storefront-projection freshness измерены, а документация соответствует реализации.

## Проверенные источники

- Shopify Storefront API [`products`](https://shopify.dev/docs/api/storefront/latest/queries/products): cursor arguments `first`/`after`, `sortKey`, `reverse`, query filters and `pageInfo`.
- Shopify Storefront API [`ProductFilter`](https://shopify.dev/docs/api/storefront/latest/input-objects/ProductFilter) и [`ProductCollectionSortKeys`](https://shopify.dev/docs/api/storefront/latest/enums/ProductCollectionSortKeys): сверить фактическую Shopify-native filter/sort семантику перед любым изменением source projection.
- Next.js 16 local docs: Route Handlers (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) и `useRouter`/`useSearchParams` — page-level `searchParams` остаётся правильным источником initial SSR query; Route Handlers не кэшируются по умолчанию.
