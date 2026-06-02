# Synarava

System rebuild of the Synarava storefront and lightweight CMS on:

- Next.js App Router
- pnpm
- Tailwind CSS v4
- Prisma + PostgreSQL
- Railway-ready deployment setup
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

Copy values from `.env.example` into `.env.local` and fill in:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` if using an S3-compatible provider

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
