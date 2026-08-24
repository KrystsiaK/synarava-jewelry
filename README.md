# Synarava

System rebuild of the Synarava storefront and lightweight CMS on:

- Next.js App Router
- pnpm
- Tailwind CSS v4
- Prisma + PostgreSQL
- Railway config-as-code deployment setup
- S3-compatible storage scaffold
- Stripe checkout scaffold
- Optional Shopify Storefront API cart and hosted checkout
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
- `COMMERCE_BACKEND` — `local` by default; set to `shopify` only after Shopify is configured
- `SHOPIFY_STORE_DOMAIN` — the permanent `your-store.myshopify.com` domain
- `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` — private Storefront API token; server-only
- `SHOPIFY_STOREFRONT_API_VERSION` — optional, defaults to `2026-07`
- `SHOPIFY_ADMIN_ACCESS_TOKEN` — Admin API token with product, inventory, and publication scopes
- `SHOPIFY_ADMIN_API_VERSION` — optional, defaults to `2026-07`
- `SHOPIFY_PUBLICATION_ID` — optional Online Store publication GID; auto-detected by name when omitted
- `SHOPIFY_LOCATION_ID` — optional inventory location GID; the first active location is used when omitted
- `SHOPIFY_WEBHOOK_SECRET` — secret used to verify product create/update/delete webhooks
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` if using an S3-compatible provider
- `S3_PUBLIC_URL` public bucket/CDN origin used for optimized media URLs

Storefront video is managed at `/admin/videos`: upload MP4 or WebM files there after S3 is configured. The same stored assets are used on the home page, About page, and product fit-film sections. Railway Bucket users should set `S3_USE_PROXY=true`, so private objects are served from `/media/uploads/*`.

## Shopify commerce backend

The storefront can switch between the existing local/Stripe flow and Shopify without changing UI code. Shopify mode currently provides a Shopify-backed cart and redirects `/checkout` to Shopify's hosted checkout. The site's editorial CMS, authentication, and page design stay local.

1. In Shopify Admin, install/open the **Headless** sales channel and create a storefront.
2. Create a **private Storefront API token** with product and cart access.
3. Ensure every Shopify product handle matches the corresponding local product slug. Until a variant selector is added, the site chooses the first available Shopify variant.
4. Add these values locally and to Railway variables. Never expose the private token through a `NEXT_PUBLIC_` variable:

```dotenv
COMMERCE_BACKEND=local
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=shpat_...
SHOPIFY_STOREFRONT_API_VERSION=2026-07
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
SHOPIFY_ADMIN_API_VERSION=2026-07
SHOPIFY_PUBLICATION_ID=gid://shopify/Publication/...
SHOPIFY_LOCATION_ID=gid://shopify/Location/...
SHOPIFY_WEBHOOK_SECRET=...
```

### Product synchronization

With `COMMERCE_BACKEND=shopify`, the local catalog is the storefront read model. Saving a product in
the studio pushes title, handle, description, status, price, SKU, primary image, inventory, tags, and
`synarava.*` characteristic metafields through the Shopify Admin GraphQL API. Shopify
`products/create`, `products/update`, `products/delete`, and `inventory_levels/update` webhooks pull commerce changes back into
the local database. The **Reconcile** action registers those webhook subscriptions (when
`NEXT_PUBLIC_APP_URL` is set) and imports the full Shopify catalog, matching by Shopify product ID,
then SKU, then handle. Ambiguous identities are recorded as conflicts instead of being overwritten.

Run the Prisma migration before enabling the integration. The Admin API token needs
`read_products`, `write_products`, `read_inventory`, `write_inventory`, `read_publications`, and
`write_publications`; the public app URL must be
HTTPS so Shopify can deliver signed webhooks.

5. Keep `COMMERCE_BACKEND=local` while products and credentials are being prepared. After testing the matching product handles in a preview deployment, change it to `shopify` and redeploy.

To roll back, set `COMMERCE_BACKEND=local` and redeploy. Existing local checkout code remains intact during this migration phase.

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
