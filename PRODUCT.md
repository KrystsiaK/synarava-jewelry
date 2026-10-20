# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Synarava staff, founders, editors, and merchandisers use the admin area to maintain a small luxury jewelry storefront. They work in focused sessions: synchronizing and enriching products, shaping collections and editorial pages, managing shared media, and resolving content-quality issues before publication.

## Product Purpose

Synarava is an online shop of jewelry and accessories (plus related curated goods) with a lightweight CMS. The admin exists to keep catalog, collection, and editorial content accurate, publishable, and safe to edit without engineering help.

Success means customers can discover and buy a coherent, localized catalog while
the owner can maintain commerce and editorial presentation without creating a
second source of truth or depending on an engineer for routine content work.

## Positioning

Synarava combines a Shopify-owned commerce backbone with a deliberately separate
editorial layer. Shopify remains authoritative for sellability, catalog identity,
checkout, orders, and customer accounts; Synarava adds the localized storytelling,
merchandising structure, product passport, media, and storefront composition that
the brand requires. The admin makes that ownership boundary visible instead of
presenting a generic all-in-one commerce database.

## Operating Context

- The primary operator runs the store in focused admin sessions spanning catalog
  synchronization, product enrichment, collections, localized pages, shared media,
  SEO, and content-quality issues.
- English is the base commerce content. Portuguese and Russian are supported by
  the locale registry and are reviewed independently; only Shopify-published
  locales appear in the storefront language switcher.
- Shopify Admin and Translate & Adapt remain part of the workflow. Synarava Pull,
  Push, refresh, and reconciliation make ownership and conflicts explicit.
- The storefront and admin deploy as the `synarava-web` Railway service. Shopify
  hosts checkout and customer sign-in; S3-compatible storage holds shared media.
- Mission Control is a read-only operational map. It summarizes live health and
  architecture, but may only navigate, copy guidance, switch metadata views, and
  persist a local canvas layout.

## Capabilities and Constraints

- Shopify is the sole commerce backend. Synarava stores a synchronized storefront
  projection and an explicit editorial layer; it must not become a parallel order,
  customer, taxonomy, or full commerce store.
- Product administration follows **Shopify skeleton + Synarava sections**. Every
  supported Shopify field belongs to the Shopify cluster; local-only editorial
  content belongs to the Synarava cluster.
- Shared commerce fields use one normalized Shopify-shaped snapshot before save
  and compare, followed by deep diff. Concurrent edits require an explicit winner.
- Admin authentication is a single operator role backed by environment credentials
  and an HMAC-verified session. Customer identity and sessions belong to Shopify.
- Content, media, locale structure, and visibility controls must preserve saved
  work when hidden, switched, pulled, or reconciled.
- Operational and AI tooling is read-only unless a separately reviewed workflow
  explicitly authorizes a mutation. Database migrations and production writes
  remain guarded procedures, never incidental UI behavior.

## Current Product Surfaces

- The storefront presents editorial home, manifesto, collection, product, discovery, and customer-account experiences.
- Shopify owns commerce data, checkout, orders, and customer identity. Synarava owns the editorial presentation layered over synchronized catalog data.
- In admin product editing the working model is **Shopify skeleton + Synarava sections**: pull and surface every supported Shopify product field first, verify sync field by field, then add Synarava-only CMS settings in a separate tab group. The product tab strip is visually split into Shopify vs Synarava clusters.
- The admin console provides dedicated Home and About editors, generic Pages, Posts, shared Videos, Catalog, Collections, Problems, and Account surfaces.

## Home Page CMS

The Home editor controls the storefront as six explicit sections: Hero, Featured collections, Product showcase, Material lexicon, Manifesto, and Final call to action. Every section has an independent visibility control. Hiding a section removes it from the storefront without deleting its saved content.

Editors can maintain the localized English and Portuguese copy used by these sections, including labels, headings, body copy, calls to action (primary and secondary Final CTA label/href), manifesto attribution, Final CTA closing statement, and contact details. Empty optional fields fall back to the storefront defaults so an enabled section still renders. Collection- and navigation-driven imagery and cards continue to come from the corresponding catalog records.

The product showcase is a four-slot merchandising surface. Editors choose four distinct published Shopify-backed products in display order; the storefront resolves the saved local product references against the synchronized catalog and keeps product names, prices, links, and imagery sourced from that projection.

The Final CTA collage is likewise a fixed four-slot surface. Editors choose four distinct published products whose images fill the cubist shards; empty slots fall back to Featured collections imagery. Primary and secondary CTA label and destination are editable per locale (secondary falls back to the storefront “About us” default and `/about`). Closing statement is always available. Contact email is opt-in via “Include contact email”; when enabled, both the contact link label and the email address are required.

The material lexicon is an ordered list of two or three specimens (minimum two for the scroll carousel). Editors add, remove, and reorder rows in place; each row collapses to a short header (number, name, category) and expands for full copy and image. Images and row structure are shared across locales; EN/PT/RU only swap localized text for the same specimens. Featured collections never feed this section.

Visibility settings are shared across locales so the page structure stays consistent. Copy remains locale-specific. Existing page records preserve the established storefront by default: all original sections remain visible.

## Shop Discovery and Filtering

The shop landing experience follows a deliberate discovery sequence: cinematic hero, newest products, Shopify best-selling products only when a live ranking is available, exact Shopify Standard Product Taxonomy categories, then the full archive. A missing or empty Shopify ranking omits the popular section instead of substituting a locally invented popularity signal. Product cards remain direct paths to product detail pages.

Shop filters run against the catalog already loaded in the browser. Applying, removing, sorting, or searching updates the URL for shareable, back-button-safe state without reloading the route or moving the shopper away from the results they are viewing. Discovery links update the same client-side filter state, then intentionally move focus down the page to the full archive.

Shopify taxonomy categories and collections serve different purposes. A product has one exact Shopify Standard Product Taxonomy category ID, which powers the storefront category tiles and category filter. Products can belong to multiple Shopify collections, which remain merchandising groups. The local database is a synchronized storefront projection of those Shopify identities, not a parallel category system.

## Brand Commitments

Quiet, ceremonial, precise. The public brand is editorial and museum-like; the admin should translate that into a calm console rather than a decorative marketing surface.

The product name is Synarava. Existing jewelry photography, localized editorial
copy, catalog records, legal content, and the committed storefront/admin design
system are real product assets; future work must preserve their ownership and
must not fabricate product claims, reviews, rankings, or operational certainty.

## Anti-references

Avoid generic SaaS dashboards, neon terminal themes, over-decorated glassmorphism, weak low-contrast metadata, and noisy command-center language that makes ordinary content tasks feel technical.

## Evidence on Hand

- Implemented storefront, admin, customer-account, Mission Control, and API routes
  in `app/`, with component stories and automated tests alongside the code.
- Current architecture and ownership contracts in `docs/wiki/architecture.md`,
  `docs/wiki/product-data-ownership.md`, and `docs/wiki/commerce-sync.md`.
- Hard-to-reverse decisions in `docs/adr/`, including Shopify-only commerce and
  the Mission Control read-only architecture-map boundary.
- Operational runbooks and test matrices in `docs/runbooks/` and `docs/testing/`.
- Real catalog, merchandising, media, locale, and operational data exist in the
  connected systems; the repository does not provide permission to invent missing
  testimonials, performance claims, popularity rankings, or vendor-dashboard URLs.

## Product Principles

- Preserve Shopify as commerce truth; enrich it without duplicating it.
- Make ownership, publishing state, draft risk, locale scope, and conflicts visible
  before the operator changes anything.
- Keep routine solo operation calm, reversible, and possible without engineering
  help while making destructive or identity-changing work deliberately high-friction.
- Preserve curated content through hiding, localization, synchronization, and
  reconciliation rather than forcing editors to rebuild it.
- Prefer verified system data and honest unknown states over fabricated fallbacks,
  metrics, rankings, or assurances.

## Accessibility & Inclusion

Target WCAG AA contrast for admin text and controls. Support reduced motion, keyboard focus states, visible error messaging, and touch targets that remain usable on mobile and tablet.
