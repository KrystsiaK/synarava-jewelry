# Документация Synarava

Карта всей документации репозитория. Код — источник истины; если документ расходится с кодом, прав код, а документ правится в том же PR (см. «Documentation hygiene» в [`AGENTS.md`](../AGENTS.md)).

## Разделы

| Раздел | Что лежит | Жизненный цикл |
|---|---|---|
| [`wiki/`](wiki/) | **Как система устроена сейчас**: архитектура, контракты, ownership данных, UI-библиотека | Всегда актуально; правится вместе с кодом |
| [`runbooks/`](runbooks/) | **Как это эксплуатировать**: деплой, staging, ops после покупки, переводы, гайд по админке | Всегда актуально |
| [`testing/`](testing/) | Тест-кейсы и тестовые матрицы | Обновляется с поведением |
| [`adr/`](adr/) | **Решения**, которые трудно откатить (почему так, а не иначе) | Append-only; устаревшее → `superseded` |
| [`proposals/`](proposals/) | **Предложения / RFC / POC**: что ещё не сделано | Реализовано → `history/`; отклонено → удалить или ADR |
| [`strategy/`](strategy/) | Бизнес-стратегия (рост, операционка) | Кандидаты на перенос в Notion — см. proposal ниже |
| [`audits/`](audits/) | Датированные аудиты (security, UX, privacy, infra) | Снимок на дату; не правится, кроме пометки «закрыто» |
| [`history/`](history/) | Завершённые планы и журналы работ | Только чтение; открытые хвосты — в tech-debt |
| [`tech-debt.md`](tech-debt.md) | **Единый реестр** осознанно отложенной работы | Закрыл → удали строку |

Вне `docs/`: [`README.md`](../README.md) (запуск), [`AGENTS.md`](../AGENTS.md) / [`CLAUDE.md`](../CLAUDE.md) (правила для агентов), [`PRODUCT.md`](../PRODUCT.md) и [`DESIGN.md`](../DESIGN.md) (продуктовый и дизайн-контекст, их читают design-скиллы), `mobile/README.md` (Capacitor-обёртка).

## Куда класть новый документ

1. Описывает текущее поведение кода → `wiki/` (или дополни существующий файл).
2. Пошаговая процедура для человека → `runbooks/`.
3. Выбор между вариантами, который трудно откатить → `adr/NNNN-*.md` по [шаблону](adr/template.md).
4. План/идея, которой ещё нет в коде → `proposals/`. Первая строка после заголовка — `**Статус:** …`.
5. Сознательно отложили → строка в [`tech-debt.md`](tech-debt.md), не отдельный файл.
6. План выполнен → `git mv` в `history/YYYY-MM-<тема>.md`, хвосты → tech-debt.

Имена: `kebab-case.md`; датированные (`audits/`, `history/`) начинаются с `YYYY-MM-`. Корень репозитория для документов не используется.

## Индекс

**Wiki** — [architecture](wiki/architecture.md) · [product-data-ownership](wiki/product-data-ownership.md) · [commerce-sync](wiki/commerce-sync.md) · [catalog-conflict-resolution-ux](wiki/catalog-conflict-resolution-ux.md) · [portable-sku-service](wiki/portable-sku-service.md) · [portable-sku-current-status](wiki/portable-sku-current-status.md) · [synarava-cms](wiki/synarava-cms.md) · [ui-kit](wiki/ui-kit.md) · [ephemeral-toast](wiki/ephemeral-toast.md) · [storefront-locale-urls](wiki/storefront-locale-urls.md) · [translation-field-registry](wiki/translation-field-registry.md) · [privacy-operations](wiki/privacy-operations.md) · [analytics/ga4-ecommerce-setup](wiki/analytics/ga4-ecommerce-setup.md) · [ecc-skills](wiki/ecc-skills.md)

**Runbooks** — [deploy](runbooks/deploy.md) · [staging](runbooks/staging.md) · [portable-sku current status](runbooks/portable-sku-current-status.md) · [portable-sku-platform-railway](runbooks/portable-sku-platform-railway.md) · [portable-sku-platform-production](runbooks/portable-sku-platform-production.md) · [sku-api-railway-staging](runbooks/sku-api-railway-staging.md) · [sku-catalog-audit-staging](runbooks/sku-catalog-audit-staging.md) · [post-purchase-ops](runbooks/post-purchase-ops.md) · [translation-operations](runbooks/translation-operations.md) · [translation-migration](runbooks/translation-migration.md) · [admin-guide-ru](runbooks/admin-guide-ru.md) · [shopify-automation-playbook](runbooks/shopify-automation-playbook.md)

**Testing** — [обзор](testing/README.md) · [admin manual (RU)](testing/admin-test-cases-manual-ru.md) · [admin Playwright (EN)](testing/admin-test-cases-playwright-en.md) · [payment/checkout matrix](testing/payment-checkout-test-matrix.md) · [portable SKU staging matrix](testing/portable-sku-staging-matrix.md) · [legacy SKU backfill evidence](testing/legacy-sku-backfill.md)

**ADR** — [индекс](adr/README.md)

**Proposals** — [documentation-knowledge-system](proposals/documentation-knowledge-system.md) · [portable-sku-service](proposals/portable-sku-service.md) · [catalog-server-pagination](proposals/catalog-server-pagination.md) · [customer-communication](proposals/customer-communication.md) · [shopify-post-purchase-flows](proposals/shopify-post-purchase-flows.md)

**Strategy** — [growth](strategy/growth.md) · [ecommerce-operating-infrastructure](strategy/ecommerce-operating-infrastructure.md)

**Audits** — [2026-07 security](audits/2026-07-security.md) · [2026-08 security](audits/2026-08-security.md) · [2026-08 UX](audits/2026-08-ux.md) · [2026-09 privacy](audits/2026-09-privacy.md) · [2026-09 infrastructure](audits/2026-09-infrastructure.md)

**History** — см. [`history/`](history/) (по дате в имени файла).
