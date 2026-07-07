# Deploy Checklist — Synarava Jewelry

Список всего что нужно настроить перед деплоем в production.
Обновляй этот файл по мере того как что-то добавляется или закрывается.

---

## Environment Variables

### Обязательные (без них приложение не запустится)

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SESSION_SECRET` | Секрет для подписи сессионных токенов (HMAC-SHA256). Минимум 32 случайных символа. Генерить: `openssl rand -hex 32` |

### Обязательные для оплаты

| Переменная | Описание |
|-----------|----------|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Секрет вебхука Stripe (`whsec_...`). Создаётся в Stripe Dashboard → Webhooks |
| `NEXT_PUBLIC_APP_URL` | Полный URL приложения (`https://synarava.com`). Нужен для return_url Stripe |

### Для первого администратора

| Переменная | Описание |
|-----------|----------|
| `ADMIN_EMAIL` | Email первого администратора. Только этот email при регистрации получит роль `admin`. Убрать после создания аккаунта. |

### Для медиа (выбрать одно: S3 или локальное хранилище)

| Переменная | Описание |
|-----------|----------|
| `S3_REGION` | AWS регион (`eu-central-1`) |
| `S3_BUCKET` | Имя бакета |
| `S3_ACCESS_KEY_ID` | AWS access key |
| `S3_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_ENDPOINT` | Опционально — для совместимых хранилищ (Minio, R2, etc.) |

### Опциональные

| Переменная | Описание |
|-----------|----------|
| `NEXTAUTH_URL` | Базовый URL (если не задан `NEXT_PUBLIC_APP_URL`) |
| `DEEPL_API_KEY` | API ключ DeepL для машинного перевода |

---

## Перед первым запуском

- [ ] Проверить версию релиза в `package.json` (`0.2.0` для текущего Railway-ready pass)
- [ ] Прогнать preflight локально: `pnpm lint`, `pnpm test:run`, `pnpm exec tsc --noEmit`, `pnpm build`
- [ ] Запустить миграции: `pnpm prisma:deploy` (на Railway это делает `railway.json` `preDeployCommand`)
- [ ] Зарегистрироваться по адресу из `ADMIN_EMAIL` — аккаунт получит роль `admin`
- [ ] После регистрации убрать `ADMIN_EMAIL` из env (или оставить — повторно admin не выдастся)
- [ ] Проверить что `/admin` открывается и доступны все разделы

## Railway

Конфигурация деплоя хранится в `railway.json`, чтобы build/deploy protocol был версионирован в git:

- builder: `RAILPACK`
- build command: `pnpm build`
- pre-deploy command: `pnpm prisma:deploy`
- start command: `pnpm start`
- healthcheck: `/api/health`

Для PostgreSQL в Railway выставить `DATABASE_URL` как reference variable на Postgres service, например `${{Postgres.DATABASE_URL}}`.

### Версионирование релиза

- [ ] Перед production deploy поднять `package.json` `version` по semver.
- [ ] Для визуальных/UI изменений без breaking changes использовать minor (`0.1.0` → `0.2.0`).
- [ ] Для hotfix после production использовать patch (`0.2.0` → `0.2.1`).
- [ ] В git tag использовать формат `vX.Y.Z`, например `v0.2.0`.
- [ ] В release commit включать `railway.json`, `prisma/migrations/**`, `DEPLOY.md`, `SECURITY_AUDIT.md` и кодовые изменения.

---

## Stripe

- [ ] Создать вебхук в Stripe Dashboard → Developers → Webhooks
  - URL: `https://your-domain.com/api/stripe/webhook`
  - Events: `checkout.session.completed`, `checkout.session.async_payment_failed`
- [ ] Скопировать `whsec_...` в `STRIPE_WEBHOOK_SECRET`
- [ ] Проверить тестовую оплату через Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

---

## Email (не реализовано — нужно сделать)

Сброс пароля создаёт токен в БД, но письмо **не отправляется**.
Без email-провайдера функция восстановления пароля не работает для пользователей.

- [ ] Подключить SMTP / SendGrid / Resend / Postmark
- [ ] В `app/(auth)/actions.ts` → `requestPasswordResetAction` добавить отправку письма с ссылкой `${base}/reset-password?token=${result.token}`
- [ ] Проверить что ссылка доходит и токен работает

---

## Rate Limiting (не реализовано полностью)

Текущий rate-limit хранится в памяти процесса — не работает при нескольких инстансах или serverless.

- [ ] Подключить Redis (Upstash, Redis Cloud, или self-hosted)
- [ ] Заменить in-memory `_rl` Map в `lib/auth/guard.ts` на Redis-клиент

---

## Безопасность

- [ ] `AUTH_SESSION_SECRET` установлен и не менее 32 символов (приложение падает без него в production)
- [ ] Все Stripe ключи — live (`sk_live_`, `pk_live_`), не test
- [ ] `NEXTAUTH_SECRET` или `AUTH_SESSION_SECRET` не совпадают с дефолтными dev-значениями
- [ ] S3 бакет не публичный — доступ только через подписанные URL или Nginx/CDN
- [ ] Настроить HTTPS (Let's Encrypt / Cloudflare)
- [ ] Проверить заголовки безопасности: `curl -I https://your-domain.com` → должны быть `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`

---

## Инфраструктура

- [ ] PostgreSQL: выбрать хостинг (Railway, Supabase, Neon, RDS, etc.)
- [ ] Node.js: версия 20+
- [ ] Деплой платформа: Vercel / Railway / Fly.io / self-hosted
- [ ] Настроить `DATABASE_URL` с pooler если serverless (PgBouncer / Supabase pooler)

---

## После деплоя

- [ ] Открыть `/` — сайт загружается
- [ ] Добавить товар в корзину
- [ ] Пройти чекаут с тестовой картой Stripe (`4242 4242 4242 4242`)
- [ ] Убедиться что в `/admin` заказ появился со статусом `PAID`
- [ ] Проверить регистрацию нового пользователя
- [ ] Проверить что `/admin` **недоступен** для обычного пользователя
