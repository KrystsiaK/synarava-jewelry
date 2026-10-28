# Lighthouse plan — storefront performance

**Date:** 2026-10-28  
**Base:** `staging` (`0c2c0c80`)  
**This PR:** plan only. Do not merge. No storefront code change.  
**Measure only:** `https://synarava-shop-app-staging.up.railway.app/en/shop`  
**Do not request** `https://shop.synarava.com` or any other production host.

Later PRs stay on `cursor/perf-*`, one optimization each, each marked do not merge. They may change storefront presentation (`app/[locale]`, `components/{home,shop,layout,commerce,media,seo}`) and `next.config` / headers only.

No code imports this file. It is an audit note, not an API.

## What was measured

### Staging baseline (the numbers later PRs must beat)

Lighthouse 13.5.0, headless Chrome, no extensions, simulated throttling, three sequential runs, median. Not a load test.

- Mobile: Slow 4G (RTT 150 ms, throughput 1638.4 kbps, CPU 4×), viewport 412×823, DPR 1.75.
- Desktop: Lighthouse desktop preset (simulated desktop network, not Slow 4G).

Page: staging `/en/shop` only. One extra mobile run after the median was used to name chunks and font query ids. It is not in the median.

INP is not in this lab. These runs are a navigation with no tap or keypress. `max-potential-fid` is a lab proxy only.

**Mobile Slow 4G**

| Metric | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Performance score | 0.85 | 0.95 | 0.77 | 0.85 |
| FCP | 1321 ms | 1292 ms | 1981 ms | 1321 ms |
| LCP | 4007 ms | 2745 ms | 5445 ms | 4007 ms |
| Speed Index | 1866 ms | 2001 ms | 3567 ms | 2001 ms |
| TBT | 175 ms | 98 ms | 98 ms | 98 ms |
| CLS | 0.000 | 0.000 | 0 | 0 |
| TTI | 5323 ms | 4508 ms | 5445 ms | 5323 ms |

Mobile LCP moved by about 2.7 s across three cold runs. Later before/after claims use the same three-run median, and a gain smaller than that spread is not a win.

**Desktop preset**

| Metric | Run 1 | Run 2 | Run 3 | Median |
|---|---:|---:|---:|---:|
| Performance score | 0.98 | 1.00 | 1.00 | 1.00 |
| FCP | 489 ms | 438 ms | 446 ms | 446 ms |
| LCP | 1057 ms | 660 ms | 676 ms | 676 ms |
| Speed Index | 849 ms | 667 ms | 665 ms | 667 ms |
| TBT | 0 ms | 0 ms | 0 ms | 0 ms |
| CLS | 0.000 | 0.000 | 0.000 | 0 |
| TTI | 1057 ms | 660 ms | 676 ms | 676 ms |

Other staging audit results (mobile median run, unless noted):

- Root document about 140 ms. `server-response-time` passes (about 50 ms listed FCP/LCP savings).
- Render-blocking CSS: score 0, about 240–290 ms. The large sheet is ~55 KiB (`3e113c9aeab97c73.css`).
- Unused JavaScript: about 97 KiB, listed LCP savings about 350 ms on a mobile run.
- Legacy JavaScript: about 13–14 KiB in chunk `1226`.
- Fonts: 14 font responses, ~406 KiB transfer, 11 unique files. Three files downloaded twice.
- Image delivery: passing on the median runs. A later diagnostic flagged ~18 KiB on a catalog image (`.product-gallery-media`).
- `bf-cache`: score 0, three failure reasons. Response `Cache-Control` is `private, no-cache, no-store, max-age=0, must-revalidate`.
- CLS is already ~0. No third-party tag manager on this page.

### Owner-supplied production report (lead only, not the baseline)

One Lighthouse 13.5.0 JSON for `https://shop.synarava.com/en/shop`, mobile, Slow 4G, fetchTime 2026-10-28T00:58:13.476Z. DevTools on desktop Chrome, with extensions and stored IndexedDB. That run was not repeated.

| | Simulated | Observed trace |
|---|---:|---:|
| Performance | 0.70 | |
| FCP | 1928 ms | 387 ms |
| LCP | 9309 ms | 845 ms |
| Speed Index | 3333 ms | 608 ms |
| TBT | 190 ms | |
| CLS | 0 | |
| TTI | 11869 ms | |
| Accessibility / best practices / SEO | 0.96 / 0.73 / 1.00 | |

SEO canonical, hreflang, and robots already passed on that report. Do not change them.

The 9.3 s simulated LCP is not the staging baseline. The trace LCP was 845 ms, extensions polluted unused-JS and long tasks, and the staging page below does not match that document.

## Staging is not a copy of that production page

Confirmed with one anonymous read of the staging HTML, then the Lighthouse runs:

- `ShopHero` renders, and it has no `<img>`. The production LCP element was `img.shop-hero-image`. Staging cannot prove an image-LCP fix until that hero exists here. Do not upload media or edit CMS content to force it.
- GTM, gtag, Clarity, and the Meta pixel are not in the staging payload. `allowNonProductionAnalytics()` is false off production, so those ids are omitted in `app/layout.tsx`. Staging third-party traffic was two small Sentry envelope calls. Production unused-JS was dominated by extensions plus GTM/gtag. Do not turn analytics on to chase the production report.
- There is no first-party `fonts.googleapis.com` or Open Sans reference. The production chain to `fonts.googleapis.com/css?family=Open+Sans:400,600&subset=cyrillic` is not in this repo. CSP `font-src` is `'self'` plus Shopify CDNs, so the gstatic files in that report transferred 0 bytes and do not paint. Allowing them would add font bytes and change the type. That is an owner decision.
- Staging sends `X-Robots-Tag: noindex` because it is not the production deployment. Leave that header alone.

## Root causes

One row per cause. Order is gain against risk, using the staging median plus the production lead where staging cannot see the element.

| Order | Cause | Evidence | Fix | Expected gain | Risk | Size |
|---|---|---|---|---|---|---|
| 1 | Same woff2 files download twice because `deploymentId` in the CSS does not match the preload URL | Staging: 11 preloads at `dpl=0c2c0c80` (current `staging`) and a second fetch of `7b89a4fd`, `313510e2`, and `e18f83c7` at `dpl=0d6b8959` (commit of PR #327). Extra transfer ~110 KiB (38 + 35 + 39 KiB). Production lead showed the same split (`80101247` vs `60159069`) on those three files. `next.config.ts` sets `deploymentId` from `RAILWAY_GIT_COMMIT_SHA` at config load, so the id baked into CSS can differ from the id on the HTML preload. | One id, frozen at build and reused at runtime, so CSS `url()` and `<link rel=preload>` share a query string. Do not remove `deploymentId`. It is what makes a long-lived tab hard-navigate after a deploy instead of mixing Server Action ids. No `revalidateStorefront`: these are immutable files, not catalog HTML. | Drop ~110 KiB and 3 high-priority requests on every page. Helps the mobile LCP median (4.0 s) where fonts compete with first paint. | Med. A wrong id brings back the "Admin was updated" action mismatch. | S |
| 2 | Every subset of both families is preloaded on every page | `app/layout.tsx` loads Hanken Grotesk (`latin`, `latin-ext`, `cyrillic-ext`) and Cormorant Garamond (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, normal and italic) via `next/font`. `preload` defaults to true ([font docs](https://nextjs.org/docs/app/api-reference/components/font)). Staging Link header preloads all 11 woff2 files (~287 KiB before the duplicate fetch). English `/en/shop` still preloads Cyrillic. The italic serif is used on the hero word, so that file stays. | One font module. Preload only the subsets the active locale can paint above the fold. Leave the other files on `unicode-range` so they still download when those glyphs appear. Do not change family, weight, `display: "swap"`, or fallback metrics. | Largest byte cut on the critical path for `/en`. Mobile LCP/FCP. Desktop is already near the ceiling (LCP median 676 ms), so the proof is mobile. | Low if `/ru` and Irish still preload the subsets the comment names. High if a subset the first screen needs is no longer preloaded (swap flash). | M |
| 3 | One global stylesheet blocks first paint | Staging render-blocking insight: ~55 KiB CSS, 240–330 ms, listed FCP/LCP savings ~250 ms. A second sheet is ~1 KiB. Production lead: the same ~57 KiB / ~450 ms shape. Source is `app/globals.css`, shared by the storefront. | One CSS split for the storefront shell, not a per-page patch. Keep the painted result. | ~250 ms FCP/LCP on Slow 4G if the unused portion leaves the critical path. | Med. A bad split flashes unstyled content. | M |
| 4 | First-party JavaScript ships unused code in three chunks | Staging unused-JS, no extensions and no GTM: chunk `1226` 48 KiB of 131 KiB, `3629bd02` 25 KiB of 63 KiB, `4630` 24 KiB of 44 KiB. Same `1226` id as the production lead. Listed LCP savings ~350 ms on one mobile run. | One bundle pass. Map those chunks locally, then delete or stop importing the unused modules. No new dependency. If the weight is Sentry or analytics, stop (see owner decisions). | TBT is already 98 ms median. The listed win is LCP from less script on the critical path, and it has to survive the 2.7 s LCP spread. | Med. Cutting a live import breaks the page. | M |
| 5 | Legacy polyfills in chunk `1226` | Staging: ~14 KiB, `Array.prototype.at` and the usual set (`flat` / `flatMap`, `Object.fromEntries` / `hasOwn`, `trimStart` / `trimEnd`). Lighthouse lists 0 ms LCP savings. | Raise the compile target so those polyfills are not emitted. Next reads that from `browserslist` in `package.json`, which this task's file list does not include. | ~14 KiB. Small next to the font and CSS items. | Low for modern browsers. Out of the named file scope unless the owner allows `package.json`. | S |
| 6 | Catalog images can be smaller; the production LCP image is a separate, unproven path | Production lead, below the fold, not the 28 KiB hero webp: `DSC_6327` and `DSC_7212` via `/_next/image`, ~90 KiB savings, ~100 ms LCP. Staging diagnostic: ~18 KiB on `img` inside `.product-gallery-media`. Shop hero uses `preload` without `fetchPriority`. Next.js stopped forcing `fetchpriority=high` on preload because React orders high-priority images ahead of CSS ([image `preload`](https://nextjs.org/docs/app/api-reference/components/image#preload), [PR 67351](https://github.com/vercel/next.js/pull/67351)). Staging has no hero image, so that audit cannot be closed here. | One image path: `ShopHero`, `PageHeroImage`, and the catalog `Image` usage share quality and `sizes`. Do not change `object-[62%_center]` or crops. Do not add `fetchPriority="high"` until font and CSS work land and a page with the hero is measured. | Production image-delivery was ~100 ms LCP and ~90 KiB. Staging cannot show the hero number. | Med if quality changes the picture. Low if the only change is a duplicate download or a wrong `sizes`. | S |
| — | Document cache blocks back/forward cache | `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. `bf-cache` score 0. | No change in this series unless the owner accepts it. Any HTML cache must name invalidation: `revalidateStorefront()` in `lib/content/revalidate-storefront.ts`. | Repeat-view LCP. First view unchanged. | High. Stale price or stock. | — |
| — | TTFB | Staging ~140 ms, production lead ~226 ms. Both pass. | Do not chase. | ~50–150 ms listed, already inside the pass. | — | — |

CLS stays ~0. Do not change layout to fix shift.

Accessibility failures in the production report (footer wordmark contrast, shop filter names) are out of this series. A contrast change is a visual change.

## Implementation order

Each later PR: the one change, staging before/after medians with this method, and a storefront smoke on desktop and mobile. Add a perf budget that fails CI when the guarded number regresses (font request count, duplicate `dpl`, or CSS/JS bytes for that PR). No new dependency unless it removes more than it adds. No new third-party script.

1. `cursor/perf-font-deployment-id` — order 1 only.
2. `cursor/perf-font-preload` — order 2 only, after 1 is measurable.
3. `cursor/perf-css` — order 3.
4. `cursor/perf-js` — order 4, after a local chunk map. Stop if the bytes are Sentry or analytics.
5. Legacy polyfills (order 5) only if the owner allows the `browserslist` file.
6. Images (order 6) only after 1–3, and only for shared `sizes` / one loader. Hero `fetchpriority` waits until staging (or a local build) actually renders the hero.

Static font, CSS, and JS fixes do not call `revalidateStorefront`. A later cache-header change must.

## Invariants

A PR that breaks any of these is rejected:

- Canonical, hreflang, robots, sitemap, and structured data stay as they are. URLs stay as they are.
- No content or visual change except the one the PR names. Hero crop and `object-[62%_center]` stay.
- Consent banner and analytics stay unless this plan's owner section is accepted.
- Prices, cart, and checkout stay untouched. i18n keys stay untouched.
- Do not edit `lib/sync`, `lib/shopify`, `lib/products`, `lib/sku`, `prisma/**`, `app/admin/**`, checkout, payments, or CI config.

## Needs owner decision

- Any change to how the type looks: dropping a weight, swapping family, or allowing `fonts.gstatic.com` so Open Sans can paint. Removing a request that already transfers 0 bytes is only safe if we find the caller. It is not in this repo; it showed up on production with GTM loaded.
- Removing or deferring GTM, GA, Clarity, the Meta pixel, Sentry, or Shopify consent. The consent banner stays as it is.
- Image crops, `object-position`, or compression that changes the picture.
- `Cache-Control` / bf-cache / CDN TTL that could show a stale price or stock level.
- Anything in checkout or payments.
- CSP edits that allow a new third party.
- A `package.json` `browserslist` change for the 14 KiB polyfill, because that file is outside the named scope.
- How to prove the production hero-image LCP. Staging `/en/shop` has no hero image today. This series will not write catalog content to create one.

## Asks (blocked on the owner)

1. For the hero-image LCP, is a local production build an acceptable later measurement, or do we wait until staging `/en/shop` has the same hero?
2. May a later PR set `browserslist` in `package.json` for the legacy polyfills, or is that out of scope permanently?
3. Orders 1–4 are proposed for implementation without a visual or analytics change. Say if any of them should wait.
