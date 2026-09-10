# План реализации: EN/PT для постов и товаров

## Цель

Добавить управляемый двуязычный контент на английском и португальском для товаров и редакционных постов. Администратор заполняет оба языка в Synarava CMS, витрина читает локализованный контент из локальной базы, а Shopify получает только локализуемую товарную часть, необходимую commerce-каналам и checkout.

## Что уже есть

- Маршруты витрины уже используют `en` и `pt` через `app/[locale]` и `SUPPORTED_LOCALES`.
- UI-переводы лежат в `messages/en.json` и `messages/pt.json`; они не подходят для контента товаров и постов.
- Статические `Page` уже хранят черновой PT-перевод внутри `Page.content.translations.pt` с fallback на EN.
- `Product` пока содержит только один набор текстов. `LocaleTabStrip` в товарной форме — декоративная заготовка с EN/BE/RU и не переключает поля.
- Витрина товаров читает контент из локальной Prisma-базы, а Shopify используется для commerce-синхронизации, медиа, вариантов, остатков, публикации и checkout.
- Shopify push сейчас отправляет только основной `title`, `descriptionHtml` и SEO; Translation API ещё не используется.
- Отдельной доменной сущности `Post` в схеме сейчас нет. Рекомендация — добавить её отдельно, а не превращать статические `Page` в блог.

## Основные архитектурные решения

### 1. Источник истины

| Данные | Источник истины | Направление синхронизации |
|---|---|---|
| Тексты товара EN/PT, представимые Shopify | Synarava CMS + Shopify Translate & Adapt | CMS ↔ Shopify с конфликтами |
| Посты EN/PT | Synarava CMS | Не синхронизировать в Shopify в v1 |
| Цена, SKU, остаток, variant ID | Существующий commerce flow | Текущий push/pull с конфликтами |
| Статус товара и публикация в sales channel | Существующий commerce flow | CMS ↔ Shopify по текущим правилам |
| Медиа товара | Synarava CMS с текущим staging flow | CMS → Shopify |
| UI-строки сайта | `messages/*.json` | Не относятся к контентному CMS |

Поля PT, которые поддерживает Shopify (`title`, `body_html`, SEO), можно редактировать и в Synarava,
и в Shopify Translate & Adapt. Синхронизация использует `updatedAt`, локальный sync status и явные
Pull/Push решения, поэтому параллельные изменения не перезаписываются молча. Локальные editorial-
поля PT остаются только в Synarava.

### 2. Модель данных

Использовать нормализованные таблицы, а не динамический JSON для основного локализованного текста:

```text
Product 1 ─── N ProductTranslation
                 locale: EN | PT
                 title, shortDescription, description
                 materialLine, symbolism*, details
                 seoTitle, seoDescription
                 reviewStatus, reviewedAt, updatedAt

Post 1 ────── N PostTranslation
                 locale: EN | PT
                 title, excerpt, body
                 seoTitle, seoDescription
                 reviewStatus, reviewedAt, updatedAt
```

В `Product` остаются нелокализуемые данные: ID, SKU, цена, остатки, статус, связи, Shopify ID, медиа и canonical slug. На первом этапе существующие `Product.name/description/...` остаются как совместимый EN mirror, чтобы миграция была обратимой и текущий sync не ломался. После стабилизации их можно удалить отдельной миграцией.

Для `Post` добавить самостоятельную модель с canonical slug, cover asset, status/visibility, publishedAt, author attribution и переводами. Статические `Page` оставить отдельным типом контента; существующий JSON PT впоследствии можно мигрировать в `PageTranslation`, но это не блокирует товары и посты.

### 3. URL и fallback

- Один canonical slug для обоих языков: `/en/products/lava-ring` и `/pt/products/lava-ring`; аналогично для постов.
- Не локализовать handle/slug в v1: это сохраняет Shopify identity, ссылки, webhooks и SEO-миграцию простыми.
- Черновик разрешает неполный PT.
- Публикация в статусе `PUBLIC` блокируется, если обязательные EN или PT поля не заполнены и не отмечены как reviewed.
- Fallback PT → EN допустим только для необязательных полей и старых записей на время миграции. Админка явно показывает fallback; публичный контент после завершения миграции не должен молча смешивать языки.

### 4. Как администратор заполняет два языка

Форма делится на две зоны:

1. **Shared / Commerce** — SKU, цена, остаток, Shopify category, коллекции, теги, изображения, статус. Эти поля заполняются один раз.
2. **Content** — реальные вкладки `EN` и `PT`. На каждой вкладке видны только локализуемые поля.

Рекомендуемый пользовательский поток:

1. Создать товар/пост и заполнить shared-поля.
2. Заполнить EN как исходный текст.
3. Перейти в PT. При желании нажать `Create PT draft from EN`; автоматический перевод создаёт только черновик и никогда не публикуется автоматически.
4. Отредактировать PT и нажать `Mark PT reviewed`.
5. Увидеть прогресс `EN 100% · PT 100%` и только после этого опубликовать.
6. Для товара нажать `Save & sync Shopify`; интерфейс отдельно показывает `Local saved`, `EN base synced`, `PT translation synced` или конкретную ошибку.

Требования к UX:

- состояние полей обеих вкладок сохраняется при переключении;
- рядом с вкладкой показываются `Incomplete`, `Draft`, `Reviewed`, `Sync error`;
- список товаров/постов имеет две колонки готовности EN/PT;
- кнопка публикации объясняет, какие обязательные поля отсутствуют;
- на мобильном используются вкладки, на широком экране можно добавить режим side-by-side preview;
- preview открывается сразу для `/en/...` и `/pt/...`.

### 5. Shopify sync

Для товара использовать двухшаговую запись:

1. Существующий `productSet` создаёт/обновляет основную EN-версию и commerce-поля.
2. После получения Shopify Product GID запрос `translatableResource(resourceId)` получает актуальные ключи и `digest`.
3. `translationsRegister` отправляет PT для поддерживаемых Shopify ключей, прежде всего title, description HTML и SEO-полей.
4. Только после успешных шагов локальная запись получает отдельные статусы EN/PT sync и timestamp.

Shopify требует актуальный digest для регистрации перевода, поэтому digest нельзя хранить как вечное значение: его нужно перечитывать непосредственно перед PT push или повторять запрос после digest mismatch. Нужны scopes `read_translations` и `write_translations`. Portuguese (Portugal) locale `pt-PT` должен быть enabled и published в Shopify; в v1 это делается однократно в Shopify Markets и проверяется в `testShopifyAdminConnection`. Автоматическое включение потребует дополнительного `write_locales` и может быть отдельным улучшением.

Pull из Shopify:

- основной язык может продолжать участвовать в существующем commerce conflict flow;
- чистый локальный PT обновляется из Shopify при Pull/Reconcile;
- при изменениях с обеих сторон PT получает `CONFLICT`, а администратор выбирает Pull или Push;
- принудительный Pull применяет Shopify-поля, сохраняя Synarava-only PT editorial content;
- поскольку Shopify не публикует translation-update webhook, translation-only изменения обнаруживаются через Pull, Preview sync или Reconcile.

В Storefront API запросах, где данные товара/корзины читаются непосредственно из Shopify, передавать `@inContext(language: EN|PT_PT)`. Локальный каталог продолжает выбирать `ProductTranslation` по route locale.

### 6. Состояния и наблюдаемость

Не смешивать commerce sync и translation sync в одном флаге. Добавить на перевод минимум:

- `reviewStatus`: `DRAFT | REVIEWED`;
- `syncStatus`: `NOT_APPLICABLE | PENDING | SYNCED | FAILED | CONFLICT`;
- `lastSyncedAt`, `syncError`;
- локальную content signature/hash для определения изменений;
- запись в существующий `AuditLog` на сохранение, review и sync.

## Этапы реализации

### Phase 1 — Контракт и база

1. Зафиксировать перечень локализуемых полей товара и поста, обязательность и fallback policy.
2. Добавить `ProductTranslation`, `Post`, `PostTranslation`, enum статусов и миграцию существующего EN-контента.
3. Добавить typed resolver `resolveProductLocale`/`resolvePostLocale`, который принимает locale явно и не читает его неявно внутри mapper.

### Checkpoint 1

- Старые товары открываются без изменения контента.
- EN backfill полон и повторный запуск миграции безопасен.
- PT fallback покрыт unit-тестами.

### Phase 2 — Один сквозной CMS flow

4. Реализовать двуязычное редактирование и validation для товара: shared + EN/PT, autosave, completeness и preview.
5. Реализовать модель, список, редактор, preview и публикацию постов по тем же locale-компонентам.
6. Обновить storefront product/post loaders, metadata, sitemap/hreflang и локализованный поиск.

### Checkpoint 2

- Администратор создаёт один товар и один пост полностью на EN/PT.
- `/en/...` и `/pt/...` показывают правильный язык без смешивания обязательных полей.
- Неполный PT можно сохранить как draft, но нельзя публично опубликовать.

### Phase 3 — Shopify translations

7. Расширить connection check: translation scopes и published PT locale.
8. Добавить translation client: чтение digests, `translationsRegister`, retry при stale digest и нормализованные ошибки.
9. Встроить PT push после EN `productSet`, разнести статусы commerce/translation и добавить безопасный initial PT pull.
10. Передавать language context в Shopify Storefront/cart queries и проверить checkout language.

### Checkpoint 3

- Изменение EN обновляет Shopify base product.
- Изменение PT появляется в Shopify как PT translation.
- Ошибка PT не откатывает локально сохранённый текст и не маскируется статусом commerce `SYNCED`.
- Повторный push идемпотентен, digest mismatch восстанавливается.

### Phase 4 — Миграция и запуск

11. Backfill существующих товаров, перенести имеющиеся Page PT JSON при решении расширить общий translation layer, сформировать отчёт неполных переводов.
12. Провести e2e, SEO и reconciliation regression tests, затем включить publish gate сначала в warning mode, после заполнения PT — в blocking mode.

## Риски и снижение риска

| Риск | Влияние | Мера |
|---|---|---|
| Два источника PT-текста | Высокое | `updatedAt` + отдельный sync status; параллельные изменения требуют явного Pull/Push |
| Shopify digest устарел | Среднее | Получать digest перед push, один контролируемый refetch/retry |
| Частичный sync EN прошёл, PT упал | Высокое | Раздельные статусы и повторяемый PT step |
| Публикация смешанного языка | Высокое | Completeness + reviewed gate, fallback только для legacy/optional |
| Сломанный поиск на PT | Среднее | Индексировать оба перевода, locale-aware query |
| Сложная миграция текущих Product колонок | Среднее | Сначала EN mirror + backfill, удаление колонок только отдельным этапом |
| Путаница `Page` и `Post` | Среднее | Отдельная Post-модель; Page остаётся статической страницей |

## Решения, принятые для v1

1. Английский остаётся primary locale, португальский — обязательный второй язык.
2. Под «постами» понимается новый журнал/blog с отдельной сущностью `Post`, а не существующие статические `Page`.
3. PT обязателен для публикации новых записей; legacy-записи временно работают с fallback.
4. Shopify-представимые PT-поля можно редактировать в Synarava или Translate & Adapt; локальные editorial-поля редактируются только в Synarava.

## Статус реализации

Основной v1 flow реализован: схема и backfill EN, редакторы EN/PT для товаров и постов,
publication gates, локализованные storefront loaders, Shopify Translation API push, проверка
scopes/`pt-PT`, language context корзины и тесты. Автоматическое включение Shopify locale и
translation-aware preview, двусторонний PT pull/push, разрешение конфликтов и безопасная
перепривязка к дубликату Shopify store по SKU/handle.
5. Slug/Shopify handle остаётся общим для EN/PT в первой версии.

## Официальные Shopify references

- Managing translated content: https://shopify.dev/docs/apps/build/markets/manage-translated-content
- `translatableResources`: https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableresources
- `translationsRegister`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister
- Storefront language context: https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/in-context
- Shop locales: https://shopify.dev/docs/api/admin-graphql/latest/queries/shopLocales
