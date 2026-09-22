# План: разрешение конфликтов каталога Shopify ↔ Synarava

**Статус:** запланировано, 22 сентября 2026. UX-контракт: [`../docs/admin/catalog-conflict-resolution-ux.md`](../docs/admin/catalog-conflict-resolution-ux.md). Этот план касается только `/admin/products`; существующий широкий план Shopify reconciliation и его незавершённые задачи сохраняются отдельно.

## Передача в реализацию

Другой исполнитель может начинать с этапа 1 этого плана. UX-спецификация выше — целевой контракт для каталога; [`../docs/admin/admin-guide-ru.md`](../docs/admin/admin-guide-ru.md) и текущие тест-кейсы описывают **уже работающий** интерфейс и обновляются по мере замены поведения. Сверить реализацию с исходным кодом и актуальной официальной документацией Shopify до изменения write path. В проекте могут быть несвязанные незакоммиченные изменения: сохранить их и не перезаписывать.

## Что уже есть

- `components/admin/products/products-cms.tsx` открывает сравнение каталогов и `ProductSyncModal`.
- `components/admin/products/product-sync-modal.tsx` показывает импорт, push и архивирование в одном диалоге; отдельный commerce-конфликт раскрывается внутри карточки и может выполняться через forced push/pull.
- `lib/shopify/product-sync.ts` содержит preview и inspection commerce-полей; `app/admin/actions/sync.ts` содержит действия для одного товара и selection. Inspection сейчас отдаёт строки без locale/field identity.
- `lib/shopify/reconciliation-run.ts` и `/admin/api/shopify/reconcile/apply` дают field-level расхождения переводного содержимого с locale, fingerprints и результатом по полям; UI находится в `/admin/translations`.
- `StorefrontLocale` уже поддерживает несколько языков, включая добавленный `ru`. У русского пока может не быть заполненного и проверенного текста конкретного товара; отсутствие перевода нельзя выдавать за обнаруженный конфликт.
- У товара нет отдельного server-side признака «входящее изменение ещё не просмотрено этим администратором». Текущий `reviewedAt` относится к review перевода и не подходит.

## Правила реализации

1. Единицей интерфейса служит товар; единицей решения и записи служит поле с scope `product + locale/shared + target`. Показанный preview и серверный apply обязаны использовать одинаковый список полей.
2. Shopify остаётся источником истины для commerce. Локальная запись допустима как синхронизированная проекция или Synarava-редакционный слой. Запись в Shopify использует его native product/translation ресурсы, без нового параллельного commerce-хранилища.
3. Массовое действие выбирает только выявленные конфликты каталога. Односторонние изменения, новые/исчезнувшие товары и архивирование сохраняют самостоятельные сценарии.
4. Не обещать полное перезаписывание базы или магазина: scope показан по товарам/полям/языкам и повторно валидирован на сервере.
5. По завершении каждого этапа обновлять нужную документацию и knowledge graph (`graphify update .`).

## Этапы и задачи

### 1. Единый read model конфликта товара — ✅ реализовано (2026-09-22, исправлено 2026-09-22, трижды)

**Результат:** `lib/shopify/catalog-conflict.ts` — `getProductCatalogConflict(productId)` связывает commerce inspection (`inspectProductSyncState`) и переводные divergences (`getLatestReconcileDifferences`) по product ID. Каждое поле — `CatalogConflictField`: `fieldKey`, `label`, `scope` (`{kind:"SHARED"}` либо `{kind:"LOCALE", code, name, nativeName}`), `origin`, `targetKind`, обе версии значения, `baseValue`, fingerprints, `allowedDirections`, `blockedReason`. `listConflictedProductIds()` — дешёвый catalog-wide список для сигналов (без live Shopify fetch на товар).

**Принятые решения (соответствуют разделу «Решения, требующие проверки», п.1):**
- Commerce-инспекция включается в конфликт только при `state === "CONFLICT"` (двустороннее расхождение); `REMOTE_CHANGES`/`LOCAL_CHANGES` остаются односторонним сценарием и не попадают в поля конфликта.
- Метки `Name`/`Handle`/`Description`/`SEO title`/`SEO description` из commerce-инспекции читают те же колонки `Product`, что и translation-reconcile под локалью `en` (см. `productSourceCopy` в `reconciliation-source.ts`) — это одно и то же расхождение в двух формах. Commerce-версия отбрасывается **только когда translation-reconcile уже сообщил именно про этот field key как `CONFLICT` под локалью `en`** (сверка по карте `COMMERCE_TRANSLATION_FIELD_KEY`, например `Name → title`), а не просто по факту существования `ShopifyTranslationBinding` — см. «исправленная проблема #2» ниже.
- Перевод считается конфликтом только при `kind === "CONFLICT"`; `LOCAL_ONLY`/`SHOPIFY_ONLY` остаются вне этого read model (свои сценарии импорта/push).
- `allowedDirections` пока всегда содержит оба направления, `blockedReason` всегда `null` — реальная проверка «можно ли безопасно записать поле» относится к этапу 2 (scoped apply contract); типы уже держат место под неё.
- `listConflictedProductIds()` берёт commerce-часть из персистентного `Product.syncStatus === "CONFLICT"` (его выставляют вебхуки), а не через live-инспекцию каждого товара — иначе список каталога делал бы N обращений к Shopify на каждую загрузку страницы.

**Исправленная проблема #1 (код-ревью, раунд 1):** `getLatestReconcileDifferences()` фильтровала расхождения по id **единственного глобально последнего** run'а — после точечной проверки одного товара/локали расхождения всех остальных, всё ещё нерешённых товаров/локалей исчезали из ответа. Исправление — на уровне персистентности:
- `persistDifferences` сначала «гасит» (`resolvedAt = now()`) старые нерешённые строки для проверенной пары `(bindingId, locale)`, затем вставляет свежие строки для того, что всё ещё различается.
- `getLatestReconcileDifferences()` больше не фильтрует по единственному `runId`: она берёт последнюю нерешённую строку по каждой паре `(bindingId, locale, fieldKey)` (`ROW_NUMBER() OVER (PARTITION BY ...)`), независимо от того, какой run её произвёл.
- `getLatestEntityReconcileState` (`app/admin/api/shopify/reconcile/route.ts`) обновлена под новую семантику — не отбрасывает результат, если самый последний run не `SUCCEEDED`/`PARTIAL`.
- `getProductCatalogConflict`/`listConflictedProductIds` больше не читают `getLatestReconcileRun()` и не имеют флага `translationChecked`.

**Исправленная проблема #2 (код-ревью, раунд 2):** первая версия retire-фикса (раунд 1) гасила старые строки только для полей, **отсутствующих** в новом наборе различий (`fieldKey NOT IN (...)`) — то есть поле, которое **продолжает** различаться, получало вторую (новую) строку, а старая оставалась нерешённой. Как только новую строку резолвили через apply-flow (`applyReconcileChoice`, конкретный `divergenceId`), `ROW_NUMBER()`-запрос снова поднимал старую, никем не резолвленную строку как «текущую» — разрешённый конфликт мог появиться в списке заново со старыми значениями. Исправление: `retireStaleDifferences(bindingId, locale)` больше не принимает список полей для сохранения — при каждой перепроверке пары `(binding, locale)` она безусловно гасит **все** её нерешённые строки (включая поля, которые всё ещё различаются), и только затем вставляются свежие строки для текущего состояния. Для любой пары `(bindingId, locale, fieldKey)` в любой момент существует не больше одной нерешённой строки, так что резолв текущей строки больше не может «открыть» устаревший дубликат.

**Исправленная проблема #3 (код-ревью, раунд 2):** первая версия EN-дедупликации исключала commerce-версию **по факту существования `ShopifyTranslationBinding`**, не проверяя, действительно ли translation-reconcile уже отчитался об этом конкретном поле. Товар с существующим, но ещё не (пере)проверенным биндингом терял конфликт названия/описания полностью — он не показывался ни как commerce (отброшен), ни как translation (ещё не проверено, строки нет). Исправление: `getProductCatalogConflict` теперь строит `enConflictFieldKeys` — множество `fieldKey`, по которым translation-reconcile **уже** вернул `kind === "CONFLICT"` под локалью `en` для этого товара, — и отбрасывает commerce-дубликат точечно, только когда соответствующий `fieldKey` (через `COMMERCE_TRANSLATION_FIELD_KEY`) в этом множестве есть. Зависимость от `findTranslationBinding`/`ShopifyTranslationBinding` убрана из этого модуля целиком — она была недостаточным сигналом.

**Исправленная проблема #4 (код-ревью, раунд 3):** в фиксе #2 «гашение» старых строк (`retireStaleDifferences`) и вставка новых выполнялись как **два отдельных** database-вызова — сначала самостоятельный `db.$executeRaw(UPDATE...)`, затем отдельный `db.$transaction([...INSERT])`. Если вставка падала (сетевой сбой, невалидное значение, обрыв соединения), UPDATE уже был закоммичен: реальные, ещё не решённые конфликты этой пары `(binding, locale)` оказывались молча погашены, а заменяющих их новых строк не было — обнаружить это можно было только по логам ошибки, не по данным. Исправление: `retireStaleDifferences(bindingId, locale)` теперь **строит, но не выполняет** UPDATE (возвращает `PrismaPromise`), и `persistDifferences` передаёт его первым элементом в тот же массив, что уходит в `db.$transaction([retire, ...inserts])` — гашение и вставка коммитятся или откатываются вместе одной транзакцией. Если вставка бросает исключение, вся транзакция (включая retire) откатывается, старые строки остаются нерешёнными, а ошибка поднимается из `persistDifferences` в `try/catch` вызывающего цикла `runTranslationReconciliation`, попадает в `failures` и корректно отражается в статусе run'а (`FAILED`/`PARTIAL`, `checkedCount` для этой пары не увеличивается) — вместо тихой потери данных.

**Критерии:** ✅ конфликт одного языка не помечает остальные; shared commerce не получает язык; несколько локалей одного товара отображаются отдельно; языки берутся из реестра без фиксированного списка (проверено на 4-й локали DE); отсутствие ещё не созданного перевода не выдается за конфликт; точечная/неудачная проверка не прячет ранее найденные, всё ещё актуальные конфликты других товаров/локалей; разрешённый через apply конфликт не может «воскреснуть» из старой нерезолвленной строки того же поля; EN-конфликт не исчезает бесследно, если translation-reconcile ещё не отчитался именно по этому полю; сбой вставки не гасит существующие конфликты — retire и insert атомарны.

**Проверка:** `lib/shopify/__tests__/catalog-conflict.test.ts` — 16 table-driven тестов (shared/EN/PT/RU/DE, мультиязычный товар, чужой productId, LOCAL_ONLY/SHOPIFY_ONLY, точечное исключение commerce-дубликата только при совпадении fieldKey+en+CONFLICT, сохранение commerce-версии при отсутствии/несовпадении translation-конфликта). `lib/shopify/__tests__/reconciliation-run.test.ts` — 4 теста: безусловный retire-then-insert (без `NOT IN`) внутри одного `$transaction`, порядок построения вызовов (retire перед insert), и новый тест на откат — падение `$transaction` при вставке не должно давать «тихий успех» (проверяется итоговый статус run'а `FAILED` с текстом ошибки и что не было отдельного, вне транзакции, retire-вызова). `npx tsc --noEmit` чист; полный `lib/shopify` + `app/admin` тест-сьют (227 тестов) зелёный.

**Зависимости:** нет. **Места:** `lib/shopify/catalog-conflict.ts`, `lib/shopify/__tests__/catalog-conflict.test.ts`, `lib/shopify/reconciliation-run.ts` (`persistDifferences`, `retireStaleDifferences`, `getLatestReconcileDifferences`, `getLatestEntityReconcileState`), `lib/shopify/__tests__/reconciliation-run.test.ts`.

**Открытый вопрос для этапа 2/5 (не исправлялся сейчас):** commerce-статус (`ProductSyncInspection.state`) определяется для товара **целиком** — одно `CONFLICT`/`REMOTE_CHANGES`/`LOCAL_CHANGES` на весь набор commerce-полей, а не по каждому полю отдельно (в отличие от translation-стороны, где конфликт — per field). Это означает: если хотя бы одно commerce-поле разошлось в обе стороны, весь набор commerce-различий для этого товара показывается как конфликт, даже если конкретное поле A на самом деле однонаправленно изменилось, а различается только поле B. Для read model'а (этап 1) это не проблема — он честно показывает то, что вернула инспекция. Но перед реализацией выбора **по отдельным commerce-полям** (диалог 2, этап 5) и перед scoped apply (этап 2) это нужно учесть: нельзя просто «выбрать Shopify для поля A» и считать это independent от поля B, пока источник данных сам не даёт per-field commerce state. Возможные направления: либо переписать `inspectProductSyncState` на честный per-field diff с направлением (это отдельная, более крупная задача), либо на этапе 2 явно документировать, что commerce-scoped apply переписывает весь commerce-набор атомарно, а не поле за полем.

**Дальше:** этап 2 (scoped preview/apply contract) — единственный потребитель этого read model пока не подключён; UI (этапы 3–5) и запись (этап 2) ещё предстоит связать с `getProductCatalogConflict`/`listConflictedProductIds`.

### 2. Контракт preview/apply и защита записи — ✅ реализовано (2026-09-22)

**Результат:** `lib/shopify/catalog-conflict-apply.ts` — `previewCatalogConflictResolution(scope)` резолвит `BULK` (одно направление, все конфликтующие товары), `PRODUCT` (один товар, одно направление) или `MANUAL` (список `{productId, fieldKey, direction}`) в конкретные поля с текущими значениями, флагом `willClearNonEmptyValue` и список `excluded` (поле не попало в scope + причина). `applyCatalogConflictResolution({entries, acknowledgeClears, actorUsername})` принимает точно то, что вернул preview (`productId`, `fieldKey`, `direction`, `expectedLocalFingerprint`, `expectedShopifyFingerprint`), заново читает текущий `getProductCatalogConflict` для каждого затронутого товара и только потом пишет. Экшены-обёртки: `previewCatalogConflictResolutionAction`/`applyCatalogConflictResolutionAction` в `app/admin/actions/sync.ts` (пока без UI-вызывающей стороны — предыдущие поля).

**Принятые решения:**
- Translation-поля применяются через уже существующий `applyReconcileChoice` (по одному вызову на поле, с `sourceId` — id строки `ShopifyFieldDivergence`, добавлен в `CatalogConflictField` этим этапом) — он уже atomic, fingerprint-checked и idempotent (claim/resolvedAt), повторного изобретения не потребовалось.
- Commerce-поля (per открытый вопрос этапа 1: commerce-статус целиком по товару, не по полю) применяются **атомарно на товар**: все commerce-поля одного товара, выбранные в одном направлении, группируются и пишутся **одним** вызовом `pushProductToShopify(productId, true)` либо `pullShopifyProduct(shopifyProductId, undefined, true)` — существующие whole-product force-push/pull, без нового параллельного commerce write path (правило реализации №2). Если ручной выбор просит **разные** направления для commerce-полей одного товара, лишние поля попадают в `excluded` с объяснением, а не смешиваются — так решение из этапа 1 закрыто, а не отложено дальше.
- Commerce-поля получили настоящие fingerprints (sha256 от уже нормализованного `inspectProductSyncState`-значения) и `sourceId: null`; раньше (этап 1) оба фингерпринта были `null`-заглушкой — теперь stale-проверка работает одинаково для commerce и translation.
- Идемпотентность повторного batch реализована без отдельной batch-id таблицы: `applyCatalogConflictResolution` перечитывает состояние конфликта перед каждой записью и сравнивает с `expected*Fingerprint`; после первого успешного применения значение меняется, поэтому повторная отправка того же запроса естественно получает `STALE`, а не повторную запись.
- Подтверждение очистки — один флаг `acknowledgeClears` на весь вызов (соответствует одному подтверждению в Диалоге 3 UX-спеки); блокируются только реально очищающие записи конкретного вызова, остальные применяются как обычно (partial success).
- Ограничения размера партии: `BULK`-preview берёт не более 50 конфликтующих товаров (`truncated: true` при обрезке); `applyCatalogConflictResolution` отклоняет весь вызов, если записей больше 200 — без частичного исполнения.
- **Live Shopify round trip не выполнен в этом раунде** — по плану он обязателен только перед выпуском (этап 7), а не перед принятием кода; здесь у агента нет доступа к тестовому Shopify-магазину. Обязательно сделать вручную/в CI с реальными credentials до релиза этого flow.

**Критерии:** ✅ изменение после preview → `STALE` без перезаписи (fingerprint mismatch **и** поле, вовсе исчезнувшее из конфликта, оба покрыты); partial success виден по каждой записи отдельно (один упавший push не блокирует другой товар); повторный batch идемпотентен (доказано тестом: тот же payload второй раз даёт `STALE`, `applyReconcileChoice` не вызывается повторно); очистка непустого значения требует `acknowledgeClears`; неподдерживаемое поле (direction не в `allowedDirections`, `blockedReason`, либо конфликт commerce-направлений на одном товаре) не попадает в применяемый scope — видно в `excluded`/`UNSUPPORTED`.

**Проверка:** `lib/shopify/__tests__/catalog-conflict-apply.test.ts` — 15 server contract тестов (BULK/PRODUCT/MANUAL resolve, смешанные commerce-направления на одном товаре, clearing gate до/после подтверждения, stale по fingerprint и по полностью исчезнувшему полю, partial success на разных товарах, группировка нескольких commerce-полей в один push/pull вызов, идемпотентный повторный submit, отказ на batch больше лимита). `lib/shopify/__tests__/catalog-conflict.test.ts` — доп. 2 теста на новые `sourceId`/commerce-fingerprints. `npx tsc --noEmit`, `eslint` на изменённые файлы и полный `lib/shopify` + `app/admin` тест-сьют (244 теста) чисты.

**Зависимости:** 1 (реализован). **Места:** `lib/shopify/catalog-conflict-apply.ts` (новый), `lib/shopify/__tests__/catalog-conflict-apply.test.ts` (новый), `lib/shopify/catalog-conflict.ts` (добавлены `sourceId`, реальные commerce fingerprints), `app/admin/actions/sync.ts` (`previewCatalogConflictResolutionAction`, `applyCatalogConflictResolutionAction`).

**Дальше:** этапы 3–6 (UI) пока не вызывают новые экшены — потребитель появится вместе с диалогами каталога. Перед этапом 7 (выпуск) — обязательный live Shopify round trip для push/pull-групп commerce и для translation apply на реальном тестовом товаре.

### 3. Сигналы каталога и языковые метки

**Результат:** два заметных входа `Показать конфликты`, счётчик товаров и метки для всех затронутых зарегистрированных языков (`PT`, `RU`, `EN` и следующих) плюс `Общее` в строках каталога. Состояния checking, stale, failed и disconnected различимы.

**Критерии:** оба входа открывают один список; метка строки фокусирует нужный товар; код, имя и порядок локалей приходят из registry; при N локалях виден компактный `+N` и полный перечень доступен в диалоге; цвет не единственный сигнал; при удалении последнего конфликта оба счётчика обновляются.

**Проверка:** component tests state matrix и desktop/mobile keyboard check.

**Зависимости:** 1. **Вероятные места:** `app/admin/(admin)/products/page.tsx`, `components/admin/products/products-cms.tsx`, admin tokens/styles.

### 4. Список конфликтующих товаров

**Результат:** новый focused modal со списком, тремя icon-actions на товаре и двумя массовыми направлениями. Импорт новых товаров и архивирование остаются доступными отдельно, без смешения с конфликтами.

**Критерии:** иконки имеют tooltip при hover/focus, доступное имя и 44 px hit area; действия записи ведут в preview; недоступные направления объяснены; список поддерживает десятки товаров без деградации.

**Проверка:** component interactions, клавиатура, длинный список, 0/1/N товаров, узкий экран.

**Зависимости:** 1–3. **Вероятные места:** `components/admin/products/product-sync-modal.tsx` либо новые focused components, `products-cms.tsx`.

### 5. Детали и общий confirmation modal

**Результат:** сравнение двух сторон с решением на каждом поле; preview всех операций использует один компонент с прокручиваемым body и закреплённым footer.

**Критерии:** merge недоступен до выбора всех конфликтных полей; отмена preview возвращает к источнику с сохранённым выбором; язык (включая RU) либо `Общее` виден в каждой строке; bulk перечисляет все изменяемые товары и поля; на мобильном сравнение читается без горизонтального scroll.

**Проверка:** keyboard/focus/Escape, light/dark, reduced motion, длинный текст, большое число строк. Проверить и при необходимости исправить nested modal focus/inert в `components/ui/animated-modal.tsx`.

**Зависимости:** 2, 4. **Вероятные места:** новые компоненты comparison/confirmation, `components/ui/animated-modal.tsx`, styles.

### 6. Прогресс, результат и непросмотренные входящие изменения

**Результат:** состояние applying и итог по товарам; успешный single merge удаляет карточку и оставляет список открытым; массовый apply закрывает список и показывает итог в каталоге. После Shopify → Synarava сохраняется per-admin watermark просмотра товара.

**Критерии:** входящее изменение помечено до первого открытия деталей данным администратором; новый update после просмотра помечает товар снова; Synarava → Shopify не ставит маркер; частичный сбой оставляет неразрешённые карточки; статус success появляется только после verification.

**Проверка:** migration/idempotency tests, два администратора, повторное обновление, открыть список без открытия товара, частичный batch failure, E2E полный путь.

**Зависимости:** 2, 5. **Вероятные места:** Prisma schema/migration, server action/route просмотра товара, `products-cms.tsx`, product detail route, audit history.

### 7. Выпуск и переносимость

**Результат:** каталоговый flow проверен на контролируемом Shopify test product; старый обходной forced flow не оставляет непроверенного shortcut. Общие modal primitives и field view types документированы для последующего применения в Collections/Pages/Copy.

**Критерии:** controlled round trips для доступных заполненных локалей (EN/PT и RU после появления проверенного RU-контента), commerce round trip, read-after-write, rollback/restore procedure, обновлённые admin guide и тест-кейсы, результаты accessibility/performance на desktop/mobile. Перенос на другие сущности требует отдельного решения после UX-review каталога.

**Проверка:** focused tests, typecheck, lint, production build, Playwright для обоих направлений и ручного merge; human review фактического UI.

**Зависимости:** 1–6.

## Контрольные точки

- **После 1–2:** один согласованный field scope и серверное preview/apply; никакой UI-write без guard.
- **После 3–5:** пользователь различает язык и общие поля, до записи видит каждую потерю/замену и может отменить любой шаг.
- **После 6–7:** результат проверен, непросмотренные входящие изменения видны по администратору, документация и graph актуальны.

## Риски и решения

| Риск | Решение |
|---|---|
| Commerce preview и translation reconcile спорят о статусе товара | Явный единый read model с источником каждого поля и временем проверки |
| Forced whole-product write затирает невыбранный язык/поле | Scoped server apply; старое действие не вызывается из нового flow без доказанного совпадения scope |
| Shopify меняется между preview и confirm | Fingerprints/digest + повторное чтение перед записью, stale result |
| В batch часть товаров успешна, часть нет | Итог по каждому товару, unresolved остаются в списке; без общего ложного success |
| Nested dialogs ломают фокус или Escape | Проверить stack management до подключения второго слоя |
| «Непросмотрено» исчезает от простого рендера | Persisted per-admin viewed watermark обновляется только на открытии деталей после входящего изменения |

## Вне первого релиза

Распространение на Collections/Pages/Copy, автоматический выбор победителя при конфликте, массовое архивирование в конфликтном flow, редактирование самих значений прямо в diff, изменение незатронутых языков при решении конфликта одной локали.
