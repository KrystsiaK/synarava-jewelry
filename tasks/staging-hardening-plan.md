# План: staging hardening и единый customer-care email

## Цель

Сделать staging безопасным для тестирования, убрать устаревший Gmail из покупательских поверхностей staging и production, устранить найденную проблему навигации и зафиксировать, что ещё требует внешней настройки в Railway/Shopify.

## Статус

**Реализация завершена локально 3 октября 2026.** Code review, typecheck,
production build и все DB-независимые тесты пройдены. Остаются доставка в
`origin/main`, Railway auto-deploy и внешняя проверка изоляции ресурсов/тестовый
Shopify product.

## Обнаруженные проблемы

1. На staging в footer отображается `synarava.shop@gmail.com`; тот же адрес присутствует в fallback/default-контенте и, вероятно, может появляться на production.
2. Staging разрешает индексацию и публикует sitemap с Railway URL.
3. Скопированный production GTM ID может отправлять staging-трафик в production analytics.
4. CTA `Enter the collection` содержит внутренний `/shop`, но на staging клик не выполняет ожидаемый переход, хотя прямой запрос `/shop` корректно редиректит на `/en/shop`.
5. Каталог staging пуст, поэтому product/cart/checkout flow пока нельзя проверить end-to-end.
6. Изоляция staging Postgres, object storage, Shopify credentials и webhook secrets ещё не доказана только внешними smoke-тестами.

## Принятые решения

- Канонический покупательский адрес: `care@synarava.com`.
- Исторический Gmail заменяется в code defaults и в уже сохранённом CMS-контенте при чтении, чтобы исправление дошло до существующих окружений без опасной массовой перезаписи произвольного пользовательского текста.
- Privacy email остаётся настраиваемым через `NEXT_PUBLIC_PRIVACY_EMAIL`, но безопасный fallback меняется на `care@synarava.com`; staging и production должны иметь то же значение в Railway.
- Любое Railway environment, отличное от `production`, закрывается от индексации и не загружает GTM по умолчанию.
- Внутренние CTA проходят через существующую locale-aware навигацию, а не через сырой путь.
- Данные Shopify не копируются автоматически без явного подтверждения store/credentials: Shopify остаётся source of truth.

## Этапы

### 1. Контракт окружения

- Добавить единый server-side helper определения production/staging.
- Использовать Railway environment name с conventional `NODE_ENV` fallback вне Railway.
- Покрыть helper unit-тестами.

### 2. Защита staging от индексации и analytics pollution

- Для non-production выдавать `robots: noindex, nofollow` в metadata.
- Для non-production генерировать `robots.txt` с `Disallow: /` и не публиковать production-style sitemap.
- Добавить `X-Robots-Tag: noindex, nofollow, noarchive` на staging-ответы.
- Не загружать GTM вне production, если нет отдельного явного override.
- Проверить production-поведение тестами, чтобы staging-guard не затронул основной магазин.

### 3. Единый email `care@synarava.com`

- Вынести канонический customer-care email и legacy aliases в общий модуль.
- Заменить Gmail во всех storefront/legal/service defaults и fallback-значениях.
- Нормализовать известный legacy Gmail в сохранённом CMS-контенте при чтении.
- Обновить тесты и операционную документацию.
- Зафиксировать внешнее действие: установить `NEXT_PUBLIC_PRIVACY_EMAIL=care@synarava.com` в Railway staging и production, если переменная там задана старым значением.

### 4. Исправление home CTA

- Найти фактический источник CTA и locale-link contract.
- Исправить внутреннюю навигацию без изменения внешних ссылок.
- Добавить regression test на переход `/en` → `/en/shop` и `/pt` → `/pt/shop`.

### 5. Staging readiness

- Добавить/обновить runbook с проверкой environment isolation, Shopify callback/logout URLs, Customer Account API, webhooks, storage и DB.
- Явно отметить пустой Shopify staging catalog как внешний блокер product/cart/checkout E2E.
- Выполнить lint, typecheck, профильные unit/integration tests и production build.
- Запустить `graphify update .`.
- Закоммитить и отправить завершённые изменения в `origin/main`.
- После Railway auto-deploy повторить smoke-test staging и проверить revision `/api/health`.

## Acceptance criteria

- [x] Ни одна покупательская поверхность не показывает `synarava.shop@gmail.com`; используется `care@synarava.com`.
- [x] Staging HTML и `robots.txt` запрещают индексацию; staging sitemap не рекламируется поисковикам.
- [x] GTM по умолчанию не загружается на staging и продолжает работать на production.
- [x] Home CTA корректно переходит в локализованный shop.
- [x] Production metadata/robots behavior не регрессирует.
- [x] Проверки проходят; DB-зависимые исключения документированы ниже.
- [ ] Изменения находятся в `origin/main`, staging развернул новый revision.

## Verification 2026-10-03

- `pnpm exec tsc --noEmit` — passed.
- Профильные Vitest tests — 27/27 passed; после review дополнительные
  deployment/robots/config tests — 19/19 passed.
- `pnpm lint` — 0 errors, 23 pre-existing warnings.
- `APP_URL=https://synarava.com pnpm build` — passed. Локальный Postgres не
  работал, поэтому fallback paths напечатали Prisma connection warnings, но
  Next.js успешно сгенерировал 64/64 страниц и завершил build.
- `pnpm vitest run` — 321 files / 1677 tests passed; 9 tests в 4 files требуют
  живой локальный Postgres на `127.0.0.1:55432` и упали только по этой причине.
- `graphify update .` — completed (16,174 nodes / 27,286 edges).

## Внешние проверки, которые нельзя подменять кодом

- Railway staging использует отдельный Postgres service/reference и отдельный S3 bucket/prefix.
- Staging Shopify credentials относятся к staging store, а production credentials — к production store.
- В обоих Railway environments `NEXT_PUBLIC_PRIVACY_EMAIL` не содержит старый Gmail.
- В staging Shopify есть тестовый товар, опубликованный в Headless sales channel, прежде чем считать cart/checkout проверенными.
