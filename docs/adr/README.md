# Architecture Decision Records

Решения, которые трудно откатить. Формат — [template.md](template.md) (Nygard, коротко: Context / Decision / Alternatives / Consequences). Номер — следующий свободный; заменённый ADR получает `Status: superseded by ADR-NNNN`, а не удаляется.

| ADR | Решение | Status | Date |
|-----|---------|--------|------|
| [0001](0001-shopify-hybrid-commerce.md) | Shopify — единственный commerce backend (Hybrid) | accepted | 2026-08-11 |
| [0002](0002-shopify-catalog-ownership.md) | Shopify владеет каталогом, Synarava — read model + editorial | accepted | 2026-09-08 |
| [0003](0003-commerce-conflict-deep-diff.md) | Детект конфликтов: deep-diff нормализованного Shopify JSON | accepted | 2026-10-10 |
