# Languages as data: add, hide, export and delete a storefront language

**Status:** Part A implementing (ADR-0007). Owner Part B (scopes, staging rehearsal) still open.
**Scope:** one task, delivered as one PR with ordered milestone commits A1–A9.

## Goal

From the admin: add a language, hide it, bring it back, export it, import it, and delete its data. The storefront, editor tabs, sitemap and Shopify follow automatically. Pages that search engines may already have indexed never turn into 404s.

## Current state (verified in code)

- Two sources of truth for languages: the database registry `StorefrontLocale` (`isPublished`, `isDefault`, `sortOrder`) and a hardcoded `SUPPORTED_LOCALES` list in `lib/i18n/locales.ts`. The list drives routing (`lib/i18n/routing.ts`), `lib/i18n/context.tsx`, `app/layout.tsx` and `lib/content/revalidate-storefront.ts`. An unknown language gives `notFound()` in `app/[locale]/layout.tsx` (404).
- Per-language rows live in: `ProductTranslation`, `CollectionTranslation`, `PageTranslation`, `ShopifyTranslationBinding`, `TranslationSyncEvent`, `TranslationCache`, plus `LocalizedHandleRedirect` (translated slugs) and translations stored in Shopify itself. (Third-state `ShopifyTranslationSnapshot` removed — ADR-0008.)
- The sitemap already emits language alternates from the registry (`app/sitemap.ts`).
- The Shopify app has `read_locales` only. Interface strings live in `messages/<code>.json` (code); a missing language falls back to English.

## Language lifecycle

`Draft` > `Published` > `Retired` > `Deleted`

| State | Storefront | Switcher, sitemap, hreflang | Editor tabs | Data | Shopify |
|---|---|---|---|---|---|
| Draft | not reachable | no | yes | kept | enabled, unpublished |
| Published | live | yes | yes | kept | published |
| Retired | every URL answers 301 to the same path in the default language (permanent) | no | hidden, "show retired" toggle | kept, can be restored | unpublished, NOT disabled |
| Deleted | 301 stays | no | no | removed after export | disabled only after export and retention |

Rules: Retired is reversible at any time. Deleted needs: language Retired for at least N days (default 30), a server-side export receipt (SiteSetting checksum + timestamp, valid 60 minutes — not client-trusted alone), the language code typed by the user, and no unresolved sync differences. Shopify `shopLocaleDisable` deletes that language's translations in Shopify, so it is used only in the Deleted step.

## Part A: implementation (agent)

**A1 Single source of truth (refactor).** The registry becomes the only source. Remove `SUPPORTED_LOCALES` from routing and the other consumers; read the registry through a cached snapshot with a short TTL and explicit invalidation when a language changes (the proxy must not query the database on every request). Keep behavior identical for en, pt, ru; prove it with tests before adding features.

**A2 Status model.** Add a language status (Draft, Published, Retired, plus timestamps `retiredAt`, `deletedAt`) to `StorefrontLocale`. Generate the migration without any database connection (diff two schema files), keep `isPublished` consistent or derive it. The only database that may be used is a local throwaway one.

**A3 Redirect layer.** Retired and Deleted languages: permanent 301 from every `/<code>/...` path to the equivalent path in the default language (fall back to the default home when no equivalent exists, including translated product and collection slugs through `LocalizedHandleRedirect`). Unknown language codes keep returning 404. Never 404 for a language that was ever Published.

**A4 SEO output.** Sitemap, hreflang alternates, `<html lang>`, canonical and structured data (`inLanguage`) include Published languages only; Draft and Retired are absent from every other language's alternates.

**A5 Export and import.** A versioned JSON bundle per language (schema version, language code, checksum) containing all translation rows of the tables above, translated slugs, and the translations fetched from Shopify for that language. Import is an idempotent upsert, validates version and checksum, and refuses a bundle for a different code. The same bundle is the backup used by "restore" and by "add language from file".

**A6 Admin.** A "Languages" section on the Translations page: list with state and counts; actions Add, Hide, Restore, Export, Import, Delete data. Destructive actions use a typed confirmation and are disabled until their guards are met. Every action writes an `AuditLog` entry. Editor tabs, filters and dropdowns read the registry, so they update without code changes. Read-only until the Shopify scope exists (clear message, no error).

**A7 Shopify.** Enable and publish a language, unpublish it (Retired), disable it only in Deleted. Use the Admin API locale mutations; check the required scope names against the Shopify documentation and report them exactly. Handle already-enabled and already-published cases idempotently.

**A8 Interface strings.** The storefront loads `messages/<code>.json` for any registered language with automatic fallback to English per missing key. A generator script writes a draft `messages/<code>.json` from the English file, marked unreviewed; the app itself never calls a translation service.

**A9 Tests and proof.** Lifecycle guards; 301 behavior per state and unknown-code 404; sitemap and hreflang per state; export and import round trip; dynamic routing with a fourth test language; registry cache invalidation; UI states in Storybook with screenshots (1440, 768, 390; light and dark).

**Constraints.** Follow the Simplicity contract and "Database rules for agents" in `docs/runbooks/mission-control-hub-plan.md`. No new dependencies. Read-only credentials only; no production writes. If the work forces a dependency or an action outside this plan, stop and ask the owner.

## Part B: owner participation

| # | When | What |
|---|---|---|
| B1 | before staging test | In the Shopify Dev Dashboard add the locale write scope the agent reports (expected: `write_locales`) to the Synarava Sync app, create a version, release it, and re-approve the installation on the **staging** store first (production later). |
| B2 | before the PR | Decide: retention days before deleting data (default 30), redirect lifetime (default permanent), fallback language (default en). |
| B3 | after the PR is on staging | Throwaway rehearsal with a test language (for example `de`): add, check editor tabs, hide, confirm 301 and sitemap, export, restore, delete data. Report each step. |
| B4 | for any real new language | Review the AI draft of `messages/<code>.json` before publishing. |
| B5 | production rollout | Fresh manual backup, merge, check the deploy log shows the migration applied by pre-deploy, smoke check en, pt and ru. Repeat B1 on the production store. |
| B6 | after retiring a real language | If Search Console is set up: resubmit the sitemap and watch coverage for 404 spikes during the following weeks. |
| B7 | docs | Verify the user-guide page "Languages" on staging (status `verified`). |

## Acceptance

- Adding, hiding, restoring, exporting, importing and deleting a test language work on staging end to end.
- en, pt, ru behave exactly as before (existing tests green plus a smoke list).
- No indexed language URL ever returns 404; retired languages return 301.
- Deleting data is impossible without an exported bundle, the retention period and the typed code.
- Admin tabs and filters update from the registry without code changes.

## Open points

- Edge cost of the dynamic registry: cached snapshot with TTL; measure.
- Shopify notification templates and checkout languages per language are outside this task; note them in the runbook.
- Advertising and feeds that point to `/<code>/...` URLs rely on the 301s.
