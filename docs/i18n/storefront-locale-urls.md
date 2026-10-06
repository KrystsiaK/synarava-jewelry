# Storefront locale URL contract

Internal storefront destinations are **locale-prefixed** in the browser (`/pt/shop`, `/ru/collections/…`, `/en/…`). CMS and Shared link fields store the **locale-free** path (`/shop`); the active locale is applied at render time.

## Helpers (`lib/i18n/routing.ts`)

| Helper | Role |
|---|---|
| `localePath(locale, path)` | Prefix a path; idempotent if the path already has a locale segment |
| `storefrontHref(locale, href)` | Same for CTA/nav hrefs; leaves `http(s):` and `mailto:` alone |
| `stripLocalePrefix(path)` / `toLocaleFreeHref(href)` | Catalog / Admin matching and CMS normalization |

Prefer these helpers over string concatenation. Nav, product cards, home hero CTA, final CTAs, related products, and CMS `ctaHref` values must go through them so PT/RU pages never drop to bare `/shop`.

## AdminHref

- Validates `/pt/shop` (and `/ru/…`) as the same destination as `/shop` when that route exists.
- Commits **locale-free** values (shared across languages).
- Optional `locale` prop: picker detail lines show the editor-locale preview.

## SEO

`buildAlternates` / page `openGraph.url` use `localePath` so canonical, hreflang, and `og:url` stay on the active locale’s URL.
