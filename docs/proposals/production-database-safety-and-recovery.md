# Защита production-базы и проверяемое восстановление

**Статус:** план после инцидента 19 октября 2026; шаг 1 выполнен владельцем, ежедневное расписание из шага 2 сохранено; PITR ещё не включён. Вести по одному шагу вместе с владельцем магазина. Любое действие в Railway, production, S3 и настройках доступа выполняет владелец. Помощник готовит инструкции и локальные изменения в репозитории, но не открывает и не меняет внешние сервисы без новой явной договорённости.

## Контекст и подтверждённые факты

- По отчёту Cursor, команда Prisma получила production PostgreSQL в качестве `--shadow-database-url` и сбросила его около 12:24 UTC 19 октября 2026. Точная команда и журнал её выполнения здесь независимо не сверены.
- На момент проверки 19 октября: у production Postgres в Railway PITR выключен, список резервных копий и расписаний пуст. Текущая роль подключения — `postgres` с `rolsuper=true` и `rolcreatedb=true`.
- Каталог частично восстановлен из Shopify, однако CMS-страницы, переводы, настройки и связи с медиа восстановлены не полностью. Нельзя заменять текущую базу старой копией без сравнения данных, появившихся после инцидента.
- В проекте доступны `prisma migrate dev` и `prisma db push`; CI проверяет `db push` на тестовой БД, но не воспроизводит последовательность SQL-миграций. Текущий Cursor shell hook не запрещает опасные команды Prisma.
- PITR, включённый после инцидента, не восстановит состояние до него. Не обещать это как способ вернуть данные за 19 октября.
- Владелец показал экран Railway `production/Postgres → Backups`: встроенные функции были заблокированы тарифом, затем стали доступны. По скриншоту 19 октября в 16:54 (время интерфейса владельца) появилась ручная копия размером 227 МБ. Проверка восстановления ещё не проводилась.
- Владелец показал список runtime secrets Cursor cloud environment: `DATABASE_PUBLIC_URL` имеет область `Environment`. Также видны S3 access key и secret key (`Personal`) и Shopify client secret (`Environment`). Значения не раскрывались. Удаление `DATABASE_PUBLIC_URL` из Cursor ещё не подтверждено; не путать с переменными работающего приложения в Railway.

## Правила совместной работы

1. Выполнять один шаг за раз. Владелец сообщает результат или присылает скриншот **без секретов**; помощник сверяет критерий готовности и только затем предлагает следующий шаг.
2. Не присылать URL БД, пароли, токены, значения переменных окружения, дампы с персональными данными. Достаточно статуса, времени и названий включённых опций.
3. Не запускать `migrate dev`, `migrate reset`, `db push`, `migrate diff --shadow-database-url` или `pg_restore` на production. Не выполнять восстановление поверх живой базы.
4. После каждого изменения инфраструктуры записывать в этот документ дату, результат и где хранится доказательство проверки; секреты и полные дампы в Git не добавлять.

## Шаги

### 0. Немедленно закрыть прежний путь к prod из Cursor

**Владелец:** именно в настройках секретов Cursor cloud environment удалить `DATABASE_PUBLIC_URL`. Не удалять переменные сервиса `Postgres` или приложения в Railway и не открывать значение секрета. Подтвердить, что имени больше нет в списке Cursor. Старые запущенные воркеры могут сохранять окружение до завершения; остановить их перед возобновлением работ с БД.

**Готово, когда:** у новых Cursor-воркеров нет `DATABASE_PUBLIC_URL`, а работающий магазин доступен. Это снижает риск, но не заменяет отдельные роли БД и ограничение Railway-доступа. После этого отдельно проверить, нужны ли агентам S3 и Shopify credentials: по умолчанию не выдавать production-секреты задачам разработки.

### 1. Зафиксировать нынешнее состояние

**Владелец:** экран Railway требует Pro для встроенных backups. Если владелец выбирает Pro, сначала обновить тариф через Billing/Plan в Railway, затем вернуться в `production → Postgres → Backups` и сделать ручную резервную копию текущего тома. Если Pro не подходит, выполнить альтернативный логический `pg_dump` в независимое защищённое хранилище по отдельной инструкции; не копировать дамп в чат или Git. Это копия уже частично восстановленной базы, не копия до инцидента.

**Готово, когда:** в списке появился backup с временем создания; время записано ниже. Ничего не восстанавливать из него сейчас.

### 2. Настроить копии тома и PITR

**Владелец:** встроенные backups и PITR на текущем тарифе недоступны. После перехода на Pro включить ежедневные и недельные backups для `production/Postgres`; проверить сроки хранения в UI. Затем включить PITR и дождаться завершения первой базовой копии и появления диапазона доступного восстановления. Включение PITR может менять конфигурацию и перезапускать сервис — делать это отдельным шагом после проверки текущего состояния магазина. Если Pro не выбран, согласовать другой способ непрерывного восстановления: ежедневный дамп из шага 3 защищает только до момента последнего успешного экспорта.

**Готово, когда:** видны расписания, PITR enabled, archiver healthy и конкретное начало диапазона восстановления. Записать эти четыре факта без секретов.

### 3. Сделать независимую копию данных и медиа

**Помощник локально:** подготовить версионированный скрипт/описание регулярного `pg_dump` с проверкой завершения, шифрованием и загрузкой в отдельное хранилище с ограниченным доступом и политикой хранения; добавить отдельный экспорт S3-медиа. Не использовать Git как хранилище дампов.

**Владелец:** выбрать независимое хранилище, настроить доступ и расписание через его UI. Railway Buckets не поддерживают object versioning; удалённые объекты нужно защищать внешней копией.

**Готово, когда:** есть свежий дамп и копия медиа вне production-проекта, а их чтение проверено.

### 4. Убрать суперпользователя из обычной работы

**Помощник локально:** составить матрицу ролей и проверить требуемые права приложения, мигратора и backup-процесса на отдельной тестовой БД. Подготовить порядок смены подключений и откат.

**Владелец:** в Railway/Postgres создать разные учётные записи: обычное приложение без DDL и `DROP`, мигратор с нужными DDL-правами, backup-процесс с правами чтения. Production-секреты не давать Cursor/агентам и не подмешивать в staging/cloud-воркеры. Не менять роль приложения, пока миграции зависят от его подключения в pre-deploy.

**Готово, когда:** приложение и миграции работают на staging с разделёнными ролями; в production права runtime-роли проверены чтением системного каталога, без пробного удаления таблиц.

### 5. Закрыть опасный путь миграций в репозитории и CI

**Помощник локально:** заменить свободные команды разработки безопасными обёртками; проверять, что shadow URL принадлежит выделенной одноразовой БД, и жёстко отклонять совпадение с любым основным подключением. Для генерации SQL использовать только локальную/одноразовую БД без production-секретов. В CI применять историю миграций на чистой тестовой БД, проверять опасный SQL и тестировать отказ guard при prod-подобном URL. Обновить инструкции для агентов и деплоя.

**Готово, когда:** CI блокирует опасные варианты, история миграций проходит на чистой БД, а Stage 2 можно подготовить без подключения к живой базе.

### 6. Провести тренировку восстановления

**Владелец:** выбрать время без продаж; запускать восстановление только в **новую** базу/сервис по инструкции Railway, не в текущую production-базу.

**Помощник локально:** подготовить контрольный список для проверки восстановленной копии: миграционная история, количества и выборочные записи товаров, коллекций, страниц, переводов, настроек, CMS-медиа, ссылок на S3. Сравнить данные до и после выбранного времени, затем составить план выборочного переноса или переключения без потери новых заказов.

**Готово, когда:** измерены фактические RPO/RTO, восстановленная копия прошла контроль, а процедура записана в `docs/runbooks/`.

## При следующем инциденте

1. Остановить только источник повреждающих записей, сохранить журналы, точное UTC-время и текущее состояние. Не запускать миграции и массовые pull/push.
2. Создать PITR-копию на момент **до** ошибки как отдельный сервис. Сохранить нынешнюю базу для сравнения; не переключать магазин автоматически.
3. Проверить копию, сравнить заказы и изменения после момента ошибки, решить выборочный перенос или переключение.
4. После проверки выполнить переключение с коротким контролируемым окном и smoke-тестом магазина; сохранить план отката.

## Журнал выполнения

| Шаг | Статус | Дата/время и результат |
| --- | --- | --- |
| 0. Убрать prod URL из Cursor | Done | 2026-10-19: owner removed `DATABASE_PUBLIC_URL` from Cursor secrets. Shopify write credentials replaced by the read-only app (row 4b). S3 access key and secret removed from Cursor (row 4c). |
| 1. Ручная копия текущего тома | Создана; восстановление не проверено | Railway UI: 19 октября 2026, 16:54, 227 МБ |
| 2. Расписание и PITR | В работе: Daily сохранён; PITR выключен | Владелец подтвердил ежедневное расписание. До сравнения расходов дополнительные расписания и PITR не включать. |
| 3. Независимая копия БД и медиа | Не начат | — |
| 4. Разделение ролей | Не начат | — |
| 4a. Read-only role for the Cursor agent | Done | 2026-10-19: role `agent_ro` created (NOSUPERUSER, NOCREATEDB, statement_timeout 15s, default_transaction_read_only on). SELECT on all public tables except AdminSession, ShopifyCustomerSession and RateLimitBucket; no CREATE on schema public. Verified via catalog (`has_table_privilege`): read Product true, delete false, create false. Agent verified through `PROD_RO_DATABASE_URL` (public proxy): Product count 52, AdminSession permission denied. Caveat: new tables get SELECT by default, so revoke sensitive ones after each migration. The app still connects as superuser; the app/migrator split from step 4 is open. |
| 4b. Read-only Shopify app for the Cursor agent | Done | 2026-10-19: Dev Dashboard app `Synarava Agent RO` (version `initial-read-only`) with 7 read scopes only: read_products, read_inventory, read_locales, read_translations, read_publications, read_metaobjects, read_metaobject_definitions. Installed on the production store. Its client id/secret replaced the write-capable Synarava Sync credentials in Cursor secrets (store domain unchanged). Verified by the agent on a fresh worker: accessScopes has no write_*, product read works, `productUpdate` denied. Note: `$app:` metaobjects of Synarava Sync are not visible to this app (separate `$app:` namespace), so the editorial copy question stays open. |
| 4c. S3 keys removed from Cursor | Done | 2026-10-19: Railway Bucket credentials have no permission choice (a single key pair), so `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` were removed from Cursor secrets. `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` remain (not secret). Agent reads media through public URLs; any upload testing needs a separate test bucket. The removed key lived in the agent environment, so rotating it in Railway is an open optional step. |
| 5. Ограничения миграций и CI | In progress | 2026-10-19: `scripts/db-guard.mjs` added; `prisma:migrate` (migrate dev) and `prisma:push` (db push) now run only when every database URL (DATABASE_URL, DIRECT_URL, SHADOW_DATABASE_URL, --shadow-database-url) is localhost, otherwise they fail closed without printing credentials. `prisma:deploy` is unchanged (Railway pre-deploy). 4 unit tests pass; refusal verified with synthetic remote URLs. Shell hook `.codex/hooks/block-dangerous-prisma.mjs` blocks raw `prisma migrate dev/reset`, `db push/execute` and any `--shadow-database-url` in Bash commands; registered for Claude Code (`.claude/settings.json`) and Codex (`.codex/hooks.json`), 19 unit tests pass (git/gh commands are exempt). Cursor adapter `.cursor/hooks/before-shell-execution-block-dangerous-prisma.js` registered first in `beforeShellExecution` (exit code 2 blocks); 20 hook tests pass. Not committed yet. Checked 2026-10-19 on a Cursor cloud worker that had the hook files (checkout at merge 2c9701af): the adapter returns exit code 2 with BLOCKED when run by hand, yet a blocked command typed in the agent shell still ran, so Cursor cloud agents do not invoke project hooks; there the protection is the read-only database and Shopify credentials and the absence of write credentials. Open: the existing Cursor `block-no-verify` wrapper requires a path that does not exist at the repo root, CI check that applies the migration history to a clean database. |
| 6. Тренировка восстановления | Не начат | — |
| 7. Migration history baseline | Done (production) | 2026-10-20: production had the schema but no `_prisma_migrations`, so Railway deploys could not apply migrations (P3005). Read-only checks first: all 45 migrations replay from scratch, and the diff against production showed only known leftovers (7 legacy enums, 2 column defaults); the three tables hidden from `agent_ro` showed as false drift. Procedure rehearsed on a throwaway local database, then run by the owner in a terminal with a hidden prompt: 45 migrations marked applied, then `migrate deploy` applied only `20261019143000_mission_control_status`. Result: 46 history rows, `ServiceNodeStatus` and `ServiceFlowStatus` exist. Procedure: [database-incident-recovery](../runbooks/database-incident-recovery.md). |
| 8. Collector role `mc_collector` | Done | 2026-10-20: Postgres role with INSERT/UPDATE on the two status tables and SELECT on those plus `ShopifyWebhookDelivery` and `ProductSyncEvent` only; verified through `has_table_privilege` (status write true, `Product` read false, `AdminSession` read false). Its URL lives only in the variables of the Railway service `mission-control-collector`. First cron run wrote `site-health`, `shopify-sync`, `orders` and 4 flows. |
| 9. Railway pre-deploy | Done (production), open (staging) | 2026-10-20: production `synarava-shop-app` Pre-deploy command set to `pnpm prisma:deploy`. Before that no pre-deploy step existed in the service; the repo's `deploy/railway.synarava-web.json` is not applied automatically. The staging database needs its own baseline before the same setting is safe there. |
| 10. Open items | Open | Staging baseline and pre-deploy; Dependabot still red (needs a Dependabot secret for GitHub Packages or an alternative); replace the Sentry organization token that was printed in a chat (new `org:ci` token created: update Railway and GitHub secrets, then revoke the old one); test a real restore from backup into a new service (step 6). |

### Точка отсчёта расходов перед сравнением

Скриншот владельца после сохранения Daily, 19 октября 2026: Railway Workspace Usage показывает `Current Usage $18.16`, `Estimated Bill $36.17`, `synarava-shop Current Cost $9.17`. Это показатели **всего текущего расчётного периода**; разница через два дня не будет равна только цене backups, поскольку приложение продолжает работать. Через пару дней открыть тот же Workspace → Usage, развернуть `synarava-shop` и проверить отдельную строку Backup, если она доступна. Сравнивать в пределах одного billing period; уточнить дату снимка и не путать накопленные и прогнозные расходы.

## Источники

- [Prisma: shadow database](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/shadow-database)
- [Railway: Back Up and Restore Postgres](https://docs.railway.com/guides/postgres-backups-restores)
- [Railway: Point-in-Time Recovery](https://docs.railway.com/volumes/point-in-time-recovery)
- [Railway: Storage Buckets](https://docs.railway.com/storage-buckets)
