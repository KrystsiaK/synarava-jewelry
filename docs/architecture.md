# Synarava Architecture

## Current routes

Public pages use `/en` or `/pt` prefixes. `/[locale]` is the home page;
`/[locale]/shop` loads the published catalog and runs search, filters, and sorting
in the browser; `/[locale]/collections` and `/[locale]/collections/[slug]` present
curated groups; `/[locale]/products/[slug]` contains the product gallery, variant
selector, reviews, and purchase controls. `/[locale]/profile` shows Shopify-owned
customer data and orders. `/[locale]/about`, `/[locale]/about/manifesto`, service
pages, and CMS pages provide editorial content. `/admin` is the separate CMS and
commerce console.

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
  - editorial pages like `Home`, `About`, and `Manifesto`
  - `content: Json` keeps the first CMS light while still supporting rich composition
  - the Home page uses explicit fields for Hero, Department pathway, Featured collections,
    Material lexicon, Manifesto, and Final CTA; visibility is shared across locales while copy is localized
  - the Collections index (`collections`) uses Title/Excerpt/Hero for SEO and media, plus editable
    page-header copy, an ordered collection list (same AdminOrderedList pattern as Home Featured
    collections; all published collections still render — selected IDs come first in configured
    order), and a bottom callout (eyebrow, heading, button label/href)
    independently per locale
  - Collection detail (`/collections/[slug]`) reuses the shop catalog client for products:
    server-filtered pages, infinite scroll, and Featured sort = admin collection product order
  - Material lexicon structure (specimen count, order, images) is shared; locale rows only
    overlay text fields. Resolving a locale must never replace lexicon cards with Featured
    collections or otherwise change Home section composition by language
  - Storefront language switcher exposes Shopify-published registry locales only; admin may
    edit unpublished locales (e.g. Russian) without making them public
  - legacy Home records are resolved with compatibility defaults so adding visibility controls does not
    unexpectedly hide established sections; Department pathway remains opt-in
- `CollectionSection`
  - structured CMS blocks for collection detail pages
- `SiteSetting`
  - singleton-like global content: Header main links (`header-nav-v1`: ordered
    label + path), footer link columns (`footer-links-v1`: service / legal /
    socials), footer contact emails (`footer-contact-v1`), Shared screen
    chrome/footer/contact-CTA label overrides (`storefront-copy-v1`), and site-wide SEO defaults
    (`site-seo-v1`)
  - storefront rendering filters header/footer paths that no longer resolve
    (deleted page/product/collection); admin keeps the row and surfaces an error- `MediaAsset`
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
- `Pages` — editorial CMS for all pages including Home and About;
- `Shared` — site-wide pieces: header and footer links (name + path, add/remove),
  contact emails, chrome/footer labels, and the service-page contact CTA;
- `Meta` — site-wide SEO defaults and links to page/product SEO editors;
- `Videos` — shared S3-backed storefront video assets;
- `Catalog` — products, Shopify taxonomy selection, synchronized tags, and product media;
- `Collections` — Shopify-linked grouping, merchandising, and primary storefront navigation;
- `Problems` — catalog/content consistency findings;
- `Localization` — Shopify translation sync review;
- `Account` — the current administrator's session and operational controls.

There are no standalone Category, Tag, Department, Order, Customer, Staff, or
Role administration surfaces. Shopify owns the matching commerce concepts;
admin authentication has one operator role. The completed restructuring and
catalog cutover are recorded in
[`history/admin-shopify-refactor-2026-09.md`](./history/admin-shopify-refactor-2026-09.md).

## Search and rendering

`/shop` loads the published product listing from PostgreSQL, then searches,
filters, and sorts in the browser while reflecting selections in the URL. The
server also supports filtered catalog queries for targeted views. Collection
membership and product availability come from the local Shopify projection.

The root layout reads cookies and request headers for locale, session, cart,
privacy, theme, and CSP nonce, so it renders per request. Admin and customer
account pages also render with request-specific data. CMS and Shopify mutations
revalidate affected localized storefront paths through
`lib/content/revalidate-storefront.ts`.
