# ADR-0003: Детект конфликтов через deep-diff нормализованного Shopify JSON

**Date**: 2026-10-10 (backfilled 2026-10-12 из AGENTS.md и skill `shopify-commerce-compare`)
**Status**: accepted
**Deciders**: владелец проекта

## Context

Ранний детект конфликтов сравнивал поля по allowlist (`VARIANT_FIELD_COMPARATORS`). Allowlist забывал поля (например `taxable`), и каждое новое поле требовало отдельного патча.

## Decision

Каждая сущность хранит Shopify-shaped окна (`workingSnapshot` / `shopifySnapshot`, store `CommerceSyncStore`). Один normalize убирает технический шум и применяется и перед save, и перед compare; конфликт = deep-diff объектов. Allowlist для детекта запрещены. Текущая модель — [`docs/wiki/commerce-sync.md`](../wiki/commerce-sync.md).

## Alternatives Considered

### Field allowlist comparators
- **Why not**: теряет поля молча; именно это и произошло.

### Сравнение view-колонок сущности (`priceCents`, …)
- **Why not**: колонки — проекция для UI, второй ось сравнения быть не должно; локальный save обязан write-through в snapshot.

## Consequences

- **Positive**: новое поле Shopify попадает в детект автоматически.
- **Negative**: normalize должен знать весь технический шум; ошибка в нём даёт ложные конфликты.
- **Risks**: расхождение normalize между save и compare — правило «одна функция» в skill и AGENTS.md.
