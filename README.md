# Synarava

System rebuild of the Synarava storefront and lightweight CMS on:

- Next.js App Router
- pnpm
- Tailwind CSS v4
- Prisma + PostgreSQL
- Railway config-as-code deployment setup
- S3-compatible storage scaffold
- Stripe checkout scaffold
- RBAC-ready admin/CMS foundation
- Stitch-derived design system direction

## Local development

1. Start Postgres:

```bash
docker compose up -d
```

2. Install dependencies if needed:

```bash
pnpm install
```

3. Generate Prisma client:

```bash
pnpm prisma:generate
```

4. Push schema:

```bash
pnpm prisma:push
```

5. Run the app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Fill in local/production variables as needed:

- `DATABASE_URL`
- `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET` as a fallback)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH` (generate with `pnpm auth:hash`)
- `ADMIN_SESSION_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` if using an S3-compatible provider
- `S3_PUBLIC_URL` public bucket/CDN origin used for optimized media URLs

Storefront video is managed at `/admin/videos`: upload MP4 or WebM files there after S3 is configured. The same stored assets are used on the home page, About page, and product fit-film sections. Railway Bucket users should set `S3_USE_PROXY=true`, so private objects are served from `/media/uploads/*`.

## Railway

Production deployment is defined in `railway.json`:

- build: `pnpm build`
- pre-deploy: `pnpm prisma:deploy`
- start: `pnpm start`
- healthcheck: `/api/health`

Use `package.json` `version` as the release marker. Bump it before deploying a meaningful production release.
GitHub CI checks that this value is valid semver and that release tags match `vX.Y.Z`.

## Architecture notes

- data model and admin strategy: [docs/architecture.md](/Users/arturkrystsia/WebstormProjects/synarava-jewelry/docs/architecture.md)
- UI kit contract: [docs/ui-kit.md](/Users/arturkrystsia/WebstormProjects/synarava-jewelry/docs/ui-kit.md)

## Current implementation posture

The project now distinguishes three layers:

1. domain model
2. design system / reusable UI primitives
3. page composition

The next implementation pass should build:

1. seeded roles, permissions, and auth storage
2. admin shell and entity management screens
3. CMS-backed pages for `Home` and `Manifesto`
4. collection index, collection detail, and artifact detail pages from shared primitives
5. Stripe-backed checkout and order lifecycle
