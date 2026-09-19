# План реализации: единая EN/PT-система переводов с Shopify sync

## Статус

**Approved 2026-09-19 — реализация идёт по build order ниже.** Открытые вопросы решены (см. раздел ниже); Phase 1 (Task 1–2) реализован и проверен (`pnpm exec tsc --noEmit`, `pnpm vitest run lib/i18n`).

Этот документ заменяет прежний узкий план «EN/PT для постов и товаров». Новый охват — весь покупательский контент, редактируемый в Synarava Admin, единый интерфейс EN/PT и двусторонняя сверка с Shopify.

## Цель

- На каждой форме с покупательским текстом есть одинаковые вкладки `EN` и `PT`.
- Вкладки закреплены под верхней панелью и доступны при прокрутке длинной формы.
- Переключается только локализуемый текст; общие данные не дублируются и не сбрасываются.
- Пустой PT явно остаётся пустым, без скрытого копирования EN в поле.
- Все поддерживаемые Shopify переводы синхронизируются через нативный Translation API.
- Структурированный Synarava-контент без подходящего стандартного Shopify resource хранится в translatable app-owned metaobjects/metafields, а не остаётся необъяснимым local-only исключением.
- Ошибки, устаревшие digest и изменения в Shopify не приводят к тихой перезаписи.

## Зафиксированные предположения

1. `EN` — основной язык и source content; `PT` — Portuguese (Portugal), Shopify locale `pt-PT`.
2. «Всё, что может переводиться» означает покупательский контент. Служебный UI админки, логи, ошибки, SKU и внутренние технические имена не локализуются этим проектом.
3. Медиа-файл, порядок и связи — общие. Покупательские `alt`, caption и display label — локализуемые.
4. ~~URL/slug/handle в первой версии остаётся общим.~~ Решено 2026-09-19: локализованные slug/handle включены в scope (см. Task 23 в `tasks/todo.md`), с отдельным SEO/redirect решением, а не как ещё одно поле в существующих registry-таблицах.
5. Один submit сохраняет shared-данные и черновики обеих локалей. Ошибка Shopify не отменяет local save; запись получает sync status и retry.

## Текущее состояние и разрывы

- Стек: Next.js `16.3.3`, React `19.2.4`, Prisma `6.19.3`, PostgreSQL, Vitest, Playwright.
- `ProductTranslation` уже хранит EN/PT readiness и PT Shopify sync status. `lib/shopify/translations.ts` уже получает digest, вызывает `translationsRegister`/`translationsRemove` и поддерживает Product conflicts.
- Product editor имеет реальные EN/PT-вкладки, но это локальная реализация и header не sticky.
- `Page` хранит PT внутри `Page.content.translations.pt`; UI показывает длинный EN-блок, затем длинный PT-блок. Часть Home/Legal полей уже продублирована, но нет единого field contract.
- `Collection` не имеет translation model. Общий `LocaleTabStrip` содержит декоративные EN/BE/RU и ничего не переключает.
- Storefront Copy уже имеет `en:*` и `pt:*`, но отображается двумя колонками.
- Video/media и taxonomy требуют классификации: asset и relation общие, buyer-facing metadata переводится.
- Collections связаны с Shopify для membership/order, но translated copy не синхронизируется.
- Admin-разделы Home, About, Pages, Copy, Videos, Products и Collections входят в scope. Account, Problems и commerce-only поля — нет.

## Capability map и порядок сборки

| Module id | Ответственность | Зависит от |
|---|---|---|
| `translation-contract` | Реестр полей, shared/localized правила, locale/readiness/sync types | — |
| `admin-locale-workspace` | Sticky EN/PT header, panels, сохранение form state | `translation-contract` |
| `shopify-translation-platform` | Resource adapters, digest, register/remove, conflict/reconcile | `translation-contract` |
| `catalog-localization` | Products, options/values, collections, taxonomy, media metadata | первые три модуля |
| `editorial-localization` | Home, About, Pages, Legal, global copy, navigation, video copy | первые три модуля |
| `migration-reconciliation` | Backfill, dry run, Shopify bindings, completeness | catalog + editorial |
| `release-hardening` | E2E, accessibility, наблюдаемость, staged rollout | все модули |

Build order: `translation-contract` → (`admin-locale-workspace`, `shopify-translation-platform`) → (`catalog-localization`, `editorial-localization`) → `migration-reconciliation` → `release-hardening`.

## Единый контракт полей

Каждая сущность получает typed field registry. Он используется формой, validation, completeness и Shopify adapter:

```ts
type LocalizedFieldDefinition = {
  key: string;
  mode: "shared" | "localized";
  required: "always" | "when-published" | "optional";
  kind: "short-text" | "long-text" | "rich-text" | "alt" | "seo";
  shopifyTarget:
    | { kind: "native"; resource: string; key: string }
    | { kind: "metaobject"; definition: string; key: string }
    | { kind: "metafield"; namespace: string; key: string }
    | null;
};
```

Правила:

- `shared` расположен вне locale panel и имеет одно значение для EN/PT;
- `localized` имеет независимые persisted EN и PT;
- пустой PT остаётся пустым в админке; fallback применяется только storefront resolver и учитывается как readiness gap;
- requiredness задаётся по типу контента и публикации;
- buyer-facing поле нельзя добавить без решения: `shared`, Shopify-native target или translatable metaobject/metafield target;
- coverage test сравнивает registry с form/action schemas, чтобы новые поля не выпадали из переводов.

## Что переключается

| Область | Локализуется | Остаётся общей |
|---|---|---|
| Product | title, descriptions, material/symbolism copy, detail labels/text, SEO, option names/values, media alt/caption | Shopify ID, SKU, price, inventory, tax/shipping, category relation, collections, tags as relations, assets/order, status |
| Collection | name, subtitle, descriptions, manifesto, symbolism, section copy, search/SEO, image alt | code, slug/handle v1, membership/order, images, status, nav ordering |
| Page/Home/About/Legal | title, eyebrow, body, quotes, section/lexicon/legal copy, displayed dates, SEO, CTA labels | template, slug v1, visibility/order, assets, CTA href/email targets, status |
| Global copy/navigation | buyer-facing labels, menu/link titles, footer/header copy | target URLs, order, feature flags, contact email value |
| Video/media | title, caption, alt, transcript/description | file/URL, poster, dimensions, duration, order, placement |
| Taxonomy | customer-visible merchant-owned labels | canonical IDs, Shopify taxonomy IDs, filter keys, relations |

## Shopify resource mapping

| Synarava content | Shopify destination |
|---|---|
| Product core copy/SEO | `PRODUCT` (`title`, `body_html`, `product_type`, `meta_title`, `meta_description`) |
| Product options/values | `PRODUCT_OPTION`, `PRODUCT_OPTION_VALUE` |
| Shopify image alt | `MEDIA_IMAGE`; local media metadata through owning app metaobject |
| Collection copy/SEO | `COLLECTION`; image alt through `COLLECTION_IMAGE` |
| Menu/link titles | `MENU`, `LINK` |
| Flat storefront pages | `PAGE`; matching legal policies use `SHOP_POLICY` |
| Structured Home/About/lexicon/global copy | translatable `$app:` metaobjects with stable content identity/field keys |
| Synarava taxonomy/video metadata | translatable `$app:` metaobjects or metafields on the closest native owner |

Перед созданием metaobject definition audit подтверждает, что стандартного Shopify resource нет. Definition включает `translatable` capability, стабильные keys и подходящий Admin/Storefront access. Локальная БД остаётся authoring projection/cache; Shopify хранит опубликованный перевод каждого объявленного target.

## UX locale workspace

Один reusable `AdminLocaleWorkspace` заменяет все текущие варианты UI.

- Header: `position: sticky`, offset от admin topbar через CSS variable, непрозрачный фон, border/shadow и z-index ниже modal.
- EN/PT — ARIA tabs с Arrow/Home/End и видимым focus.
- На mobile header остаётся в одну строку с horizontal overflow; Save и sync/readiness summary не перекрывают поля.
- Активная locale запоминается в `sessionStorage` на admin-сессию.
- Скрытие panel не размонтирует uncontrolled inputs или значения находятся в общем controlled draft; один паттерн применяется везде.
- Shared-раздел показывается один раз. EN/PT panels имеют одинаковые секции и порядок полей.
- Вкладка показывает completeness, review и Shopify status (`Synced`, `Pending`, `Conflict`, `Failed`).
- Validation открывает locale первой ошибки.
- Preview имеет EN/PT links; fallback отмечается в admin preview, но не записывает EN в PT.

## Модель синхронизации

### Запись

1. Server action валидирует shared и обе locale payloads по registry.
2. Локальная транзакция сохраняет контент, audit log и durable sync event (`PENDING`).
3. Sync handler определяет Shopify binding и читает свежий `translatableContent { key, value, digest, locale }`.
4. Непустые значения уходят через `translationsRegister` с `translatableContentDigest`; намеренно очищенные — через `translationsRemove`.
5. Успех фиксирует remote snapshot/hash и `SYNCED`. Ошибка сохраняет local copy, event становится `FAILED` и допускает идемпотентный retry.

### Pull и конфликты

- Изменился только Shopify → Pull обновляет local projection и audit log.
- Изменился только Synarava → Push обновляет Shopify.
- Изменились обе стороны → `CONFLICT`; UI показывает local/remote по каждому полю и требует `Use Shopify` или `Use Synarava`.
- `outdated`/digest mismatch: один свежий refetch/retry, затем conflict/error, без force-write.
- Reconcile проходит pagination для всех зарегистрированных resource types, не только Product.
- `shopLocales` проверяет доступность опубликованного `pt-PT`; health warning блокирует невозможный write.

## Persistence и миграция

- Существующий `ProductTranslation` сохраняется и расширяется только недостающими fields/bindings.
- Для Collection добавляется нормализованный `CollectionTranslation` с copy, review и sync metadata.
- Page PT JSON мигрируется в `PageTranslation`: typed top-level fields + validated template JSON. Старый JSON читается только в переходный период и удаляется после reconciliation.
- Global copy может остаться в `SiteSetting`, если keys типизированы, а sync binding хранится отдельно.
- Shopify binding и sync event общие для resource types, чтобы Page/Collection/Metaobject не копировали Product-specific state machine.
- Backfill имеет `--dry-run`, идемпотентен и выдаёт: mapped, missing PT, missing Shopify identity, conflict, unsupported field.

## Storefront verification

- Shopify Storefront API buyer-facing queries используют `@inContext(language: EN|PT_PT)`.
- Local loaders получают locale явно и выбирают independent translation record.
- Metadata, JSON-LD, search, breadcrumbs, menu labels, image alt и previews тестируются для EN/PT.
- Fallback разрешён для legacy/optional на время backfill, но не делает обязательный PT «готовым».

## Стратегия выпуска

1. Inventory/read-only registry и coverage report.
2. Shared sticky workspace и generic Shopify adapter behind feature flag.
3. Vertical slices: Products → Collections → Pages/Home/About/Legal → Copy/Navigation/Media.
4. Shadow sync: payload/diff логируется без write для новых resource types.
5. Controlled write: включать по resource type и одной тестовой записи.
6. Backfill: dry-run → human approval → batches → reconcile.
7. Enforcement: publication gate включать после заполнения PT и утверждения policy.

Rollback: выключить writes flag, сохранить local translations/bindings и продолжить read-only reconcile. Не удалять Shopify translations массово.

## Риски

| Риск | Влияние | Мера |
|---|---|---|
| Новые поля снова выпадают из переводов | Высокое | Registry + coverage test против form/action schemas |
| Потеря unsaved data при смене вкладки | Высокое | Единый form-state pattern и E2E test |
| Sticky header перекрывает UI | Среднее | CSS offset/stacking contract, desktop/mobile checks |
| Устаревший Shopify digest | Высокое | Fresh digest, один retry, затем explicit conflict |
| Частичный multi-resource sync | Высокое | Durable per-resource events, independent statuses, retry |
| Metaobjects превращаются во второй произвольный CMS | Высокое | Native-resource audit до создания stable `$app:` definitions |
| Сложный Page JSON backfill | Среднее | Template validators, dual-read window, dry-run report |
| PT locale/scopes недоступны | Среднее | Connection health gate и actionable warning |
| Изменения Translate & Adapt не замечены | Среднее | Reconcile и hashes; locale webhooks не считать translation webhooks |

## Open questions — решено 2026-09-19

1. PT обязателен для title/body/SEO после backfill (второстепенные captions остаются optional). Уже частично реализовано для Product (`validateProductPublication`); registry (`required: "when-published"`) распространяет это правило на все entities.
2. Редактирование разрешено и в Synarava, и в Shopify Translate & Adapt. Conflict UI (Task 7) обязателен, не опционален — это увеличивает объём Task 6–7 по сравнению с вариантом "Synarava-only".
3. Локализованные slug/handle нужны сейчас — включены в scope, реализуются отдельным SEO/redirect треком (Task 23), чтобы не совмещать routing-риски с content-переводами.

## Definition of Done

- У каждой admin-формы buyer-facing content есть единый sticky EN/PT workspace; shared fields не дублируются.
- Все registry fields имеют independent EN/PT, validation, completeness и storefront resolver.
- Product, Collection, Page/Home/About/Legal, global copy, navigation и media metadata имеют документированный Shopify target и проходят push/pull/reconcile.
- Нет скрытых local-only переводов без утверждённого исключения.
- Digest mismatch, remote/local/two-sided edit, remove и retry покрыты тестами.
- EN/PT storefront, metadata, search, cart/checkout context проверены.
- Backfill report не содержит неизвестных/unsupported buyer-facing fields.
- Keyboard/mobile/sticky behavior проходит accessibility/E2E.
- Mapping, scopes, rollout и recovery docs соответствуют реализации.

## Task index

Acceptance criteria, зависимости, проверки и предполагаемые файлы находятся в [`tasks/todo.md`](./todo.md).

## Официальные Shopify references

- [Manage translated content](https://shopify.dev/docs/apps/build/markets/manage-translated-content)
- [TranslatableResourceType and supported fields](https://shopify.dev/docs/api/admin-graphql/latest/enums/TranslatableResourceType)
- [translatableResource](https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource)
- [translationsRegister](https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister)
- [translationsRemove](https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRemove)
- [TranslationInput and digest](https://shopify.dev/docs/api/admin-graphql/latest/input-objects/TranslationInput)
- [shopLocales](https://shopify.dev/docs/api/admin-graphql/latest/queries/shopLocales)
- [Metaobject definitions and translatable capability](https://shopify.dev/docs/api/admin-graphql/latest/objects/MetaobjectDefinition)
- [Storefront contextual language](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/in-context)
- [Shopify Markets localization/fallback](https://shopify.dev/docs/apps/build/markets)
