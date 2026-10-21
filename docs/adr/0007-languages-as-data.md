# ADR-0007: Languages as data (registry-driven storefront locales)

**Date**: 2026-10-21
**Status**: accepted
**Deciders**: владелец проекта

## Context

Storefront languages today have two sources of truth: the `StorefrontLocale` database registry (`isPublished`, `isDefault`, `sortOrder`) and a hardcoded `SUPPORTED_LOCALES` list in `lib/i18n/locales.ts`. The hardcoded list still drives routing helpers, client dictionaries, layout switcher filtering, and storefront revalidation. An unpublished or unknown language URL returns `notFound()` (404). That blocks a safe lifecycle for adding, hiding, restoring, exporting, and deleting a language without code changes, and it risks 404s for URLs search engines may already have indexed.

The approved plan is [`docs/proposals/languages-as-data.md`](../proposals/languages-as-data.md). Part A is implemented in one PR as ordered milestone commits A1–A9. Simplicity and database rules from [`docs/runbooks/mission-control-hub-plan.md`](../runbooks/mission-control-hub-plan.md) §0 apply: no new dependencies, migrations generated without a database connection, no production writes from agents.

## Decision

Treat **`StorefrontLocale` as the only source of truth** for which languages exist and what state they are in.

Lifecycle: **Draft → Published → Retired → Deleted**.

- **Draft**: admin editors can prepare copy; storefront unreachable; absent from switcher/sitemap/hreflang.
- **Published**: live on the storefront; present in switcher, sitemap, and alternates.
- **Retired**: every `/{code}/…` URL returns a **permanent 301** to the equivalent path in the default language (translated slugs via `LocalizedHandleRedirect` when needed). Reversible. Data kept. Shopify locale unpublished, not disabled.
- **Deleted**: data removed only after retention, a server-side export receipt (SiteSetting key with checksum + timestamp, ≤60 minutes, matching the client-presented checksum), typed confirmation, and no unresolved sync differences. Shopify `shopLocaleDisable` only at this step (it deletes Shopify translations for that locale).

Routing, SEO, admin tabs/filters, and storefront chrome read a **cached registry snapshot** (short TTL + explicit invalidation on change). `SUPPORTED_LOCALES` ceases to be a routing allowlist. Interface strings load `messages/<code>.json` with English fallback; a generator drafts new message files without calling a translation service.

Shopify Admin API locale mutations (`shopLocaleEnable`, `shopLocaleUpdate`, `shopLocaleDisable`) require the **`write_locales`** scope (read remains `read_locales` / `read_markets_home`). Until that scope is granted on the installed app, admin language writes that need Shopify stay read-only with a clear message.

## Alternatives Considered

### Keep hardcoded `SUPPORTED_LOCALES` and add languages via code deploys

- **Why not**: every new language needs a PR, messages wiring, and redeploy; contradicts the goal of admin-driven add/hide/export/delete.

### Soft-delete only (no Retired 301 state)

- **Why not**: indexed URLs would 404; the plan requires permanent redirects for any language that was ever Published.

### Disable in Shopify when retiring (not only when deleting)

- **Why not**: `shopLocaleDisable` deletes that language’s translations in Shopify; retirement must stay reversible.

### New dependency for i18n routing or message loading

- **Why not**: forbidden by the Part A constraints and the simplicity contract; existing registry cache + message files are enough.

## Consequences

- **Positive**: one registry drives storefront, SEO, admin, and (with scope) Shopify; retired languages never 404; export/import makes delete recoverable.
- **Negative**: proxy/layout must resolve locale state from cache (not a static list); message files for new languages start as English drafts until reviewed.
- **Risks**: edge cost of registry reads — mitigated by TTL cache + invalidation; Shopify writes blocked until owner adds `write_locales` (Part B).
- **Follow-up (owner)**: Part B in the proposal (scope on staging/prod, retention defaults, throwaway rehearsal, Search Console after real retire).
