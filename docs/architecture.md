# Synarava Architecture

## Screen mapping from Stitch

- `SYNARAVA | Artifact Detail`
  - product detail page for a single artifact
  - consumes `Product`, `ProductVariant`, `ProductMedia`, `Collection`, `Page(manifesto links)`
- `SYNARAVA | Belarus Heritage Collection`
  - collection detail page
  - consumes `Collection`, `CollectionSection`, `ProductCollection`, `Product`
- `SYNARAVA | Collections`
  - discovery/search surface for products and collections
  - consumes `Collection`, `Product`, search metadata, filters, future search index
- `SYNARAVA | Home`
  - editorial landing / world-building page
  - backed by `Page(template=HOME)` JSON content with six independently visible, localized sections
- `SYNARAVA | The Manifesto`
  - editorial page / brand doctrine
  - should be backed by `Page(template=MANIFESTO)`

## Route plan

- `/`
  - home editorial page
- `/manifesto`
  - brand manifesto
- `/collections`
  - search/discovery index for products and collections
- `/collections/[slug]`
  - collection detail page
- `/products/[slug]`
  - artifact detail page
- `/account`
  - customer profile and orders
- `/admin`
  - CMS and commerce back-office

## Data model strategy

### Commerce

The catalog ownership and synchronization contract is defined in
[`product-data-ownership.md`](./product-data-ownership.md). Shopify owns the
commerce projection; Synarava adds mirrored metafields and a protected
editorial layer.

- `Product`
  - canonical sellable artifact
  - stores editorial copy, SEO, search summary, status, visibility
- `ProductVariant`
  - inventory-bearing variation
  - lets us support size/material/edition later without redesigning the model
- `ProductMedia`
  - ordered gallery separate from the main product record
- `Collection`
  - editorial and merchandising surface
- `ProductCollection`
  - explicit join for ordering products inside a collection

There is no local `Order`/`OrderItem` model. Cart, checkout, and order history are entirely
Shopify's — Shopify is the only commerce backend (see
[`SHOPIFY_DECISION.md`](../SHOPIFY_DECISION.md)). An earlier local cart/checkout/Stripe path and
its models were removed once Shopify covered the same ground.

### CMS

- `Page`
  - editorial pages like `Home` and `Manifesto`
  - `content: Json` keeps the first CMS light while still supporting rich composition
  - the Home page uses explicit fields for Hero, Department pathway, Featured collections,
    Material lexicon, Manifesto, and Final CTA; visibility is shared across locales while copy is localized
  - legacy Home records are resolved with compatibility defaults so adding visibility controls does not
    unexpectedly hide established sections; Department pathway remains opt-in
- `CollectionSection`
  - structured CMS blocks for collection detail pages
- `SiteSetting`
  - singleton-like global content, for example header nav, footer links, promo text, announcement settings
- `MediaAsset`
  - S3-backed asset registry shared by products, collections, pages, and users

### Auth

There is no shared `User` model and no RBAC layer — the site has exactly two, unrelated
audiences, each with its own auth mechanism:

- **Admin operators** authenticate against `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` env
  credentials, not a database row. `AdminSession` (opaque token, HMAC-verified in `proxy.ts`)
  tracks the logged-in session. Every admin action guards on `requireAdminSession()` — there is a
  single admin role, not a permission matrix, because there is a single kind of admin operator.
- **Storefront customers** authenticate via Shopify Customer Account OAuth
  (`lib/shopify/customer-account/`). Shopify owns the customer identity, session, and
  password/OTP flow entirely; this app only stores the resulting session token.

An earlier local email/password customer auth system plus an RBAC layer (`User`, `Role`,
`Permission`, `UserRole`, `RolePermission`, `UserSession`, `AuthAccount`, `VerificationToken`)
was designed but never wired to any real permission check, and was removed once Shopify Customer
Accounts made it redundant.

- `AuditLog`
  - mandatory for admin operations that mutate catalog or content; records `adminUsername` and
    `adminSessionId` — there being one admin role, "who" is enough, no permission to check.

## Admin information architecture

The implemented admin is intentionally small and task-focused:

- `Overview` — content/catalog summary and QA entry point;
- `Home` and `About` — dedicated editorial surfaces;
- `Pages` — generic editorial pages;
- `Posts` — long-form editorial stories with preview and publishing workflows;
- `Videos` — shared S3-backed storefront video assets;
- `Catalog` — products, Shopify taxonomy selection, synchronized tags, and product media;
- `Collections` — Shopify-linked grouping, merchandising, and primary storefront navigation;
- `Problems` — catalog/content consistency findings;
- `Account` — the current administrator's session and operational controls.

There are no standalone Category, Tag, Department, Order, Customer, Staff, or
Role administration surfaces. Shopify owns the matching commerce concepts;
admin authentication has one operator role. The completed restructuring and
catalog cutover are recorded in
[`history/admin-shopify-refactor-2026-09.md`](./history/admin-shopify-refactor-2026-09.md).

## Search strategy

Stage 1:

- Postgres `ILIKE` + indexed slugs/names/search summaries
- unified `/collections` page returns both products and collections

Stage 2:

- dedicated search document per product/collection
- optional Meilisearch / Typesense / Postgres full-text

## Delivery strategy

- storefront editorial pages:
  - SSG/ISR where possible
- account/admin/order screens:
  - dynamic SSR
- product and collection pages:
  - ISR with tag-based invalidation after CMS publish
