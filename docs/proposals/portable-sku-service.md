# План реализации переносимого SKU-сервиса

**Статус:** Этап 1 (domain POC) реализован в монорепе · Этапы 2–6 открыты · **Дата:** 2026-10-12 (обновлено 2026-10-12)

> **Handoff для исполнителя:** сначала прочитать [ADR-0002](../adr/0002-shopify-catalog-ownership.md), [ADR-0003](../adr/0003-commerce-conflict-deep-diff.md), [ADR-0004](../adr/0004-portable-sku-service-boundary.md), [`product-data-ownership.md`](../wiki/product-data-ownership.md) и настоящий документ. Не переоткрывать принятые решения внутри реализации; новое отклонение сначала оформить как изменение ADR/RFC.

## 1. Цель

Создать переносимый сервис, который детерминированно формирует, резервирует и проверяет SKU для нескольких проектов. Synarava Shop — первый workspace и источник проверенного legacy-набора, но не единственный возможный клиент.

Сервис не заменяет Shopify и не хранит товарный каталог. Он отвечает только за policy profiles, выдачу уникальных кодов, связь выданного кода с внешним вариантом и историю решений. Архитектурная граница предложена в [ADR-0004](../adr/0004-portable-sku-service-boundary.md).

## 2. Что подтверждено до начала реализации

- В полном экспорте Synarava от 2026-10-12: 49 товаров, 49 variant rows, 49 заполненных и 49 уникальных SKU, 0 дубликатов.
- Все товары в снимке имеют один Shopify-вариант `Default Title`; multi-variant поведение ещё не покрыто реальным каталогом.
- Все наблюдаемые SKU заканчиваются трёхзначным суффиксом, но аудит не доказывает историческую последовательность его выдачи.
- `ProductVariant.sku` в текущей Prisma-схеме уникален; одновременно существует legacy-поле `Product.sku`.
- Текущий admin умеет редактировать и push-ить variant SKU, но часть точечного sync-кода намеренно отказывается работать при нескольких вариантах.
- Shopify считает SKU атрибутом варианта/inventory item и рекомендует уникальность, но при дубликате показывает предупреждение, а не универсальную жёсткую блокировку. Поэтому бизнес-гарантию уникальности обеспечивает наш сервис, а не предположение о Shopify.

Канонический CSV аудита хранится вне git. Исполнитель не должен копировать его в репозиторий, подменять синтетическими данными или считать доступным по локальному пользовательскому пути. Для разработки importer используются безопасные fixtures; фактический staging import 49 legacy SKU запускается только после явной передачи канонического export как операционного входа и проверки ожидаемых counts.

Официальные опорные материалы Shopify:

- [Using SKUs to manage your inventory](https://help.shopify.com/en/manual/products/details/sku)
- [`productVariantsBulkUpdate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productVariantsBulkUpdate)
- [`inventoryItemUpdate`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/inventoryItemUpdate)
- [`INVENTORY_ITEMS_UPDATE` webhook topic](https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic)

## 3. Целевая схема

```text
Synarava Admin / другой клиент
        │ preview / reserve / confirm / validate
        ▼
Portable SKU Service ──────────────► PostgreSQL
        │                              profiles, reservations,
        │                              assignments, tombstones, audit
        │
        └── результат клиенту
                 │
                 ▼
          Shopify Admin API
                 │
                 ▼
    Shopify Variant SKU (source of truth)

n8n ──► периодический аудит / уведомления / ручные очереди
     └─ не участвует в атомарной выдаче номера
```

На первом этапе сервис — отдельный Railway runtime и отдельный PostgreSQL service/database в том же Railway project/environment, что и Synarava. Исходный код находится в общей pnpm-монорепе; вынос в отдельный репозиторий рассматривается после стабилизации API.

### 3.1. Структура монорепы и зависимости

Текущее Next.js-приложение остаётся в корне, чтобы не создавать рискованный механический перенос. Добавляются workspace packages:

```text
synarava-jewelry/
├── app/                          # существующий Synarava Shop
├── components/
├── lib/
├── prisma/                       # существующая Shopify/CMS projection
├── services/
│   └── sku-api/                  # отдельный HTTP runtime
│       ├── src/
│       ├── prisma/               # только SKU registry
│       ├── package.json
│       └── railway.toml
├── packages/
│   ├── sku-core/                 # чистая domain logic
│   └── sku-contract/             # OpenAPI, schemas, generated TS client
├── pnpm-workspace.yaml
└── package.json
```

Правила зависимостей:

- `sku-core` не импортирует Synarava, Shopify, Next.js, React, Railway, HTTP или Prisma client;
- `sku-api` импортирует `sku-core`, реализует persistence/auth/HTTP и владеет своей Prisma schema;
- `sku-contract` содержит публичные request/response schemas, error codes, OpenAPI и generated TypeScript client;
- Synarava импортирует только `sku-contract` и обращается к `sku-api` по HTTP;
- ни Synarava, ни n8n не обращаются напрямую к SKU database;
- Shopify adapter остаётся в Synarava на первом этапе: API резервирует/подтверждает SKU, а Synarava выполняет Shopify mutation и read-back.

### 3.2. Зафиксированный стек

- TypeScript + Node.js для `sku-core` и `sku-api`;
- PostgreSQL для транзакций и uniqueness constraints;
- Prisma для отдельной схемы SKU registry и миграций;
- Zod и OpenAPI для runtime validation и versioned contract;
- Vitest для unit/contract/concurrency tests;
- существующий Next.js + `synarava-cms` для первого UI;
- Python не входит в основной runtime; будущий AI/data worker может быть отдельным необязательным клиентом API.

## 4. Ответственность систем

| Система | Владеет | Не должна делать |
| --- | --- | --- |
| Shopify | Товар, вариант и фактически назначенный `Variant SKU` | Выбирать нашу семантику SKU или гарантировать правила Synarava |
| SKU-сервис | Профили правил, счётчики/резервации, assignment ledger, tombstones, audit events | Хранить описание, цену, остатки или становиться вторым каталогом |
| Synarava Admin | UX, сбор семантических признаков, вызов сервиса, запись и read-back Shopify, локальная Shopify-проекция | Самостоятельно вычислять следующий номер или вести второй словарь |
| n8n | Расписание аудита, уведомления, retry/manual queue, отчёты | Хранить canonical counter, генерировать SKU в expressions или быть единственным audit log |
| Notion | Человекочитаемая утверждённая policy | Быть runtime-конфигурацией |
| RAG/LLM | Необязательная рекомендация категории/семейства | Выдавать окончательный SKU или изменять profile без утверждения |

## 5. Модель данных сервиса

Минимальные сущности:

| Сущность | Назначение | Ключевые ограничения |
| --- | --- | --- |
| `Workspace` | Изолирует проект/магазин | стабильный `key`, lifecycle status |
| `PolicyProfile` | Версия правил workspace | `draft` / `published` / `retired`; опубликованная версия неизменяема |
| `FamilyMapping` | Семантический ключ → SKU stem/token | уникальность ключа внутри profile; никаких Synarava-токенов в общем движке |
| `Reservation` | Атомарно занимает следующий номер | unique `(workspace, sku)` и `idempotencyKey`; sequence не возвращается в пул |
| `Assignment` | Связывает SKU с внешним вариантом | unique SKU в workspace; хранит external system/shop/product/variant IDs и policy version |
| `AuditEvent` | Append-only журнал | actor, action, before/after или payload digest, correlation ID, timestamp |

Для Synarava profile v1 суффикс — три цифры `001`–`999` на нормализованный stem. Достижение `999` возвращает явную ошибку `SEQUENCE_EXHAUSTED`; сервис не увеличивает длину молча.

Reservation может стать `confirmed`, `cancelled` или `expired`, но занятый sequence остаётся tombstone и никогда не используется повторно. Это устраняет неоднозначность при timeout между сервисом и Shopify.

## 6. Профиль workspace

Общий движок получает структурированную конфигурацию, например:

```json
{
  "workspace": "synarava-shop",
  "version": 1,
  "separator": "-",
  "suffix": { "width": 3, "start": 1, "reuse": false },
  "families": {
    "jewelry.necklace": "JW-NECK",
    "jewelry.bracelet": "JW-BRACELET",
    "bag.charm": "BA-CH",
    "craft.thread": "DIY-THREAD"
  },
  "allowedCharacters": "^[A-Z0-9]+(-[A-Z0-9.]+)*$"
}
```

Это иллюстрация контракта, не готовый config-файл. Runtime-источник — БД SKU-сервиса; опубликованный профиль редактируется только созданием новой версии. Notion объясняет правила людям, но сервис не читает Notion при генерации.

## 7. API v1

Все mutating-запросы требуют authenticated workspace context, `Idempotency-Key` и `correlationId`. Ответы возвращают `policyVersion` и машиночитаемый error code.

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| `POST` | `/v1/workspaces/{key}/skus/preview` | Нормализовать ввод и показать candidate без reservation |
| `POST` | `/v1/workspaces/{key}/reservations` | Атомарно занять следующий SKU |
| `POST` | `/v1/workspaces/{key}/assignments/confirm` | Подтвердить read-back из Shopify и связать SKU с variant GID |
| `POST` | `/v1/workspaces/{key}/skus/validate` | Проверить существующий/legacy SKU без изменения |
| `POST` | `/v1/workspaces/{key}/assignments/{id}/lock` | Зафиксировать assignment после события публикации/заказа согласно policy |
| `GET` | `/v1/workspaces/{key}/audit-events` | Получить журнал для диагностики/выгрузки |

Критические свойства:

- два конкурентных запроса для одного stem получают разные SKU;
- повтор с тем же idempotency key возвращает прежнюю reservation;
- `preview` никогда не обещает, что candidate останется свободным;
- confirm разрешён только для SKU из reservation или импортированного legacy assignment;
- ошибка Shopify после reservation не освобождает sequence для повторного использования;
- сервис не принимает произвольный новый family token от Catalog Manager: отсутствующий mapping требует draft profile и утверждения Business Owner.

## 8. Основной поток Synarava

1. Catalog Manager выбирает Shopify category/семейство и необходимые атрибуты в Synarava Admin.
2. Admin запрашивает `preview`; пользователь видит candidate и версию policy.
3. При подтверждении Admin вызывает `reservations` с idempotency key.
4. Synarava записывает зарезервированный SKU в конкретный Shopify variant через Admin GraphQL API.
5. Synarava читает variant обратно из Shopify. Только совпавшее значение отправляется в `assignments/confirm`.
6. Обычный Shopify pull обновляет локальную проекцию Synarava; не создаётся параллельная логика сохранения commerce-полей.
7. Ошибка на шагах 4–5 оставляет reservation как tombstone и создаёт видимую recovery-задачу.

Прямое изменение SKU в Shopify не перезаписывается автоматически. Product/inventory webhook или периодический аудит сравнивает его с assignment ledger и создаёт состояние `external_change_detected` для ручного решения.

### 8.1. Первый пользовательский интерфейс

Первая «морда» находится внутри существующего Synarava Admin, в Shopify → Inventory:

- для draft variant показывает `Not assigned`, semantic family/attributes и кнопку preview;
- preview объясняет candidate и policy version, но не резервирует номер;
- подтверждение выполняет reserve → Shopify write → read-back → confirm;
- multi-variant товар показывает таблицу вариантов и позволяет одним подтверждением зарезервировать отсутствующие SKU;
- после публикации SKU отображается read-only как `Locked`; после первого заказа действует более строгий `Order locked`;
- внешнее изменение в Shopify показывает конфликт и требует ручного решения, без молчаливой перезаписи;
- настройки profile v1 сначала находятся в защищённом Synarava Admin Settings и доступны роли Business Owner;
- будущая universal console использует тот же API и не требует переноса domain logic из Synarava.

## 9. Роль n8n

n8n на Railway добавляется после рабочего API, а не раньше. Первые допустимые workflows:

1. Ночной/еженедельный аудит: получить Shopify variants пакетами → вызвать `validate` → сохранить агрегат → уведомить только при отклонениях.
2. Recovery queue: повторить безопасный read-back/confirm после сетевой ошибки, используя прежний idempotency key.
3. Уведомление об исчерпании диапазона, неизвестном family key или внешнем изменении SKU.
4. Экспорт метрик и audit summary без product/customer PII.

Workflow не хранит next number и не вызывает LLM для каждой строки каталога. Обычный аудит формата и уникальности выполняется кодом без токенов. LLM-узел допустим только как отдельная, выключаемая рекомендация для нераспознанной категории.

## 10. Безопасность и эксплуатация

- отдельные credentials и данные для staging/production;
- service-to-service authentication с ротацией; секреты не попадают в n8n payload logs;
- workspace isolation проверяется на каждом запросе и уникальном индексе;
- rate limits и bounded batch size для аудита;
- structured logs без описаний товара и данных покупателей;
- health/readiness endpoints и метрики latency, conflict count, reservation failures, stale reservations;
- backup и миграции PostgreSQL проверяются до production;
- ручной kill switch для записи в Shopify; validation/audit могут оставаться read-only.

### 10.1. Delivery в Railway

Один GitHub-репозиторий подключается к нескольким Railway services:

| Railway service | Source | Build / start | Network |
| --- | --- | --- | --- |
| `synarava-web` | root package | существующие `pnpm build` / `pnpm start` | public storefront + private call to API |
| `sku-api` | `services/sku-api` workspace | `pnpm --filter @synarava/sku-api build` / `start` | private initially; public gateway only for approved external clients |
| `sku-postgres` | Railway PostgreSQL | managed | private only |
| `n8n` | later | отдельный service | private API client where possible |

Для `sku-api` watch paths включают `services/sku-api/**`, `packages/sku-core/**`, `packages/sku-contract/**`, lockfile и workspace config. Изменение SKU-кода не должно автоматически пересобирать storefront, если публичный contract не изменился.

Delivery flow: feature branch → PR CI → merge в `staging` → независимые Railway staging deploys → Shopify staging tests → merge `staging` в `main` → production deploy. API deployment выполняет совместимую migration до readiness; `/health` не возвращает ready до успешного подключения к БД. Synarava использует private Railway domain/reference variable внутри одного environment. Staging и production имеют разные API credentials и разные SKU databases.

## 11. Этапы реализации

### Этап 0 — согласовать документы

- ADR-0004 принят;
- API boundary, TypeScript stack, монорепа и Synarava profile v1 утверждены;
- перед кодом исполнитель сверяет Notion policy с этим RFC и сообщает только о реальном противоречии;
- runtime до Этапа 1 не меняется.

**Выход:** выполнено документами; можно начинать Этап 1.

### Этап 1 — domain POC без Shopify

- чистые функции normalizer/validator/stem builder;
- PostgreSQL-модели workspace/profile/reservation/assignment/audit;
- транзакционный allocator и idempotency;
- идемпотентный legacy importer и безопасные fixtures; фактический импорт 49 записей выполняется при предоставлении канонического export;
- unit/property/concurrency tests.

**Выход:** повторяемый результат, отсутствие коллизий под параллельной нагрузкой, нулевые вызовы LLM.

**Статус реализации (2026-10-12):** выполнено.

- `packages/sku-core` — normalize / stem / format / parse / preview + property + import-boundary tests
- `packages/sku-contract` — Zod schemas for `/v1` (HTTP в Этапе 2)
- `services/sku-api` — Prisma schema + SQL migration, `SkuRegistryStore` + in-memory serializable adapter, allocator, legacy importer + `fixtures/legacy-v0-sample.json`
- `pnpm-workspace.yaml` включает `packages/*` и `services/*`; `pnpm test:sku` / `pnpm test:run` гоняют SKU-тесты
- Wiki: [`docs/wiki/portable-sku-service.md`](../wiki/portable-sku-service.md)
- Канонический import 49 SKU и Prisma Postgres runtime — ops/staging после `SKU_DATABASE_URL`; в CI POC concurrency доказан на in-memory store без Docker

### Этап 2 — HTTP API и admin profile

- endpoints из раздела 7;
- аутентификация и workspace isolation;
- первый UI для draft/publish profile в Synarava Admin Settings с использованием `synarava-cms`;
- audit log и read-only просмотр assignments.

**Выход:** профиль можно версионировать и проверять без ручного изменения БД.

### Этап 3 — Synarava adapter

- заменить локальное придумывание SKU на preview/reserve/confirm;
- работать на уровне каждого `ProductVariant`, а не только primary/default variant;
- сохранять Shopify source-of-truth и существующий normalize/deep-diff контракт;
- убрать или явно обозначить legacy `Product.sku` после миграции чтений;
- не допустить запись SKU в Shopify без read-back и audit correlation ID.

**Выход:** новый staging-товар получает SKU только через сервис; текущие 49 не переименованы.

### Этап 4 — Shopify staging

- multi-variant draft: отдельный SKU на каждый вариант;
- параллельное создание двух вариантов одного family;
- duplicate/empty SKU и прямое внешнее изменение;
- дублирование Shopify-товара;
- публикация, последующая попытка изменения и сохранение SKU в тестовом заказе;
- webhook delay/retry/out-of-order и недоступность SKU-сервиса;
- сверка Shopify, assignment ledger и локальной проекции.

**Выход:** тест-матрица с фактическими результатами и доказательствами; production не затронут.

### Этап 5 — n8n audit automation

- read-only catalog audit;
- batching, checkpoint и идемпотентный повтор;
- уведомление только при новом отклонении;
- измерение времени и стоимости; LLM выключен по умолчанию.

**Выход:** workflow не создаёт SKU и не владеет состоянием; повторный запуск не создаёт побочных изменений.

### Этап 6 — ограниченный production rollout

- сначала один новый draft product;
- feature flag/kill switch;
- ручное подтверждение Business Owner;
- наблюдение минимум одного полного операционного цикла;
- только затем расширение на остальные новые товары и другие workspace.

## 12. Критерии готовности к production

- ADR-0004 принят, profile v1 опубликован и имеет владельца;
- все mutating API идемпотентны и покрыты concurrency tests;
- assignment нельзя случайно связать с другим workspace/variant;
- legacy import даёт 49 valid assignments и не меняет Shopify;
- multi-variant staging flow завершён без single-variant fallback;
- прямое изменение в Shopify обнаруживается и не вызывает автоматическую гонку перезаписи;
- documented recovery существует для timeout после reservation и до confirm;
- audit trail связывает действие пользователя, service request и Shopify mutation;
- n8n отключаем без потери возможности выдать SKU;
- штатный поток не расходует LLM tokens.

## 13. Решения, зафиксированные для реализации

1. Код остаётся в общей pnpm-монорепе; `sku-api` развёртывается отдельным Railway service.
2. `sku-postgres` — отдельный Railway PostgreSQL service/database; staging и production полностью раздельны.
3. `sku-core` создаётся сразу как чистый private workspace package, хотя отдельный Git-репозиторий откладывается.
4. Основной язык — TypeScript; Python допустим только для будущего изолированного AI/data worker.
5. Первый UI профилей и товарный UX находятся в Synarava Admin; universal console создаётся только при появлении второго реального клиента.
6. Lifecycle различает `confirmed`, `publication_locked` и `order_locked`: публикация блокирует обычное редактирование, первый заказ усиливает запрет; исключение требует Business Owner reason + audit event и не должно менять историю заказа.
7. API использует per-workspace service credentials с хэшированным хранением/ротацией и workspace scoping. Browser никогда не получает service secret.
8. Импортируются 49 подтверждённых legacy-v0 SKU без изменения Shopify. До production rollout отдельно выгружаются archived products и импортируются тем же идемпотентным инструментом.

## 14. Отложено без блокировки POC

- Публичный API gateway и authentication для внешнего второго проекта — проектировать при появлении такого клиента; внутренний v1 всё равно должен сохранять workspace isolation.
- Выделение `sku-api`/`sku-core`/`sku-contract` в отдельный Git-репозиторий — после стабилизации `/v1` и доказанной потребности второго проекта.
- Universal admin console и AI-рекомендации категории — после работающего Synarava staging flow.

Эти пункты нельзя реализовывать «на всякий случай» в первом POC. Если исполнитель считает отложенное необходимым, он сначала документирует конкретный блокирующий сценарий и предлагает изменение плана.

## 15. Definition of Done для первого implementation handoff

- создан `pnpm-workspace.yaml`, при этом существующие команды Synarava продолжают работать;
- `packages/sku-core` покрыт unit/property tests и не имеет запрещённых импортов;
- `services/sku-api` имеет отдельную Prisma schema, migrations, `/health`, auth middleware и versioned `/v1` endpoints;
- OpenAPI/schema contract находится в `packages/sku-contract`, а Synarava использует generated/typed client;
- allocator доказан concurrency test: параллельные requests не получают одинаковый SKU;
- idempotency test доказывает одинаковый ответ для повторного ключа;
- legacy importer проходит повторно на fixtures без дублей и не пишет в Shopify; при наличии канонического export dry-run подтверждает 49 записей до staging import;
- staging Railway service и database изолированы от production;
- Synarava staging выполняет preview → reserve → Shopify write → read-back → confirm для одного draft variant;
- существующий Shopify normalize/deep-diff и source-of-truth контракт не обходятся;
- документация обновлена по фактической реализации, а незавершённое не описано как работающее.
