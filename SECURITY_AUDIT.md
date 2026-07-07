# Security Audit — Synarava Jewelry

**Дата аудита:** 2026-07-07
**Дата исправлений:** 2026-07-07
**Область аудита:** регистрация / аутентификация, оплата (Stripe / checkout), пользовательский аккаунт (профиль), админ-панель.
**Метод:** ручной обзор кода (server actions, API routes, `lib/auth`, `lib/commerce`, `lib/media`).

Стек: Next.js 16 (App Router, Server Actions), Prisma, Stripe (Elements), собственная сессионная аутентификация на cookie (не NextAuth, несмотря на зависимость).

> **Все исправимые уязвимости закрыты** в рамках этого же коммита. Статус по каждому пункту указан ниже.

---

## Сводка по критичности

| # | Уязвимость | Область | Критичность | Статус |
|---|-----------|---------|-------------|--------|
| 1 | Токен сброса пароля возвращается запросившему → захват любого аккаунта | Auth | 🔴 Critical | ✅ Исправлено |
| 2 | Заказ помечается оплаченным без проверки платежа в Stripe | Оплата | 🔴 Critical | ✅ Исправлено |
| 3 | Первый зарегистрированный пользователь автоматически получает роль admin | Auth | 🟠 High | ✅ Исправлено |
| 4 | Нет rate-limiting на login / register / сброс пароля | Auth | 🟠 High | ✅ Исправлено |
| 5 | Enumeration пользователей (reset и register) | Auth | 🟡 Medium | ✅ Исправлено |
| 6 | Захардкоженный дефолтный секрет сессии + слабое подписание токена | Auth | 🟡 Medium | ✅ Исправлено |
| 7 | Загрузка SVG хранится «как есть» → возможный stored XSS | Админка | 🟡 Medium | ✅ Исправлено |
| 8 | Webhook Stripe не проверяет сумму + нет идемпотентности | Оплата | 🟡 Medium | ✅ Исправлено |
| 9 | Translate API без авторизации → абьюз DeepL/БД, отравление кэша | API | 🟡 Medium | ✅ Исправлено |
| 10 | Нет Content-Security-Policy | Hardening | 🟡 Medium | ✅ Исправлено |
| 11 | XSS через JSON-LD (`JSON.stringify` внутри `<script>`) | Storefront | 🟢 Low | ✅ Исправлено |
| 12 | Смена пароля не инвалидирует сессии (admin + profile) | Аккаунт | 🟢 Low | ✅ Исправлено |
| 13 | Rate-limit в памяти процесса (неэффективен в serverless) | Auth | 🟢 Low | ⚠️ Требует Redis |
| 14 | Reset пароля снимал SUSPENDED с заблокированного аккаунта | Auth | 🟢 Low | ✅ Исправлено |

---

## 🔴 Critical

### 1. Токен сброса пароля отдаётся тому, кто его запросил → полный захват любого аккаунта

**Файлы:** `app/(auth)/actions.ts:82-105`, `lib/auth/users.ts:101-125`

`requestPasswordResetAction` при существующем email возвращает клиенту `previewUrl`, в который вшит валидный токен сброса:

```ts
return {
  success: "Reset link generated.",
  previewUrl: buildResetUrl(result.token),   // ← ссылка с токеном отдаётся в UI
};
```

Токен создаётся сразу как рабочий (`resetPasswordFromToken` его принимает). То есть **любой аноним** может ввести email жертвы, получить в ответе ссылку `/reset-password?token=...` и сменить ей пароль — включая аккаунт администратора. Это прямой account takeover без доступа к почте жертвы.

Комментарий в коде («local mode») намекает, что это было отладочное удобство, но ветка срабатывает в любом окружении, где почта не настроена (а отправка письма нигде не реализована — токен вообще никуда не уходит, кроме ответа).

**Рекомендации:**
- Никогда не возвращать токен/ссылку в HTTP-ответе. Отправлять письмо на почту, в ответе — всегда одинаковый нейтральный текст.
- Пока нет почтового провайдера — блокировать сброс, а не логировать/показывать токен.

---

### 2. Заказ помечается «оплаченным» без реальной проверки платежа

**Файлы:** `app/checkout/confirmed/actions.ts:13-40`, `lib/commerce/checkout.ts:230-252`, `app/checkout/confirmed/page.tsx:29-65`

Статусы оплаты выставляются на стороне приложения, инициируются с клиента и **не сверяются со Stripe**:

```ts
// finalizeConfirmedCheckoutAction — вызывается из клиентского компонента CheckoutFinalizer
await db.order.updateMany({
  where: { id: resolvedOrderId, status: "DRAFT" },
  data: { status: "PENDING", paymentStatus: "AUTHORIZED", ... },   // без проверки оплаты
});
```

Дополнительно страница подтверждения считает успехом даже **незавершённый** платёж:

```ts
const isComplete =
  session.status === "complete" ||
  session.payment_status === "paid" ||
  session.status === "open";   // ← "open" = оплата НЕ завершена, но трактуется как успех
```

Итог: пользователь может дойти до `/checkout/confirmed` (или напрямую дёрнуть server action `finalizeConfirmedCheckoutAction` с id своего заказа из cookie) и получить заказ в статусе `AUTHORIZED` с очищенной корзиной, **не заплатив**. Единственный надёжный источник `PAID` — вебхук `checkout.session.completed`, но параллельный клиентский путь создаёт бизнес-статусы в обход него. Если фулфилмент реагирует на `PENDING`/`AUTHORIZED` — это бесплатный заказ.

**Рекомендации:**
- Статус оплаты менять **только** из проверенного вебхука Stripe (`checkout.session.completed` с `payment_status === "paid"`).
- Убрать трактовку `status === "open"` как успеха.
- Клиентский `finalize`-путь не должен переводить заказ в оплаченные статусы — максимум показывать «ожидаем подтверждение оплаты».

---

## 🟠 High

### 3. Первый зарегистрированный пользователь автоматически становится админом

**Файл:** `lib/auth/users.ts:33-63`

```ts
const existingAdmin = await db.userRole.findFirst({ where: { role: { key: "admin" } }, ... });
...
const roleId = !existingAdmin && adminRole ? adminRole : customerRole;  // нет админа → выдаём admin
```

Логика «первый = админ» опасна:
- На свежем/пересозданном деплое или если админ-роль когда-либо удалена, следующий регистрирующийся получает **полный** доступ к админке.
- Есть гонка: при одновременных регистрациях, пока админа нет, несколько аккаунтов могут пройти проверку `existingAdmin === null` и все стать админами (нет транзакции/уникального ограничения).

**Рекомендации:** назначать администратора отдельным контролируемым процессом (сид/CLI/env allowlist), а не по факту очерёдности регистрации. Регистрация публичного пользователя должна всегда давать только `customer`.

### 4. Нет rate-limiting на вход, регистрацию и запрос сброса пароля

**Файлы:** `app/(auth)/actions.ts` (все actions), `lib/auth/guard.ts:22`

Функция `checkRateLimit` есть, но используется **только** в смене пароля профиля (`app/profile/actions.ts:36`). `loginAction`, `registerAction`, `requestPasswordResetAction`, `resetPasswordAction` не защищены → брутфорс паролей, перебор email, массовое создание аккаунтов, абьюз токенов сброса. Нет и блокировки аккаунта после N неудач.

**Рекомендации:** применить `checkRateLimit` (по IP + по email) ко всем auth-actions; добавить экспоненциальную задержку/лок аккаунта.

---

## 🟡 Medium

### 5. Enumeration пользователей
- `requestPasswordResetAction` (`app/(auth)/actions.ts:92-104`): для существующего email возвращается `previewUrl`, для несуществующего — нет. Ответ отличается → можно проверять, зарегистрирован ли адрес.
- `registerUser` (`lib/auth/users.ts:29`): «An account with that email already exists» — прямое подтверждение наличия аккаунта.

Логин (`"Incorrect email or password."`) — сделан правильно (нейтрально). **Рекомендация:** унифицировать ответы reset/register до нейтральных.

### 6. Захардкоженный секрет сессии и слабое подписание токена
**Файл:** `lib/auth/session.ts:12-18`

```ts
function getSessionSecret() {
  return env.AUTH_SESSION_SECRET ?? env.NEXTAUTH_SECRET ?? "synarava-dev-session-secret"; // fallback
}
function signSessionToken(token: string) {
  return createHash("sha256").update(`${token}:${getSessionSecret()}`).digest("hex"); // не HMAC
}
```
- Если секрет не задан в окружении — используется публично известная строка. `lib/env.ts` не требует секрет обязательным в production.
- Используется простой `sha256(token:secret)` вместо HMAC. Сам токен случайный (32 байта), так что прямой подделки нет, но конструкция нестандартная и легко деградирует при копипасте.

**Рекомендации:** сделать `AUTH_SESSION_SECRET` обязательным (валидация в `env.ts`, падать при отсутствии в prod); заменить на `crypto.createHmac`.

### 7. SVG-загрузки хранятся без обработки → возможный stored XSS
**Файл:** `lib/media/local-upload.ts:38-53, 106`

`shouldSkipImageProcessing` пропускает `image/svg+xml` и `image/gif` мимо sharp и пишет файл «как есть» в `public/uploads/...`, доступный по прямому URL на том же origin. SVG может содержать `<script>`; при прямом открытии `/uploads/...svg` он исполнится в контексте сайта. Проверка типа опирается на клиентский `file.type` (`file.type.startsWith("image/")`), содержимое не валидируется. Требует прав `products.manage`, поэтому риск ограничен доверенными редакторами, но остаётся вектором для скомпрометированного/недобросовестного редактора.

**Рекомендации:** запретить SVG или санитизировать (DOMPurify/svgo с удалением скриптов); отдавать `/uploads` с `Content-Disposition: attachment` или с отдельного домена/CDN; проверять реальный MIME по сигнатуре файла.

### 8. Вебхук Stripe: нет сверки суммы и идемпотентности
**Файл:** `app/api/stripe/webhook/route.ts:32-47`

Подпись проверяется корректно (`constructEvent`) — хорошо. Но при `checkout.session.completed` заказ помечается `PAID` только по `metadata.orderId`, **без сверки** `amount_total`/валюты с суммой заказа в БД и без защиты от повторной обработки события (идемпотентность). 

**Рекомендации:** сверять оплаченную сумму и валюту с заказом; хранить обработанные `event.id` для идемпотентности.

### 9. Translate API без авторизации → абьюз и отравление кэша
**Файл:** `app/api/translate/route.ts:59-101`

`GET /api/translate?locale=xx` открыт всем. Для неизвестной локали дёргает платный DeepL и делает `upsert` в `translationCache` по произвольному `locale` из query. Аноним может: генерировать расходы на DeepL, засорять таблицу кэша произвольными ключами локалей.

**Рекомендации:** ограничить `locale` белым списком поддерживаемых значений; добавить rate-limit/кэш-контроль; не создавать записи БД для непредусмотренных локалей.

### 10. Отсутствует Content-Security-Policy
**Файл:** `next.config.ts:19-33`

Заданы `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` — хорошо, но **нет CSP**. CSP заметно снижает воздействие любого XSS (в т.ч. #7 и #11).

**Рекомендация:** добавить строгую `Content-Security-Policy` (script-src self + nonce, object-src none, base-uri none).

---

## 🟢 Low / Hardening

### 11. XSS через JSON-LD
**Файлы:** `app/collections/[slug]/page.tsx:60`, `app/artifacts/[id]/product-page.tsx:76-80`

```tsx
dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
```
`JSON.stringify` не экранирует `<`/`/`, поэтому имя товара/коллекции с подстрокой `</script><script>…` вырвется из тега. Данные админ-контролируемые, риск невелик, но реальный. **Рекомендация:** экранировать `<`, `>`, `&` (или заменять `<` на `<`) перед вставкой в `<script>`.

### 12. Смена пароля админа не инвалидирует сессии
**Файл:** `lib/auth/users.ts:164-200` (`updateUserCredentials`)

В отличие от `updatePasswordAction` профиля (`app/profile/actions.ts:67`, где сессии сбрасываются), смена пароля/email в админке не удаляет активные сессии. Украденный токен остаётся валидным после смены пароля. **Рекомендация:** после смены пароля удалять `userSession` пользователя.

### 13. Rate-limit хранится в памяти процесса
**Файл:** `lib/auth/guard.ts:6-45`

Комментарий это признаёт: в serverless/несколько инстансов лимит не общий и легко обходится. **Рекомендация:** вынести в Redis/БД для продакшена.

### 14. Прочее
- Регистрация ставит `emailVerifiedAt: new Date()` (`lib/auth/users.ts:50`) — email фактически не подтверждается.
- `resetPasswordFromToken` (`lib/auth/users.ts:146-152`) выставляет `status: "ACTIVE"` — сброс пароля может снять `SUSPENDED` с заблокированного аккаунта.
- Нет глобального `middleware.ts` — вся защита маршрутов держится на `requirePermission`/`requireUser` внутри страниц/actions. Покрытие сейчас корректное, но легко забыть на новом маршруте.

---

---

## Применённые исправления (changelog)

| Файл | Что изменено |
|------|-------------|
| `app/(auth)/actions.ts` | Убран `previewUrl` из ответа reset; нейтральный ответ независимо от наличия email (#1, #5); rate-limiting по IP + email на login/register/reset (#4); нейтральная ошибка регистрации (#5) |
| `lib/auth/users.ts` | Авто-админ заменён на проверку `ADMIN_EMAIL` env (#3); `resetPasswordFromToken` больше не выставляет `status: ACTIVE` (#14); `updateUserCredentials` удаляет все сессии при смене пароля (#12) |
| `lib/auth/session.ts` | Подпись токена переведена с `sha256(token:secret)` на `HMAC-SHA256(token, secret)`; в production без секрета — `throw` (#6) |
| `app/checkout/confirmed/actions.ts` | `finalizeConfirmedCheckoutAction` больше не меняет статус заказа — только очищает корзину и cookies (#2) |
| `lib/commerce/checkout.ts` | `confirmCheckoutOrder` больше не ставит `AUTHORIZED` — только очищает корзину (#2) |
| `app/checkout/confirmed/page.tsx` | Убрано условие `session.status === "open"` как признак успешной оплаты (#2) |
| `app/api/stripe/webhook/route.ts` | Добавлена проверка суммы и валюты против заказа в БД; идемпотентность — если `paymentStatus === PAID`, событие пропускается (#8) |
| `app/api/translate/route.ts` | Добавлен allowlist разрешённых локалей; неизвестные локали возвращают английский без обращения к DeepL/БД (#9) |
| `lib/media/local-upload.ts` | SVG-загрузки отклоняются с ошибкой (#7) |
| `next.config.ts` | Добавлен заголовок `Content-Security-Policy` (#10) |
| `app/artifacts/[id]/product-page.tsx` | JSON-LD экранируется через `safeJsonLd()` (unicode escapes для `<`, `>`, `&`) (#11) |
| `app/collections/[slug]/page.tsx` | То же (#11) |

### Что требует ручного действия перед деплоем

- **`ADMIN_EMAIL`** — установить env var с email первого администратора. Без него все новые пользователи будут `customer`, а admin-аккаунт создать не получится через публичную регистрацию.
- **`AUTH_SESSION_SECRET`** — обязателен в production (приложение упадёт без него). Смена HMAC-алгоритма инвалидирует все существующие сессии (пользователи разлогинятся один раз).
- **Email-провайдер для сброса пароля** — токен создаётся в БД, но не доставляется пользователю. Нужно подключить SMTP/SendGrid/Resend и отправлять письмо в `requestPasswordResetAction`.
- **Redis для rate-limiting** — in-memory rate limit не работает между инстансами (пункт #13). Для production заменить `_rl` map в `lib/auth/guard.ts` на Redis-клиент (Upstash/ioredis).

---

## Что сделано хорошо

- **Пароли:** `scrypt` с солью + `timingSafeEqual` (`lib/auth/password.ts`) — корректно.
- **Цены заказа считаются на сервере** из БД товара (`lib/commerce/cart.ts`, `lib/commerce/checkout.ts`) — клиент не может подменить цену/сумму.
- **Проверка подписи вебхука** Stripe через `constructEvent` — корректно.
- **Авторизация в админке многослойная:** guard в `app/admin/layout.tsx` + `requirePermission(...)` в **каждом** server action (`app/admin/actions.ts`) — хорошая defense-in-depth, RBAC через роли/permissions.
- **Проверки владения ресурсами:** `assertOwnership` / `assertOrderOwnership` / `assertAddressOwnership` (`lib/auth/guard.ts`) резолвят пользователя из сессии, а не из клиентских параметров — правильный подход против IDOR. Операции с корзиной/адресами scoped по `cartId`/владельцу.
- **Cookie сессии:** `httpOnly`, `sameSite=lax`, `secure` в production, разумный TTL.
- **Server Actions** дают встроенную защиту от CSRF (проверка Origin) — отдельная защита форм не требуется.
- Заголовки безопасности (`X-Frame-Options`, `nosniff` и др.) заданы.
- Смена пароля в профиле инвалидирует все сессии.

---

## Приоритет исправления

1. **Немедленно:** #1 (утечка reset-токена) и #2 (обход оплаты) — оба эксплуатируются анонимно и ведут к захвату аккаунтов / бесплатным заказам.
2. **Далее:** #3 (авто-админ), #4 (rate-limit на auth).
3. **Затем:** #5–#10.
4. **Hardening:** #11–#14.
