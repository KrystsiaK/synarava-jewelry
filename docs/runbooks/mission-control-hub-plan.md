# Mission Control — план постройки и контракт простоты

**Status:** proposed — Stage 1 done (packages + probe widget); later stages not started
**Last updated:** 2026-10-18 (Europe/Lisbon)

**Решение:** [ADR-0005](../adr/0005-mission-control-hub.md)
**Связанные:** [ADR-0004 (SKU-сервис)](../adr/0004-portable-sku-service-boundary.md), [runbook SKU](portable-sku-current-status.md)

Это единая точка входа для любого агента, который берётся за Mission Control.
Прочитать **целиком и до начала кода**. Обновлять после каждого подтверждённого
этапа. Не превращать «запланировано» в «сделано» без доказательства (тест,
скриншот, запись в БД).

---

## 0. Контракт простоты (ОБЯЗАТЕЛЬНО, читать первым)

Главная цель владельца: **снаружи наглядно и просто, внутри прозрачно и
расширяемо. Усложнение — главный провал проекта, а не фича.** Ponytail активен:
код, который не написан, — лучший код.

**Правило лестницы (останавливайся на первой ступени, которая держит):**
1. Это вообще нужно сейчас? Спекулятивное — пропусти, напиши одну строку почему.
2. Уже есть в коде/пакетах `@synarava/*`? Переиспользуй.
3. Решает стандартная/уже установленная зависимость? Используй её.
4. Можно одной строкой/одним конфигом? Сделай так.
5. Только потом — минимальный новый код.

**ЗАПРЕЩЕНО без явного «да» владельца в этом документе:**
- Строить свой виджетный/плагинный/DI-фреймворк. Движок = `@synarava/wiring-engine`.
- Любая кнопка действия в хабе («перезапустить», «починить», «удалить»). Хаб —
  **только чтение + ссылки наружу**.
- Новая зависимость сверх бюджета ниже.
- Новая таблица сверх бюджета ниже.
- Абстракция с одной реализацией (интерфейс, фабрика, «на будущее»).
- Хранить конфиг графа в БД или редактировать его из админки (в v1 — read-only).
- Генерация «умных» промптов на лету, ИИ-авторазводка связей (отложено в ADR).
- Втягивать в v1 финансы, CRM, Meta/TikTok (см. §«Явно вне v1»).

**Бюджет сложности v1 (превышение = СТОП и вопрос владельцу):**
- Новых runtime-зависимостей: **1** (`@xyflow/react`). Пакеты `@synarava/*` и их
  peer-deps не считаются «новыми» — это переиспользование.
- Новых таблиц Prisma: **2** (`ServiceNodeStatus`, `ServiceFlowStatus`).
- Новых сервисов/процессов: **1** (крон-воркер коллектора на Railway).
- Файл конфига графа: **1** JSON.

**Если возникает соблазн добавить слой/абстракцию/зависимость:** остановись,
допиши в этот файл строку «хотел добавить X ради Y», и спроси владельца. Не
добавляй молча.

**Каждый PR этапа обязан пройти `/ponytail-review`** (или объяснить в описании,
почему диф минимален). Нетривиальная логика оставляет один запускаемый тест.

**Database rules for agents (read before touching Prisma or any database):**
- Never run `prisma migrate dev`, `migrate reset`, `db push`, `db execute` or any
  `--shadow-database-url` against anything except a local throwaway database.
  Prisma wipes a shadow database; pointing it at a real one destroyed production
  on 2026-10-19.
- Agents hold read-only credentials only (`PROD_RO_DATABASE_URL`). Never ask for,
  create or use a write-capable URL, and never copy a URL from one variable into
  another to make a command work.
- To create a migration, do not connect to any database. Diff two schema files:
  `git show HEAD:prisma/schema.prisma > /tmp/old.prisma`, then
  `pnpm exec prisma migrate diff --from-schema-datamodel /tmp/old.prisma --to-schema-datamodel prisma/schema.prisma --script`,
  and save the SQL as a new folder in `prisma/migrations/`.
- Never apply a migration by hand. Migrations reach staging and production only
  through the normal pipeline (PR, CI, merge, Railway pre-deploy `migrate deploy`),
  staging first.
- If a command needs a database you do not have, stop and ask the owner.

---

## 1. Карта: что переиспользуем, что строим

| Понятие хаба | Источник |
|---|---|
| Узел-сервис | `defineWidget` / `WidgetDefinition` (`@synarava/wiring-engine`) |
| Порт статуса узла | `PortDefinition { portKey: "status_out", direction: "output", valueType: "json" }` |
| Связь/поток | `SystemBinding` / `UserConnection` |
| «Электричество» | сигнал на `SignalBus` → анимация ребра |
| Конфиг графа (правда) | `WiringConfig`-JSON в репозитории |
| Chrome виджета, раскладка | `@synarava/shell-kit` |
| ИИ-виджеты (на будущее) | `@synarava/widget-generator` |
| **Новое:** видимая канва | React Flow (`@xyflow/react`) |
| **Новое:** состояние | 2 таблицы Prisma + крон-воркер |

---

## 2. Этапы (строго по порядку; каждый — отдельный PR)

Каждый этап имеет **Цель / Готово = / Запрещено / Переиспользуем**. Не переходи
к следующему, пока «Готово» не доказано.

### Этап 1 — Подключить пакеты `@synarava/*`
- **Цель:** `synarava-jewelry` умеет импортировать `wiring-engine` и `shell-kit`.
- **Готово =** в приложении рендерится один тестовый `defineWidget`-виджет в
  shell'е, сборка и типы зелёные.
- **Переиспользуем:** GitHub Packages реестр `@synarava` (как уже сделано для
  `@synarava/sku-contract`), pnpm-workspace. Peer-deps: `framer-motion`,
  `lucide-react`, `clsx`, `tailwind-merge`, `zustand`.
- **Запрещено:** форкать пакеты, копировать их код в репо, «немного подправить
  под себя». Нужна правка — PR в сам пакет.
- **Риск-заметка:** версии 0.x — зафиксировать точные (`wiring-engine@0.2.0`,
  `shell-kit@0.1.3`).

### Этап 2 — Схема состояния + контракт статуса
- **Цель:** есть куда писать и откуда читать состояние.
- **Готово =** SQL migration for the two tables generated without any database
  connection (see "Database rules for agents" in §0), committed in a PR, and
  applied to staging only by the normal pre-deploy after merge; TypeScript type
  for the node status; one unit test for read/write.
- **Данные (черновик полей, уточнить при реализации):**
  - `ServiceNodeStatus`: `nodeKey` (string, = `WidgetDefinition.key`), `level`
    (`ok|warn|down|unknown`), `message` (string?), `counters` (json?),
    `href` (string?), `checkedAt` (datetime), `updatedAt` (datetime).
  - `ServiceFlowStatus`: `busKey` (string, = `SystemBinding.busKey`),
    `lastFlowAt` (datetime?), `level` (`ok|warn|down|unknown`), `updatedAt`.
  - Формат дат — ISO-8601 UTC, как в остальном проекте.
- **Запрещено:** третья таблица, журнал-история, «аудит на будущее». Нужно —
  спроси.

### Этап 3 — Канва-граф (patch bay)
- **Цель:** видно вселенную узлами и проводами; цвет узла = `level` из БД.
- **Готово =** страница в админке рендерит граф из `WiringConfig` + статусов;
  узлы цветные; рёбра со свежим `lastFlowAt` анимированы («электричество»);
  на мобиле graceful degrade в сворачиваемый список.
- **Переиспользуем:** `WidgetPortManifest.color`, `ui.icon`; `@xyflow/react` для
  раскладки/зума/анимированных рёбер.
- **Запрещено:** drag-to-edit графа, сохранение раскладки в БД, кастомный
  SVG-движок вместо React Flow. Всё это — чтение из конфига.

### Этап 4 — Первые 3–4 живых узла
- **Цель:** реальная польза на самых лёгких (данные уже у нас).
- **Узлы v1:** `site-health` (ping `/health`), `shopify-sync` (timestamp
  последней синхронизации из нашей БД), `orders` (счётчики из нашей Postgres),
  `sentry` (API/вебхук — владелец сейчас подключает).
- **Готово =** каждый узел — это `defineWidget` c `status_out` + строка в
  `WiringConfig`; статусы реально меняют цвет; видно связи `site→db`,
  `shopify→products`, `sentry←site`.
- **Запрещено:** тянуть в v1 узлы без готового API (Clarity, Meta, TikTok) —
  рисуем их серыми заглушками «подключим позже», без кода.

### Этап 5 — Коллектор + супербот (крон-воркер на Railway)
- **Цель:** состояние обновляется само, проблемы прилетают в Telegram.
- **Готово =** воркер по крону обходит узлы, пишет в таблицы, при `warn/down`
  шлёт в Telegram сообщение **со ссылкой на узел хаба** + статичную инструкцию;
  сверяет конфиг против наблюдаемого и помечает дрейф.
- **Переиспользуем:** существующий Telegram-канал/бот, Railway cron.
- **Запрещено:** давать воркеру права что-либо чинить/перезапускать. Он только
  наблюдает и уведомляет.

### Этап 6 — «Как чинить» в конфиге
- **Цель:** у каждого типа проблемы — текст-инструкция и готовый промпт.
- **Готово =** в `WiringConfig` рядом с узлом лежат статичные `fixHint` и
  `fixPrompt`; хаб и Telegram их показывают.
- **Запрещено:** генерировать промпт динамически (отложено в ADR).

---

## 3. Явно вне v1 (не сужаем видение — откладываем стройку)

Эти узлы встанут на ту же карту тем же контрактом, когда дойдём. Не делать в v1:

- **Финансовый трекер фактур** (авансовая→финальная, таблица + PDF в S3, ручной
  ввод; портал = юр.источник). Самостоятельная фича; хабу отдаст узел «Финансы».
- **CRM-узел** (клиенты/сделки).
- **Реклама** (Meta/TikTok), **Google Analytics/Workspace** как живые узлы.
- **Редактор конфига в админке**, drag-to-edit графа, ИИ-авторазводка связей,
  ИИ-генерация виджетов через `widget-generator`.

Добавление любого из них = новый `defineWidget` + строка конфига, **без правок
движка и хаба**. Это и есть проверка, что архитектура осталась простой.

---

## 4. Definition of Done всего v1

- Хаб открывается в админке, показывает всю карту; 3–4 узла живые, остальные —
  честные заглушки.
- Состояние ведёт крон-воркер; алерты в Telegram ведут обратно в хаб.
- Конфиг — один JSON в репо, в админке read-only.
- Бюджет сложности §0 не превышен; каждый PR прошёл ponytail-review.
- ADR-0005 переведён в `accepted`.
