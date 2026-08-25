# Security Audit — Synarava Jewelry (итерация 2)

**Дата аудита:** 2026-08-25
**Область:** весь проект — server actions, API routes, guards/авторизация, сессии, checkout/оплата, Shopify-интеграции, загрузка файлов, заголовки, CI.
**Метод:** ручной обзор кода + сверка с `.next/server/server-reference-manifest.json` (какие server actions реально экспонированы) и `app-paths-manifest.json` (какие роуты собраны).
**Предыдущий аудит:** `SECURITY_AUDIT.md` (2026-07-07). Все 13 исправимых пунктов оттуда подтверждены как закрытые; ниже — только **новые** находки и то, что осталось открытым.

---

## Сводка

| # | Находка | Область | Критичность | Статус |
|---|---------|---------|-------------|--------|
| H1 | IDOR: черновик чужого заказа читается по подменённой cookie | Checkout | 🟠 High | ❗ Открыто |
| H2 | Админ-сессия неотзываема (stateless), нет привязки к устройству | Admin auth | 🟠 High | ❗ Открыто |
| H3 | Rate-limit обходится подменой `X-Forwarded-For`; хранилище в памяти процесса | Auth | 🟠 High | ❗ Открыто |
| M1 | Нет `middleware.ts`; админка защищена только через layout | Hardening | 🟡 Medium | ❗ Открыто |
| M2 | `/checkout/confirmed?session_id=` принимает произвольную Stripe-сессию | Checkout | 🟡 Medium | ❗ Открыто |
| M3 | Корзина не очищается при выходе + может вернуться чужая корзина | Commerce | 🟡 Medium | ❗ Открыто |
| M4 | `/api/cart/items` без auth и rate-limit → неограниченное создание строк в БД | API | 🟡 Medium | ❗ Открыто |
| M5 | Загрузка файлов доверяет клиентскому MIME; нет `limitInputPixels` | Media | 🟡 Medium | ❗ Открыто |
| M6 | `serverActions.bodySizeLimit: 55mb` для публичных экшенов | DoS | 🟡 Medium | ❗ Открыто |
| M7 | Нет HSTS и `frame-ancestors`; CSP с `'unsafe-inline'` | Headers | 🟡 Medium | ❗ Открыто |
| M8 | Мёртвая параллельная система паролей (+ open redirect внутри) | Auth | 🟡 Medium | ❗ Открыто |
| L1–L12 | См. раздел Low | — | 🟢 Low | ❗ Открыто |
| — | Rate-limit в памяти (п.13 прошлого аудита) | Auth | 🟢 Low | ⚠️ Всё ещё требует Redis |

---

## 🟠 High

### H1. IDOR: чужой черновик заказа читается по подменённой cookie

**Файлы:** `lib/commerce/checkout.ts:211-229`, `app/checkout/payment/page.tsx:15-21`

`getCheckoutOrder()` берёт id заказа **напрямую из cookie** `synarava-checkout-order` и делает `findUnique` без единой проверки принадлежности:

```ts
export async function getCheckoutOrder() {
  const orderId = await getCheckoutOrderIdFromCookie();   // ← значение задаёт клиент
  if (!orderId) return null;
  return db.order.findUnique({ where: { id: orderId }, include: { items: true, user: true } });
}
```

`httpOnly` защищает только от чтения через JS — **записать** произвольное значение cookie может кто угодно (DevTools, `curl -b`). Далее `/checkout/payment` рендерит `customerName`, `customerEmail`, `shippingAddress` и позиции заказа, а `createOrGetStripeCheckoutSession(order.id)` (`lib/commerce/checkout.ts:31`) отдаёт `client_secret` Stripe для чужого заказа.

Ограничения эксплуатации: доступны только заказы в статусе `DRAFT`, а `Order.id` — `cuid()` (v1). Cuid v1 содержит предсказуемые timestamp+counter и ~8 символов случайности — это не криптостойкий идентификатор (см. L2).

Роут собран и живой при `COMMERCE_BACKEND=local` — это значение по умолчанию.

**Что делать:**
1. В `getCheckoutOrder()` добавить проверку: `order.userId === session.user.id` для авторизованных; для гостей — привязать заказ к отдельному подписанному (HMAC) значению в cookie, а не к «голому» id.
2. Заменить `@default(cuid())` на `@default(cuid(2))`/`uuid()` для `Order` — либо хранить отдельный неугадываемый `accessToken` на заказе.
3. Убрать `user: true` из `include` (см. L1).

---

### H2. Админ-сессия неотзываема

**Файл:** `lib/auth/admin-session.ts:80-155`

Админ-сессия — это самоподписанный stateless-токен `username:issuedAt:random.HMAC`, никакой серверной записи о ней нет. Последствия:

- `clearAdminSession()` (`:103`) просто затирает cookie в **текущем** браузере. Скопированная cookie (украденная с ноутбука, из бэкапа профиля, из логов прокси) остаётся валидной все 8 часов — «выйти на всех устройствах» невозможно в принципе.
- Единственный способ отозвать всё — ротация `ADMIN_SESSION_SECRET` и рестарт.
- Учётка одна на всех: `AdminSession.id` всегда `null` (`:12`), поэтому `writeAuditLog({ actorId: currentUser?.id })` в `app/admin/actions.ts` **всегда пишет `actorId: null`** — журнал изменений не связывается ни с кем (см. L9).

Заметьте контраст: пользовательские сессии (`lib/auth/session.ts`) сделаны правильно — строка в `UserSession`, удаление при смене пароля, `revokeAllSessionsAction`. Админка живёт по более слабой модели, хотя её компрометация опаснее.

**Что делать:** перенести админ-сессии в таблицу (`AdminSession { id, username, expiresAt, createdAt, userAgent, ip }`), хранить в cookie только id; logout удаляет строку; добавить экран «активные сессии» и запись в `AuditLog` на вход/выход/неуспешный вход.

---

### H3. Rate-limit обходится подменой заголовка; хранилище — память процесса

**Файлы:** `app/admin/login/actions.ts:19-21`, `app/(auth)/actions.ts:22-24`, `lib/auth/guard.ts:6-47`

```ts
return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
```

Берётся **первый** элемент `X-Forwarded-For`. Прокси только *дописывают* значения справа, поэтому левый элемент полностью контролируется клиентом: `X-Forwarded-For: <случайный ip>` на каждом запросе полностью обнуляет лимит `admin-login-ip` (10/15 мин).

Лимит по username (5/15 мин) при этом ещё держится — прямой брутфорс пароля не открывается. Но остаются:

- **Рост памяти без границ.** `_rl` (`guard.ts:8`) — обычный `Map`, ключ включает подконтрольную атакующему строку (ip, email, username). Очистка идёт `setInterval` раз в 600 с (`:14`); между уборками можно набить миллионы ключей. Это OOM.
- **Лимиты не переживают рестарт и не общие между репликами.** На Railway при масштабировании >1 инстанса эффективный лимит умножается на число реплик.
- **Блокировка чужой учётки.** Лимит по username 5/15 мин позволяет атакующему держать админа заблокированным неограниченно долго.

**Что делать:** брать **правый** элемент XFF (или платформенный доверенный заголовок) и число доверенных прокси сделать конфигурацией; перевести счётчики в Redis/БД с TTL; ограничить размер `Map` (LRU) как временную меру; лимит по username считать только после успешного совпадения username, иначе — только по IP.

---

## 🟡 Medium

### M1. Нет `middleware.ts`; админка защищена только layout'ом

В проекте отсутствует `middleware.ts`. Единственный барьер перед всей админкой — `await requireAdminSession("/admin")` в `app/admin/(studio)/layout.tsx:22`. Документация Next.js прямо предупреждает не полагаться на layout для авторизации: layout и page рендерятся параллельно, layout не перевыполняется при клиентских переходах между соседними роутами внутри него, и любой новый роут вне группы `(studio)` окажется незащищённым автоматически.

Страницы под `(studio)` сами по себе **не** вызывают guard — проверено: из 22 файлов под `app/admin/` guard есть только в `(studio)/layout.tsx`, `(studio)/account/page.tsx`, `admin/login/page.tsx` и `admin/api/videos/route.ts`.

Хорошая новость: **все 27 экспонированных admin server actions вызывают `requireAdminSession`** — проверено пофайлово и сверено с билд-манифестом. То есть запись защищена; уязвимо именно чтение при будущих ошибках раскладки роутов.

**Что делать:** добавить `middleware.ts` с matcher `/admin/:path*`, проверяющим наличие и подпись cookie (быстрый отказ), сохранив `requireAdminSession` в layout и в каждом экшене как основную проверку. Заодно middleware даёт место для per-request nonce в CSP (см. M7).

---

### M2. `/checkout/confirmed?session_id=` принимает произвольную Stripe-сессию

**Файл:** `app/checkout/confirmed/page.tsx:36-58`

`session_id` берётся из query-строки и передаётся в `stripe.checkout.sessions.retrieve()` без проверки, что сессия принадлежит текущему посетителю. При статусе `complete` страница печатает `order.number` и `order.customerEmail`. Id вида `cs_live_...` не угадывается, но утекает в Referer, историю браузера, логи и аналитику — это классический канал утечки.

**Что делать:** сверять `session.metadata.orderId` с подтверждённым заказом из cookie (`getConfirmedOrderIdFromCookie`), как это уже сделано в «legacy»-ветке той же страницы (`:104-108`).

---

### M3. Корзина не очищается при выходе и может «прилипнуть» к чужому аккаунту

**Файлы:** `app/api/auth/shopify/logout/route.ts:31-33`, `lib/commerce/cart.ts:88-121`

1. Logout удаляет только `synarava-shopify-customer-session`. Cookie `synarava-cart` (30 дней) и `synarava-shopify-cart` (30 дней) остаются. На общем устройстве следующий пользователь видит корзину предыдущего.

2. В `getOrCreateCart()` есть дыра в цепочке условий (`cart.ts:112-127`):

```ts
if (cart && cart.userId && cart.userId !== currentUser.id && userCart) { cart = userCart; }
else if (cart && !cart.userId) { … }
else if (!cart && userCart) { cart = userCart; }
```

Если cookie указывает на корзину **другого** пользователя, а у текущего своей активной корзины нет (`userCart === null`), ни одна ветка не срабатывает — и `cart` остаётся чужой корзиной. Пользователь получает чтение и запись по ней.

**Что делать:** удалять обе cart-cookie при logout; в `getOrCreateCart` явным условием сбрасывать `cart = null`, если `cart.userId && cart.userId !== currentUser.id`.

---

### M4. `/api/cart/items` — без аутентификации, без лимитов

**Файл:** `app/api/cart/items/route.ts:8-31`

Анонимный POST без rate-limit. Каждый запрос без cookie создаёт **новую строку `Cart`** (`lib/commerce/cart.ts:130-142`) — неограниченная запись в БД от неаутентифицированного клиента. Плюс `merchandiseId` из тела уходит напрямую в Shopify `cartLinesAdd`, минуя проверку `availableForSale` из `resolveMerchandiseId` (L10), а в ответе возвращается `error.message` внутренней ошибки (L7).

**Что делать:** `checkRateLimit` по IP; не создавать `Cart` до первого валидного товара; отдавать клиенту обобщённое сообщение об ошибке; чистить брошенные пустые корзины по расписанию.

---

### M5. Загрузка изображений доверяет клиентскому MIME

**Файл:** `lib/media/local-upload.ts:44-92, 95-116`

- Проверка типа — `file.type.startsWith("image/")` (`:100`), то есть **заявленный клиентом** MIME из multipart-части, а не магические байты.
- В `prepareImageForStorage` есть fallback (`:83-91`): если `sharp` не смог разобрать файл, в бакет кладётся **исходный байт-поток** с расширением из `path.extname(file.name)` (`:20-23`) — то есть с произвольным расширением (`.html`, `.js`), заявленным клиентом.
- `sharp(..., { failOn: "none" })` без `limitInputPixels` — 10-мегабайтный PNG может распаковаться в сотни мегапикселей (лимит sharp по умолчанию ~268 MP). Это memory-DoS на процессе Next.

Прямой stored XSS здесь не получается: `Content-Type` остаётся `image/*`, а `X-Content-Type-Options: nosniff` выставлен глобально. Отдельно отмечу, что SVG корректно отклоняется (`:105-108`) — это исправление прошлого аудита на месте.

**Что делать:** валидировать по магическим байтам (`file-type`/`sharp().metadata()`) и брать расширение **только** из распознанного формата по allow-list; убрать «сохраняем как есть» fallback — не распознали, значит отказ; выставить `limitInputPixels` (напр. 50 MP) и `sequentialRead: true`.

---

### M6. `bodySizeLimit: "55mb"` действует и на публичные server actions

**Файл:** `next.config.ts:72-76`

Лимит глобальный. По билд-манифесту публично экспонированы `submitShippingAction`, `confirmOrderAction`, `resetCheckoutAction`, `increase/decrease/removeCartItemAction`, `finalizeConfirmedCheckoutAction` — любой аноним может слать в них 55 МБ на запрос. 55 МБ нужны только загрузке видео/картинок в админке.

**Что делать:** снизить глобальный лимит до ~2 МБ. Крупные файлы в админке уже идут мимо server actions — через presigned PUT в `app/admin/api/videos/route.ts`; тот же приём применить к изображениям товаров.

---

### M7. Пробелы в заголовках безопасности

**Файл:** `next.config.ts:113-152`

Настроено хорошо (CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`), не хватает:

- **`Strict-Transport-Security`** — отсутствует полностью. Для платёжного сайта это обязательный заголовок: `max-age=63072000; includeSubDomains; preload`.
- **`frame-ancestors 'none'`** в CSP — `X-Frame-Options` устарел, современные браузеры смотрят на CSP.
- **`script-src 'unsafe-inline'`** (`:121`) — комментарий в коде честно признаёт проблему. Полностью нивелирует CSP как защиту от XSS. Лечится per-request nonce из middleware (см. M1).
- `upgrade-insecure-requests` не помешает.

---

### M8. Мёртвая параллельная система паролей всё ещё в репозитории

**Файлы:** `app/(auth)/actions.ts`, `lib/auth/users.ts`, `lib/auth/session.ts`, `app/profile/actions.ts`, `components/auth/{login,register,reset-password}-form.tsx`

Логин переехал на Shopify Customer Accounts: `/login` рендерит кнопку OAuth, `/register` и `/reset-password` делают `redirect("/login")`. Формы `LoginForm`/`RegisterForm`/`ResetPasswordForm` **нигде не рендерятся**, поэтому соответствующие server actions отсутствуют в `server-reference-manifest.json` — сейчас их **нельзя вызвать** извне. Это проверено, не предположение.

Но код остался, и в нём есть заряженные проблемы, которые оживут при первом же возврате формы на страницу:

- **Open redirect** в `loginAction` (`app/(auth)/actions.ts:33,51-53`): `redirectTo` из формы уходит в `redirect(redirectTo)` без проверки. Для сравнения — админский логин такую проверку имеет (`getSafeAdminRedirect`), а `/login` использует `safeCustomerReturnPath`; в самом экшене её нет.
- **Токены сброса хранятся в открытом виде** (`VerificationToken.token`, `lib/auth/users.ts:104-120`): дамп/SQL-инъекция в этой таблице = захват любого аккаунта. Нужен хэш.
- **`resetPasswordFromToken` не инвалидирует сессии** (`lib/auth/users.ts:139-165`) — в отличие от `updateUserCredentials` и `updatePasswordAction`, где это сделано. Сброс пароля после угона сессии не выкидывает угонщика.
- Старые токены сброса не аннулируются при выпуске нового.

**Что делать:** решить явно. Либо удалить `app/(auth)/`, `lib/auth/{users,session,guard,password,password-policy,bootstrap}.ts`, `app/profile/actions.ts` и три формы (тогда почистить и Prisma-модели `UserSession`, `VerificationToken`, `AuthAccount`), либо, если возврат планируется, исправить четыре пункта выше **до** того, как формы вернутся на страницы. Держать это в текущем виде — значит хранить готовый account takeover за одним импортом.

---

## 🟢 Low / Hardening

- **L1.** `getCheckoutOrder()` (`lib/commerce/checkout.ts:225`) делает `include: { user: true }` — в память серверного компонента тянется `passwordHash`. Сейчас на клиент не утекает (`PaymentConfirmPanel` — серверный компонент), но это ровно то, от чего защищается явный `select` в `lib/auth/session.ts:82-86`. Заменить на `select`.
- **L2.** `Order.id` — `cuid()` v1: предсказуемые timestamp и counter, ограниченная случайность. Усиливает H1. Перейти на `cuid(2)`/`uuid()`.
- **L3.** `verifyAdminCredentials` (`lib/auth/admin-session.ts:31-38,69`): `constantTimeEqual` возвращает `false` до сравнения при разной длине — оракул длины username. Сравнивать хэши фиксированной длины.
- **L4.** `getShopifyBuyerIp()` (`lib/shopify/request-context.ts:6-12`) берёт клиентский `X-Forwarded-For` и отправляет его Shopify в `Shopify-Storefront-Buyer-IP` — клиент подделывает IP для антифрода и rate-limit Shopify.
- **L5.** Количество в корзине без верхней границы и без проверки на `NaN`: `Number(formData.get("quantity")) + 1` (`app/cart/actions.ts:32,39`) → `NaN` доходит до `db.cartItem.updateMany({ data: { quantity: NaN } })` и роняет запрос. Валидировать целое в диапазоне 1…N.
- **L6.** `/media/[...key]` (`app/media/[...key]/route.ts`) — публичный, отдаёт любой объект под префиксом `uploads/`, а для видео выдаёт подписанную ссылку на **1 час**. Сейчас там только публичный контент; при появлении приватных вложений роут станет утечкой. Сузить префиксы и уменьшить TTL подписи.
- **L7.** Внутренние `error.message` уходят клиенту: `app/api/cart/items/route.ts:28` и `app/api/shopify/webhooks/products/route.ts:74`.
- **L8.** В CI (`.github/workflows/ci.yml`) нет `pnpm audit` / `osv-scanner`, в `.github/` нет `dependabot.yml`. Уязвимости зависимостей никто не отслеживает.
- **L9.** `AuditLog.actorId` всегда `null` (следствие H2) — журнал не отвечает на вопрос «кто».
- **L10.** `merchandiseId` из тела `/api/cart/items` уходит в Shopify напрямую, минуя проверку `availableForSale` (`lib/shopify/cart.ts:161-183,272-280`).
- **L11.** `existingImageUrl` из формы пишется в `product.imageUrl` без валидации схемы URL (`app/admin/actions.ts:1476-1478`). Ограничить `https:` + список доверенных хостов.
- **L12.** `/api/translate` — неаутентифицированный GET, который для локали из allow-list, ещё не осевшей в статике/кэше БД, инициирует платные вызовы DeepL. Кэш спасает после первого раза, но при ошибке DeepL кэш не пишется и каждый запрос бьёт по API заново.

---

## Что сделано хорошо

Это стоит зафиксировать — многое здесь сделано на уровне заметно выше среднего:

- **Stripe webhook** (`app/api/stripe/webhook/route.ts`): проверка подписи, сверка `amount_total`/`currency` с заказом, идемпотентность по `paymentStatus`, статус оплаты выставляется **только** из вебхука. Исправления прошлого аудита на месте.
- **Shopify webhook** (`lib/shopify/webhooks.ts`, `app/api/shopify/webhooks/products/route.ts`): HMAC-SHA256 + `timingSafeEqual` со сравнением длин, дедупликация через `@unique` на `shopifyWebhookId`, парсинг тела строго после проверки подписи.
- **Shopify Customer Accounts OAuth** (`lib/shopify/customer-account/*`): PKCE S256, `state`, `nonce`, полная проверка `id_token` по JWKS (подпись, `aud`, `iss`, `exp`, `iat`, `nonce`), TTL транзакции 10 минут, AES-256-GCM для транзакционной cookie и для токенов в БД, session id — 32 случайных байта. Реализовано корректно.
- **Guard'ы админки:** все 27 экспонированных admin server actions вызывают `requireAdminSession` — сверено с билд-манифестом, дыр нет.
- **Ownership-модель:** `lib/commerce/profile.ts` не принимает `userId` ни в одной функции — только из сессии. `assertOrderOwnership` / `assertAddressOwnership` написаны правильно.
- **SQL:** ни одного `$queryRawUnsafe`; единственный raw-SQL (`session-store.ts`) — параметризованные tagged templates.
- **JSON-LD** экранируется (`<`, `>`, `&`) в обоих местах.
- **Секреты:** ничего не закоммичено, `.env*` в `.gitignore`, в коде только плейсхолдеры в документации. Есть hook, блокирующий чтение `.env`.
- **Загрузка видео** (`app/admin/api/videos/route.ts`): presigned PUT с закреплённым `ContentType`, а после загрузки — `HeadObject` со сверкой размера и типа. Правильный паттерн.
- Куки везде `httpOnly` + `sameSite: lax` + `secure` в production.

---

## Приоритет

1. **H1** — единственная находка с прямой утечкой чужих персональных данных. Чинится одной проверкой владельца.
2. **M8** — решить судьбу мёртвой парольной подсистемы. Дёшево сейчас, дорого потом.
3. **H2 + H3** — модель админ-сессий и rate-limit: перенести в БД/Redis.
4. **M1 + M7** — `middleware.ts` закрывает сразу два пункта (защита роутов + nonce для CSP), плюс HSTS.
5. **M4, M6, M2, M3, M5** — устойчивость и утечки поменьше.
6. **L1–L12, L8** — гигиена; `dependabot.yml` добавляется за пять минут.
