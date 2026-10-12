# ADR-0002: Shopify владеет каталогом, Synarava — read model + editorial layer

**Date**: 2026-09-08 (backfilled 2026-10-12 из [history](../history/2026-09-admin-shopify-refactor.md#catalog-ownership-decision))
**Status**: accepted
**Deciders**: владелец проекта

## Context

До сентября 2026 в Synarava жили собственные category, tags, department и lifecycle товара параллельно Shopify. Два источника одних и тех же понятий давали расхождения при sync и дублирующие экраны в админке.

## Decision

Shopify — system of record для всего, что Shopify умеет представить (taxonomy category, collections, tags, product type, variant SKU/price, publication). Synarava хранит локальную проекцию и только свои editorial-поля; второго lifecycle для Shopify-понятий не вводит. Детали полей — [`docs/wiki/product-data-ownership.md`](../wiki/product-data-ownership.md).

## Alternatives Considered

### Synarava как master каталога, Shopify как sink
- **Why not**: Shopify Admin, checkout и apps всё равно редактируют каталог — конфликты неизбежны, а владельцем фактически остаётся Shopify.

## Consequences

- **Positive**: один владелец на каждое поле; меньше локального CRUD (удалены Tag CRUD и department-слой).
- **Negative**: Synarava-only поля нужно явно отделять в UI (группы табов Shopify / Synarava); часть Shopify-полей ещё не редактируется из CMS.
- **Risks**: забытое поле при sync — закрыто [ADR-0003](0003-commerce-conflict-deep-diff.md).
