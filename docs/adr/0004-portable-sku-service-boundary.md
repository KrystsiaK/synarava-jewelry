# ADR-0004: Переносимый SKU-компонент как отдельный сервис

**Date**: 2026-10-12
**Status**: accepted
**Deciders**: владелец проекта

## Context

Ручной аудит Synarava подтвердил, что в снимке каталога все 49 вариантов имеют уникальные SKU, но наблюдаемый словарь не является достаточным контрактом для будущих товаров и других проектов. Нужны атомарная выдача номера, версионируемые правила, неизменяемый журнал и разные профили для разных магазинов. Эти обязанности не принадлежат n8n и не должны превращать локальную базу Synarava во второй каталог: согласно [ADR-0002](0002-shopify-catalog-ownership.md), Shopify остаётся владельцем назначенного `Variant SKU`.

Существующее приложение уже хранит локальную проекцию `Product.sku` / `ProductVariant.sku`, проверяет уникальность в своей БД и синхронизирует variant SKU с Shopify. Часть текущего UI и точечных sync-операций рассчитана на один вариант. Поэтому внедрение требует явного контракта и миграции ответственности, а не второго независимого генератора внутри формы товара.

## Decision

Создать переносимый, multi-workspace SKU-компонент как **отдельно развёртываемый сервис** с собственным API и собственной PostgreSQL database/service. На первом этапе исходный код живёт в общей pnpm-монорепе Synarava, но runtime, данные и контракт не зависят от Synarava UI. После стабилизации API `services/sku-api`, `packages/sku-core` и `packages/sku-contract` можно перенести в отдельный репозиторий без изменения HTTP-контракта.

Реализация использует TypeScript/Node.js, PostgreSQL, Prisma и Zod. `sku-core` остаётся чистым domain package без импортов Shopify, Next.js, React, Railway или Synarava. Synarava и будущие клиенты зависят только от versioned HTTP API и `sku-contract`, но не импортируют `sku-core`.

Граница ответственности:

- Shopify владеет фактически назначенным SKU варианта и остальными commerce-данными;
- SKU-сервис владеет версиями policy profiles, атомарными reservation/assignment records, tombstones и audit events;
- Synarava Admin выступает клиентом сервиса и Shopify-адаптером: получает reservation, записывает SKU в Shopify, проверяет read-back и подтверждает assignment;
- локальные SKU-поля Synarava остаются Shopify-shaped проекцией, а не вторым реестром назначений;
- n8n может запускать аудит, уведомления и восстановительные процессы, но не участвует в критической транзакции выдачи номера;
- LLM/RAG не участвуют в генерации, резервировании, проверке уникальности или принятии решения. Они могут только предлагать классификацию для подтверждения человеком.

Сервис должен быть детерминированным и идемпотентным. Отменённая или истёкшая reservation оставляет tombstone; её номер не выдаётся повторно. Один idempotency key всегда возвращает тот же результат.

## Alternatives Considered

### Генератор непосредственно в Synarava Next.js

- **Why not**: быстро для одного магазина, но связывает правила с текущей формой и БД, затрудняет повторное использование и создаёт риск нескольких реализаций при подключении других проектов.

### n8n как генератор и хранилище состояния

- **Why not**: workflow engine не даёт удобной доменной транзакции, строгой конкурентной блокировки и версионируемого API. Повторный запуск workflow может породить коллизию без отдельного реестра и idempotency contract.

### RAG/LLM как источник правил SKU

- **Why not**: выдача SKU должна быть воспроизводимой и проверяемой. Вероятностный ответ модели не подходит для уникального идентификатора и не заменяет структурированный профиль.

### Сразу отдельный репозиторий

- **Why not**: до проверки контракта это добавляет release/versioning/CI overhead. Отдельная deployable boundary и собственная схема дают возможность безопасно вынести сервис позже без преждевременного разделения разработки.

### Python для основного API

- **Why not**: задача состоит из HTTP, валидации и PostgreSQL-транзакций, а существующий стек уже TypeScript/Prisma/Zod. Второй язык добавит отдельные модели, инструменты и рассинхронизацию контрактов без преимущества для атомарного allocator. Python остаётся допустимым только для будущего необязательного AI/data worker за API-границей.

## Consequences

- **Positive**: один механизм можно использовать для Synarava и других workspace; правила версионируются; номер выдаётся атомарно; токены LLM не расходуются в штатном потоке.
- **Negative**: появляются отдельный runtime, API-аутентификация, миграции БД, observability и обработка частичного сбоя между reservation и записью в Shopify.
- **Risks**: прямое редактирование SKU в Shopify обходит сервис. Оно должно обнаруживаться webhook/периодическим аудитом и попадать в ручное разрешение, а не автоматически перезаписываться.
- **Migration**: существующие 49 SKU импортируются как `legacy-v0` assignments без переименования. Текущие локальные автогенераторы черновых SKU нельзя считать реализацией policy v1.
- **Delivery**: один GitHub-репозиторий поставляет независимые Railway services с раздельными watch paths; runtime SKU и Synarava web **не обязаны** жить в одном Railway project (см. amendment ниже).
- **Follow-up**: целевой контракт и этапы описаны в [`portable-sku-service.md`](../proposals/portable-sku-service.md). Если POC опровергнет решение, нужно создать заменяющий ADR и пометить этот как `superseded`, а не молча изменить границу в коде.

## Amendment — portable SKU platform project (2026-10-14)

**Status:** accepted (architecture; apply gated on operator confirmation)  
**Supplements:** Decision above; does not supersede Shopify SoT or domain boundary.  
**Rename note:** Railway project display name `handsome-commitment` → **`portable-sku-platform`**; immutable project ID **`6d7d5885-43eb-4283-b4a4-e552fc6dba7b`** unchanged. IaC guards on project ID, not display name.

### Context

SKU API is multi-workspace by design. Collocating it inside the Synarava Railway project (`synarava-shop`) couples deploy blast radius and blocks a second client. Staging sku-api lives in project ID `6d7d5885-…` (now named `portable-sku-platform`); `synarava-shop` hosts only the storefront. Cross-project Railway private service references are unavailable for Synarava↔API; clients must use HTTPS. Staging n8n is **same-project** as sku-api and may use private refs.

### Decision

1. Railway project: **`portable-sku-platform`** (ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b`) — multi-workspace SKU API; Synarava is the first client.
2. Synarava Railway project (`synarava-shop`) hosts **web only**. It must not create a duplicate `sku-api` / `sku-postgres` / n8n for SKU.
3. **Staging target:** `sku-api`, `sku-postgres`, **staging `n8n`**, **`n8n-postgres`** (separate persistence), **`n8n-data`**. Current fact may be sku-api+sku-postgres only — that is inventory, not the target.
4. **Production:** out of scope for this IaC; do not modify prod `sku-platform-n8n*`.
5. Synarava ↔ SKU API: **public HTTPS** + per-workspace Bearer + rate limiting **before** scrypt auth (no raw Bearer in rate-limit keys). Same-project n8n may use private `${{sku-api.*}}`.
6. Source code remains in the Synarava pnpm monorepo for now; HTTP contract stays the portability boundary.
7. CI/CD and Railway watch paths are split: shop paths must not redeploy sku-api; sku paths must not redeploy the storefront.
8. IaC apply guard uses the **immutable project ID**. Apply only after `config plan` shows **no** create/delete/replace of existing `sku-api` / `sku-postgres` (creating staging n8n* is expected).

### Consequences

- **Positive**: clear platform boundary; rename-safe IaC identity; staging automation isolated from prod n8n.
- **Negative**: HTTPS exposure needs rate limits; staging n8n cutover needs explicit `plan` review.
- **Ops gate:** do not `railway config apply` until Kiryl confirms [`portable-sku-platform-railway.md`](../runbooks/portable-sku-platform-railway.md).
