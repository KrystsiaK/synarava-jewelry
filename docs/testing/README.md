# Testing docs

```
runbooks/admin-guide-ru.md            ← owner guide (RU, plain language; not a test oracle)
wiki/commerce-sync.md                 ← sync behavior SoT for expected admin sync UX
        ├── admin-test-cases-manual-ru.md      ← как проверить руками
        └── admin-test-cases-playwright-en.md  ← как проверить кодом (слой + целевой spec)
payment-checkout-test-matrix.md       ← checkout/оплата Shopify: матрица + журнал прогонов
portable-sku-staging-matrix.md        ← portable SKU Этап 4: linked/idempotent/multi-variant matrix
product-create-shopify-flow.tdd.md    ← RED/GREEN evidence for the local → Shopify product flow
```

**Правило слоя:** если кейс проверяется без браузера — он не e2e. Playwright берёт только то, что нельзя проверить без реального HTTP-цикла и браузера (guards маршрутов, cookie, загрузка файлов, автосохранение, порядок галереи, сквозные lifecycle). Валидация полей, парсинг тегов, генерация slug, конфликты SKU — Vitest.

Открытый продуктовый вопрос `PROD-C43` — в [tech-debt](../tech-debt.md) (TD-ADM-02). Исходный план автоматизации — [history](../history/2026-09-admin-test-plan.md).
