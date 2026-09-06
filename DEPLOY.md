# Deploy Checklist — Synarava Jewelry

Список всего что нужно настроить перед деплоем в production.
Обновляй этот файл по мере того как что-то добавляется или закрывается.

---

## Environment Variables

### Обязательные (без них приложение не запустится)

| Переменная | Описание |
|-----------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ADMIN_USERNAME` | Логин для отдельного входа в `/admin/login` |
| `ADMIN_PASSWORD_HASH` | Хеш пароля админки. Генерить локально: `pnpm auth:hash` |
| `ADMIN_SESSION_SECRET` | Отдельный секрет для подписи admin-cookie. Минимум 32 случайных символа. Генерить: `openssl rand -hex 32` |

### Обязательные для коммерции

| Переменная | Описание |
|-----------|----------|
| `SHOPIFY_STORE_DOMAIN` | Постоянный домен `your-store.myshopify.com` |
| `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` | Private Storefront API token (только server-side) |
| `NEXT_PUBLIC_APP_URL` | Полный URL приложения (`https://synarava.com`). Нужен для Shopify OAuth callback |

Без этих трёх переменных корзина и чекаут падают с явной ошибкой конфигурации — Shopify единственный commerce backend, локального фолбэка нет.

### Для медиа (выбрать одно: S3 или локальное хранилище)

| Переменная | Описание |
|-----------|----------|
| `S3_REGION` | AWS регион (`eu-central-1`) |
| `S3_BUCKET` | Имя бакета |
| `S3_ACCESS_KEY_ID` | AWS access key |
| `S3_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_ENDPOINT` | Опционально — для совместимых хранилищ (Minio, R2, etc.) |
| `S3_PUBLIC_URL` | Публичный origin бакета или CDN для `next/image` (`https://cdn.example.com` или публичный S3 endpoint) |

Видео storefront загружаются только через `/admin/videos` и требуют S3. Для Railway Bucket добавьте references на `REGION`, `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `ENDPOINT`, а также `S3_FORCE_PATH_STYLE=false` и `S3_USE_PROXY=true`. Не задавайте `S3_PUBLIC_URL`: нативные Railway Buckets приватные, поэтому приложение отдаёт медиа по `/media/uploads/*` через защищённый server-side proxy.

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
- [ ] Сгенерировать `ADMIN_PASSWORD_HASH`: `pnpm auth:hash`
- [ ] Установить `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`
- [ ] Проверить что `/admin` редиректит на `/admin/login`, а после входа доступны все разделы

## Railway

Конфигурация деплоя хранится в `railway.json`, чтобы build/deploy protocol был версионирован в git:

- builder: `RAILPACK`
- build command: `pnpm build`
- pre-deploy command: `pnpm prisma:deploy`
- start command: `pnpm start`
- healthcheck: `/api/health`

Для PostgreSQL в Railway выставить `DATABASE_URL` как reference variable на Postgres service, например `${{Postgres.DATABASE_URL}}`.

Railpack должен использовать стандартную установку из `package.json` и
`pnpm-lock.yaml`. Не задавайте кастомный `RAILPACK_INSTALL_CMD`: проект не
зависит от приватных package registries и не требует npm/GitHub Packages токенов.

### Версионирование релиза

- [ ] Перед production deploy поднять `package.json` `version` по semver.
- [ ] Для визуальных/UI изменений без breaking changes использовать minor (`0.1.0` → `0.2.0`).
- [ ] Для hotfix после production использовать patch (`0.2.0` → `0.2.1`).
- [ ] В git tag использовать формат `vX.Y.Z`, например `v0.2.0`.
- [ ] Убедиться, что GitHub CI прошел `check:version`, typecheck, lint, unit tests и build.
- [ ] В release commit включать `railway.json`, `prisma/migrations/**`, `DEPLOY.md`, `SECURITY_AUDIT.md` и кодовые изменения.

---

## Shopify

- [ ] Создать вебхук в Shopify Admin → Settings → Notifications → Webhooks (или через **Reconcile** в `/admin`, которая регистрирует их автоматически при заданном `NEXT_PUBLIC_APP_URL`)
  - Events: `products/create`, `products/update`, `products/delete`, `inventory_levels/update`
- [ ] Скопировать секрет подписи вебхука в `SHOPIFY_WEBHOOK_SECRET`
- [ ] Прогнать **Reconcile** в `/admin` и убедиться, что каталог совпал по Shopify product ID/SKU/handle без конфликтов

---

## Rate Limiting

Rate-limit хранится в Postgres (`RateLimitBucket`) и переживает несколько инстансов; in-memory `Map` в `lib/auth/rate-limit.ts` — только резервный фолбэк на время недоступности БД, не основное хранилище.

- [ ] Ничего дополнительно настраивать не нужно — таблица создаётся миграцией

---

## Безопасность

- [ ] `ADMIN_SESSION_SECRET` установлен и не менее 32 символов (приложение падает без него в production)
- [ ] `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` и `SHOPIFY_ADMIN_ACCESS_TOKEN` никогда не заданы через `NEXT_PUBLIC_` переменную
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
- [ ] Дойти до `/checkout` — редиректит на хостед Shopify checkout
- [ ] Войти в `/profile` через Shopify Customer Account (magic-link/OTP)
- [ ] Проверить что `/admin` **недоступен** без `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH`
