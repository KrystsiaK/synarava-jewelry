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
  - should be backed by `Page(template=HOME)` plus reusable curated content blocks
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
- `Order`, `OrderItem`
  - immutable checkout snapshot for Stripe-driven orders

### CMS

- `Page`
  - editorial pages like `Home` and `Manifesto`
  - `content: Json` keeps the first CMS light while still supporting rich composition
- `CollectionSection`
  - structured CMS blocks for collection detail pages
- `SiteSetting`
  - singleton-like global content, for example header nav, footer links, promo text, announcement settings
- `MediaAsset`
  - S3-backed asset registry shared by products, collections, pages, and users

### Auth and RBAC

- `User`
  - shared identity model for customers and staff
- `Role`, `Permission`, `UserRole`, `RolePermission`
  - explicit RBAC layer for admin features
- `AuthAccount`, `UserSession`, `VerificationToken`
  - future-proof auth storage for credentials + providers + password reset/email verification
- `AuditLog`
  - mandatory for admin operations that mutate catalog, content, or roles

## Permission model

Seed these permissions as first-class keys:

- `catalog.read`
- `catalog.write`
- `collections.read`
- `collections.write`
- `pages.read`
- `pages.write`
- `assets.read`
- `assets.write`
- `orders.read`
- `orders.write`
- `users.read`
- `users.write`
- `roles.read`
- `roles.write`
- `settings.read`
- `settings.write`
- `audit.read`

Seed these roles:

- `super_admin`
  - full access
- `editor`
  - pages, collections, assets
- `merchandiser`
  - catalog, collections, assets
- `support`
  - orders, customers, read-only catalog
- `customer`
  - storefront only, no admin access

## Admin information architecture

The admin should be intentionally small and task-focused:

- `Dashboard`
  - recent orders, draft content, publish queue
- `Catalog`
  - products
  - variants
  - collections
- `Content`
  - home
  - manifesto
  - generic pages
- `Media`
  - S3-backed asset library
- `Orders`
  - payment and fulfillment review
- `People`
  - customers
  - staff users
  - roles
- `Settings`
  - navigation
  - footer
  - promo bar

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
