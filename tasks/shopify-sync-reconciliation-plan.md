# План: понятная сверка и точечный sync с Shopify

## Статус

**In implementation — 2026-09-20; original design baseline.** Detection, field-level review, scoped writes, locale-aware reconciliation, and editor conflict entry points have since been implemented. This document retains the original EN/PT examples and initial problem list as design history; they do not describe every current screen or limit the now registry-based language support. For the next catalog UI implementation, use [`catalog-conflict-resolution-plan.md`](./catalog-conflict-resolution-plan.md) and its linked UX specification. Live Shopify round trips, recovery history, observability, and rollout validation remain open here.

Этот документ дополняет, но не заменяет [`tasks/plan.md`](./plan.md). Старый план описывает EN/PT-платформу; здесь отдельно спроектирован ежедневный workflow проверки расхождений, понятного merge и безопасного точечного sync для обычного администратора.

## Цель

После входа в Synarava Admin человек сразу понимает:

1. идёт ли проверка Shopify;
2. когда данные проверялись в последний раз;
3. всё ли совпадает;
4. какие конкретно поля отличаются;
5. что находится в Synarava, что находится в Shopify и что было синхронизировано раньше;
6. что именно изменится и какие значения будут потеряны до подтверждения;
7. как синхронизировать одну локаль, одну сущность или выбранные поля, не затронув остальной каталог.

## Пользователь и режим интерфейса

- Пользователь — контент-менеджер или владелец магазина без технического опыта.
- Основной режим — **Operate**: быстро заметить проблему, понять её и безопасно устранить.
- В основном UI запрещены термины `digest`, `binding`, `payload`, `resource GID`, `PUSH/PULL` без расшифровки.
- Технические детали доступны в раскрываемом блоке «Technical details», но не мешают обычному workflow.
- Сигнал «всё синхронизировано» показывается только после успешной свежей проверки. Отсутствие данных не считается успехом.

## Исходные проблемы на дату создания плана (история)

1. При открытии админки Shopify не сверяется автоматически; интерфейс показывает только локальные статусы предыдущих операций.
2. `/admin/translations` выводит все сущности, включая `SYNCED`, из-за чего реальные проблемы теряются среди неактивных строк.
3. `CONFLICT` ведёт в обычный editor, но там нет трёхстороннего сравнения `last synced / Synarava / Shopify`.
4. Кнопка retry выполняет большой entity-specific sync и не даёт заранее увидеть область записи.
5. Product retry вызывает commerce-oriented `pushProductToShopify`, поэтому translation workflow потенциально шире, чем обещает UI.
6. Один `lastSyncedSnapshot` на binding фактически рассчитан на PT и недостаточен для независимых EN/PT snapshot.
7. `AdminIssue` смешивает content-quality проблемы, а sync health пока вообще не имеет отдельного понятного сигнала.
8. Сравнение значений недостаточно нормализовано: HTML, пустая строка против `null`, JSON key order и редакторские пробелы могут создавать ложные расхождения.

## Принятые архитектурные решения

### 1. Автопроверка начинается при открытии admin, но не блокирует страницу

- В persistent admin layout монтируется `AdminShopifySyncBootstrap`.
- Сразу после hydration он запускает authenticated `POST /admin/api/shopify/reconcile`.
- Пока запрос идёт, topbar показывает «Checking Shopify…», а не старое зелёное состояние.
- Проверка запускается один раз на новую `AdminSession`.
- Одновременные вкладки используют один DB lease/run и подписываются на общий результат вместо нескольких Shopify sweeps.
- Глобальное окно coalescing — 2 минуты: новая auto-проверка может использовать уже выполняющийся или только что завершённый run. Ручная кнопка всегда создаёт свежий run.
- Долгая сверка идёт через Route Handler, а не Server Action: Next.js 16 последовательно dispatch-ит Server Actions на клиенте, поэтому auto-scan не должен задерживать последующее сохранение формы.
- Layout читает только сохранённое состояние и не выполняет внешнюю mutation во время server render.

### 2. Sync health отделяется от Problems

`Problems` продолжает показывать broken media/taxonomy/content-quality. Рядом появляется отдельный Shopify signal:

- `Checking Shopify…` — нейтральный progress;
- `In sync · checked 2 min ago` — подтверждённый успех;
- `3 differences` — данные реально отличаются;
- `Check failed` — Shopify не удалось проверить;
- `Not checked recently` — состояние устарело;
- `Shopify not connected` — отсутствует configuration/scope.

Signal ведёт на `/admin/translations?view=changes`, а не в общий Problems list. На мобильном он остаётся видимым в drawer/header.

### 3. Сверка становится field-level и locale-aware

Для каждого Shopify target adapter предоставляет единый контракт:

```ts
type ShopifyReconcileAdapter = {
  entityType: "PRODUCT" | "COLLECTION" | "PAGE" | "STOREFRONT_COPY";
  target: "NATIVE" | "METAOBJECT";
  loadLocal(entityIds: string[], locale: "EN" | "PT"): Promise<LocalizedRecordMap>;
  loadRemote(bindings: Binding[], locale: "EN" | "PT"): Promise<RemoteRecordMap>;
  normalize(fieldKey: string, value: unknown): ComparableValue;
  writeLocal(scope: FieldSyncScope): Promise<void>;
  writeRemote(scope: FieldSyncScope): Promise<void>;
};
```

- `EN` сравнивается с Shopify source/translatable content.
- `PT` сравнивается с Shopify `translations(locale: "pt-PT")`.
- Metaobject source fields участвуют в EN; metaobject translations — в PT.
- Shared commerce fields не попадают в translation diff.
- Точечный EN sync Product copy использует отдельный narrow adapter и не изменяет price, inventory, media, taxonomy или membership.

### 4. Snapshot хранится отдельно по locale и target

Текущий `ShopifyTranslationBinding.lastSyncedSnapshot` мигрируется в нормализованную модель:

```prisma
model ShopifyTranslationSnapshot {
  id        String   @id @default(cuid())
  bindingId String
  locale    ContentLocale
  values    Json
  syncedAt  DateTime

  @@unique([bindingId, locale])
}
```

Существующий snapshot переносится как PT. Если base отсутствует и Synarava/Shopify различаются, система не угадывает победителя — показывает конфликт первого sync.

### 5. Текущие расхождения сохраняются как отдельное состояние

Предлагаемые модели:

```prisma
model ShopifyReconcileRun {
  id              String   @id @default(cuid())
  trigger         String   // AUTO | MANUAL | ENTITY | LOCALE
  status          String   // QUEUED | RUNNING | SUCCEEDED | PARTIAL | FAILED
  scope           Json?
  requestedBy     String?
  startedAt       DateTime?
  completedAt     DateTime?
  checkedCount    Int      @default(0)
  differenceCount Int      @default(0)
  error           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ShopifyFieldDivergence {
  id              String   @id @default(cuid())
  runId           String
  bindingId       String
  rootEntityType  String
  rootEntityId    String
  locale          ContentLocale
  fieldKey        String
  fieldLabel      String
  target          String   // NATIVE | METAOBJECT
  direction       String   // SYNARAVA_TO_SHOPIFY | SHOPIFY_TO_SYNARAVA | CONFLICT
  baseValue       Json?
  localValue      Json?
  remoteValue     Json?
  remoteUpdatedAt DateTime?
  remoteOutdated  Boolean  @default(false)
  localFingerprint String
  remoteFingerprint String
  resolvedAt      DateTime?

  @@unique([runId, bindingId, locale, fieldKey])
  @@index([rootEntityType, rootEntityId, locale, resolvedAt])
}
```

`TranslationSyncEvent` остаётся immutable audit history операций. `ShopifyFieldDivergence` — текущий read model для быстрого UI и topbar counts.

## Как определяется реальное расхождение

Перед сравнением значения проходят field-aware normalization:

- `null`, `undefined` и пустой пользовательский text → одно пустое значение;
- line endings и внешние пробелы нормализуются;
- HTML сравнивается в канонической форме без косметической разницы тегов/`&nbsp;`;
- JSON/rich content сортируется по ключам, но сохраняет порядок массивов;
- localized handle сравнивается после той же slug normalization, которую использует save action;
- Shopify `outdated: true` показывается отдельным предупреждением, но не создаёт дополнительную фальшивую строку;
- поля без Shopify target и shared-поля исключены до сравнения.

Для каждого поля вычисляется одно состояние:

| Состояние | Значение |
|---|---|
| `EQUAL` | Synarava и Shopify совпадают; в рабочем списке не показывается |
| `LOCAL_ONLY` | после base изменилось только Synarava; безопасная рекомендация — отправить в Shopify |
| `REMOTE_ONLY` | после base изменился только Shopify; безопасная рекомендация — получить в Synarava |
| `CONFLICT` | обе стороны изменились по-разному; требуется ручной выбор |
| `MISSING_REMOTE` | локально есть значение, Shopify пуст |
| `MISSING_LOCAL` | Shopify имеет значение, локально пусто |
| `UNAVAILABLE` | ресурс/locale/scope нельзя прочитать; это error state, не content diff |

В списке по умолчанию отображаются только `LOCAL_ONLY`, `REMOTE_ONLY`, `CONFLICT`, `MISSING_*`. Совпадающие поля не рисуются как disabled rows. Отдельный необязательный audit toggle может показать только счётчик `18 other fields match`, а не длинный список.

## UX: overview для обычного администратора

### Верх страницы

Вместо технической таблицы:

- крупный health statement: `Everything matches Shopify` / `5 differences need review`;
- `Last checked 2 minutes ago`;
- primary action `Check again` остаётся всегда;
- во время scan — progress по ресурсам и возможность продолжать работу в другом разделе;
- если check failed — причина на человеческом языке и `Try again`, без утверждения, что данные совпадают.

### Список расхождений

Группировка: **entity → locale → target**.

Карточка показывает:

- `Pearl Drop Earrings`;
- `Product · Portuguese`;
- `3 fields differ`;
- краткое резюме: `2 changed in Synarava · 1 changed in Shopify`;
- время последней успешной синхронизации;
- действия `Review differences`, `Check this item again`.

Нет общей кнопки `Retry`, пока пользователь не понимает направление и последствия.

Фильтры: `Needs review`, `Changed in Synarava`, `Changed in Shopify`, `Conflicts`, entity type, locale. Начальное состояние — `Needs review`.

## UX: merge workspace как Git merge, но без технического жаргона

Route: `/admin/translations/[entityType]/[entityId]?locale=PT`.

### Структура

1. Sticky header: entity, locale, freshness, `Check again`, selected-field count.
2. Summary strip: сколько полей изменится в Synarava и сколько в Shopify.
3. Только отличающиеся поля.
4. Desktop: две равноправные колонки `Synarava` и `Shopify`.
5. Mobile: stacked comparison с явными заголовками, без горизонтального scroll.
6. Опциональный раскрываемый `Last synchronized value` — третья base-версия для сложного конфликта.

### Карточка поля

- понятный label (`Product description`, не `body_html`);
- локальное и Shopify значение полностью или с безопасным collapse для длинного текста;
- word-level highlight добавленного/удалённого текста;
- rendered preview для rich text рядом с plain diff;
- badges `Changed here`, `Changed in Shopify`, `Changed on both sides`, `Empty in Shopify`;
- два radio-решения: `Keep Synarava version` / `Use Shopify version`;
- recommended choice только для одностороннего изменения; conflict не получает автоматической рекомендации;
- clear action показывает отдельный warning `This will remove the Portuguese title from Shopify`.

### Bulk controls

- `Use Synarava for all safe changes`;
- `Use Shopify for all safe changes`;
- conflicts остаются невыбранными;
- человек может снять любое поле;
- submit disabled, пока хотя бы один выбранный conflict не имеет решения.

### Preview потерь перед apply

Последний confirmation step показывает не абстрактное «Are you sure?», а конкретный impact:

> 3 fields will change. Shopify will lose its current Portuguese description. Synarava will replace its Portuguese SEO title. Price, inventory, media and English copy will not change.

В confirmation перечисляются:

- куда пишем;
- какие поля заменяются;
- старое значение → новое значение;
- что точно не затрагивается;
- можно ли восстановить предыдущую версию;
- warning для очистки непустого значения или overwriting a two-sided conflict.

Primary button называет действие: `Apply 3 selected changes`, а не `Sync`.

## Точечный sync

Единая структура scope:

```ts
type FieldSyncScope = {
  entityType: TranslationOverviewEntity;
  entityId: string;
  locale: "EN" | "PT";
  targetIds?: string[];
  fieldKeys: string[];
  decisions: Record<string, "KEEP_LOCAL" | "USE_SHOPIFY">;
  expectedRunId: string;
  expectedFingerprints: Record<string, { local: string; remote: string }>;
};
```

Поддерживаемые уровни:

1. один field;
2. выбранные fields;
3. одна locale-tab одной сущности;
4. одна сущность целиком с отдельными EN/PT review;
5. batch только из заранее просмотренных safe changes.

В Product/Collection/Page/Copy editors sticky locale header получает компактный control:

- `Not checked`;
- `Checking…`;
- `In sync`;
- `2 differences` → открывает merge workspace сразу для текущей locale;
- `Check this language`;
- `Review and sync` — только если есть расхождения.

Переключение EN/PT никогда само не запускает write. Media/relations/shared commerce не меняются при locale sync.

## Guards и гарантии

### До записи

- Каждая action/route повторно проверяет admin session и Zod-validates IDs, locale, field keys и decisions.
- Сервер заново загружает registry и разрешённые targets; client не передаёт значения для записи как источник истины.
- Перед confirmation UI показывает dry-run impact.
- Перед фактической записью сервер повторно читает local/remote fingerprints.
- Если после preview изменилась любая сторона, apply останавливается: `Values changed while you were reviewing. Check again.`
- Для Shopify translations перед write снова получается свежий digest.
- `remoteOutdated` требует fresh recheck.
- Непустое → пустое и любой `CONFLICT` требуют явного выбора, не bulk-default.

### Во время записи

- Пишутся только выбранные `fieldKeys` текущего locale/target.
- EN Product adapter обновляет только source copy fields, не запускает полный commerce push.
- Каждый target имеет отдельный event; частичный успех не маскируется общим зелёным статусом.
- Для локальных multi-field updates используется DB transaction.
- Shopify calls ограничиваются concurrency и поддерживают retry только для transient/digest ошибок.

### После записи

- Сразу выполняется read-after-write verification из Shopify.
- Snapshot обновляется только для подтверждённых полей.
- Divergence помечается resolved только если remote/local реально совпали.
- UI показывает список `Applied`, `Skipped`, `Failed` по полям.
- До/после сохраняется в audit event, включая actor, locale, direction и scope.
- Для последнего успешно применённого batch предлагается `Restore previous values`, только если fingerprints с момента apply не изменились. Это новая проверяемая операция, а не безусловный rollback.

## Failure и edge states

- Shopify credentials/scopes missing: отдельная setup-инструкция, sync disabled.
- PT locale unpublished: warning; review доступен, write заблокирован до исправления.
- Shopify rate limit: run остаётся resumable, UI показывает progress и retry time.
- Deleted/unbound Shopify resource: `Connection missing`, не content conflict.
- Local entity deleted during scan: divergence закрывается как stale.
- Partial target failure: успешные fields не повторяются; failed fields доступны для retry.
- Admin ушёл со страницы: run продолжается, topbar получает результат при следующем poll/navigation.
- Две вкладки применяют решения одновременно: fingerprint guard пропускает только первую актуальную операцию.
- Network lost after submit: UI предлагает `Verify result`; повторный apply идемпотентен по resolution batch id.

## Доступность и визуальные требования

- Не полагаться только на цвет: icon + label + count у каждого status.
- Diff additions/removals имеют текстовые маркеры и AA contrast в light/dark theme.
- Radio decisions и field selection доступны с клавиатуры.
- После apply focus переходит в result summary; errors анонсируются через `aria-live`.
- Sticky merge header не перекрывает locale tabs/topbar.
- Touch targets не меньше 44px.
- Long text не превращает страницу в бесконечное полотно: collapsed preview сохраняет возможность `Show full text`.
- Анимации 120–220ms; reduced motion отключает декоративные transitions.
- Никакой «command center» эстетики: спокойный studio-console, ясные глаголы, минимум кодов.

## Этапы реализации

### Phase 1 — Reconcile foundation

#### Task 1: Ввести locale-aware snapshots и reconcile runs

**Acceptance criteria:**
- Prisma models/migration для snapshots, runs и field divergences.
- Legacy binding snapshot переносится как PT без потери данных.
- Один active DB lease предотвращает duplicate auto scans.

**Verification:** migration validation, repository tests, idempotent migration test.

**Likely files:** `prisma/schema.prisma`, новая migration, `lib/shopify/reconcile-runs.ts`.

#### Task 2: Сделать нормализованный field-level diff engine

**Acceptance criteria:**
- Возвращает только реальные differences и классификацию на каждый field.
- HTML/null/JSON/whitespace normalization исключает false positives.
- EN/PT и native/metaobject обрабатываются одинаковым typed contract.

**Verification:** table-driven unit tests для equal/local-only/remote-only/conflict/missing/outdated.

**Likely files:** `lib/shopify/translation-reconciliation.ts`, `lib/i18n/sync-normalization.ts`, tests.

#### Task 3: Добавить adapters Product/Collection/Page/Copy

**Acceptance criteria:**
- Batch local loaders без N+1.
- Remote reads включают Shopify source values, PT translations, updatedAt/outdated.
- Product EN adapter не использует полный commerce push.

**Verification:** adapter contract tests с mocked Shopify GraphQL.

### Checkpoint A

- [ ] Migration и unit tests зелёные.
- [ ] Dry-run на fixtures не показывает equal fields.
- [ ] Ни один write path ещё не включён.

### Phase 2 — Automatic and manual checking

#### Task 4: Реализовать reconcile service и authenticated API

**Acceptance criteria:**
- Auto/manual/entity/locale scopes.
- Durable progress, coalescing, partial failure, retry.
- Read-only scan не меняет content или Shopify.

**Verification:** route/service integration tests, concurrent-run test, auth test.

#### Task 5: Запускать check при открытии admin

**Acceptance criteria:**
- Один auto-run на admin session, immediate visible `Checking`.
- Scan не блокирует navigation/forms.
- Manual `Check again` всегда доступен и bypass-ит freshness cache.

**Verification:** component tests + Playwright login/open/admin scan flow.

#### Task 6: Разделить Problems и Shopify health signal

**Acceptance criteria:**
- Topbar/mobile показывают sync freshness/count/error отдельно от AdminIssue.
- Stale/failed/unconfigured никогда не выглядят как `In sync`.
- Link открывает отфильтрованный reconciliation overview.

**Verification:** state-matrix component tests и accessibility checks.

### Checkpoint B

- [ ] Открытие admin автоматически создаёт один read-only run.
- [ ] Manual check работает повторно.
- [ ] Topbar корректен для zero/differences/failed/stale.

### Phase 3 — Human-friendly review

#### Task 7: Переделать Localization overview

**Acceptance criteria:**
- По умолчанию только actionable differences, grouped entity/locale.
- Equal fields не выводятся disabled rows.
- Plain-language summary и filters.

**Verification:** component tests на grouping/filter/empty/loading/failure.

#### Task 8: Построить merge workspace

**Acceptance criteria:**
- Side-by-side/stacked local vs Shopify, optional base, word diff, rich preview.
- Field-by-field decisions и safe bulk helpers.
- Conflict нельзя применить без выбора.

**Verification:** keyboard tests, long/empty/rich content tests, desktop/mobile Playwright screenshots.

#### Task 9: Добавить impact preview

**Acceptance criteria:**
- До apply видны все overwrites/clears и незатрагиваемые области.
- Confirm button содержит точное число changes.
- Stale fingerprints возвращают review, ничего не записывая.

**Verification:** component + server validation tests.

### Checkpoint C

- [ ] Нет blind sync/retry actions.
- [ ] Обычный пользователь может объяснить результат до нажатия Apply.
- [ ] Mobile/keyboard flow полностью проходим.

### Phase 4 — Scoped writes and recovery

#### Task 10: Реализовать field-scoped apply

**Acceptance criteria:**
- Writes только выбранным entity/locale/target/fields.
- Fresh digest/fingerprint checks.
- Per-target audit и read-after-write verification.

**Verification:** Product/Collection/Page/Metaobject write contract tests.

#### Task 11: Добавить locale controls в editors

**Acceptance criteria:**
- Текущая tab показывает собственный sync state.
- `Check this language` и `Review and sync` scoped к entity + active locale.
- Shared/media/commerce fields гарантированно не затрагиваются.

**Verification:** existing editor regressions + scoped payload tests.

#### Task 12: Partial retry и safe restore

**Acceptance criteria:**
- Retry только failed fields.
- Restore previous values доступен только при unchanged fingerprints.
- Результат по каждому field явно показан.

**Verification:** partial failure, network ambiguity, idempotency и restore tests.

### Checkpoint D — Release gate

- [ ] Full unit/integration suite.
- [ ] Production build.
- [ ] Playwright automatic check → merge → partial sync → verify.
- [ ] Controlled live Shopify round trip: Product EN, Product PT, Collection PT, Page PT, metaobject PT.
- [ ] Shadow mode report reviewed against production data.
- [ ] Human UX review с человеком, не знакомым с внутренней sync architecture.

## Rollout

1. Deploy schema + read-only reconcile in shadow mode.
2. Compare current false-positive rate; fix normalization until only real changes remain.
3. Enable topbar signal and manual check.
4. Enable merge UI with apply disabled.
5. Controlled writes по одному test resource каждого типа.
6. Enable scoped PT writes.
7. Enable scoped EN source-copy writes.
8. Enable safe restore после отдельного live test.

Feature flags должны разделять `scan`, `review UI`, `PT writes`, `EN writes`, `restore`, чтобы rollback не требовал удаления snapshots/divergences.

## Метрики качества

- False-positive divergence rate на ручной выборке: 0.
- Auto scan запускается ≤ 1 раза на admin session, duplicate Shopify sweeps = 0.
- 100% apply operations имеют before/after, actor, locale, fields и verification result.
- 0 translation-only операций меняют commerce/shared fields.
- Time-to-understand первой conflict card обычным пользователем: цель < 30 секунд.
- После apply пользователь всегда получает verified outcome или явный uncertain/error state.

## Риски и mitigation

| Риск | Мера |
|---|---|
| Auto scan медленный/дорогой | batch GraphQL, pagination, DB lease, session + 2-minute coalescing, progress |
| Ложные различия | field-aware normalization и shadow-mode sampling до UI launch |
| Потеря remote edits | three-way base, fingerprint recheck, explicit conflict choice, audit/restore |
| Потеря local edits | local transaction, before snapshot, no implicit pull |
| Частичный Shopify write | per-target events, read-after-write, field-level retry |
| Product sync затрагивает commerce | отдельный narrow translation/source-copy adapter |
| UI снова становится техническим | plain-language copy, technical details collapsed, user testing |
| Две вкладки конфликтуют | DB lease для scan, optimistic fingerprints для apply |
| Shopify rate limits | bounded concurrency, resumable run, retry-after state |

## Решения, предлагаемые к подтверждению

1. Auto check: один раз на новую 8-часовую admin session; global coalescing 2 минуты.
2. Никаких auto-writes: при открытии выполняется только read-only check.
3. Equal fields полностью скрыты; показывается только общий count совпавших полей.
4. Любой conflict и непустое → пустое требуют индивидуального выбора.
5. Restore хранит предыдущие значения в audit history и разрешён только при неизменившемся remote/local fingerprint.
6. Shopify sync signal визуально отделён от существующего Problems signal.

## Официальные источники

- Shopify translated content workflow: https://shopify.dev/docs/apps/build/markets/manage-translated-content
- `TranslatableResource`, source content, translations и `outdated`: https://shopify.dev/docs/api/admin-graphql/latest/objects/TranslatableResource
- Shopify resource types: https://shopify.dev/docs/api/admin-graphql/latest/enums/TranslatableResourceType
- Fresh digest перед `translationsRegister`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister
- Явное удаление переводов через `translationsRemove`: https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRemove
- Next.js 16 Server Actions dispatch/security: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` и https://nextjs.org/docs/app/guides/server-actions

Shopify официально документирует locale webhooks, но не надёжный webhook на каждое изменение translated content. Поэтому auto check при входе + manual check + freshness indicator здесь являются осознанной polling/reconcile стратегией, а не предположением о недокументированном event source.
