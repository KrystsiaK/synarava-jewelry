# Audit — Storefront performance / SEO / a11y (Phase 3)

**Date:** 2026-10-28 (Europe/Lisbon)  
**Mode:** report only (measured against staging)  
**Target:** `https://synarava-shop-app-staging.up.railway.app`  
**Tool:** Lighthouse 11.6.0 (headless Chrome), categories performance + SEO + accessibility; mobile + desktop; simulated throttling.  
**Do not merge without owner. No src changes in this PR.**

## Environment caveats (measured, not speculation)

| Signal | Value |
|--------|-------|
| `x-robots-tag` | `noindex, nofollow, noarchive` on HTML |
| `robots.txt` | `User-Agent: *` / `Disallow: /` |
| `sitemap.xml` | empty `<urlset>` |
| HTML `cache-control` | `private, no-cache, no-store, max-age=0, must-revalidate` |

Staging is intentionally non-indexable. Lighthouse **SEO scores are depressed by `is-crawlable=0`**. Treat crawl/index findings as **staging posture** unless they also appear on production.

## Scores (Lighthouse category 0–100)

| Page | Mobile P/A/S | Desktop P/A/S | Mobile LCP | Desktop LCP | CLS |
|------|--------------|---------------|------------|-------------|-----|
| `/en` home | 67 / 96 / 86 | 68 / 96 / 83 | 5.5 s | 2.9 s | 0 |
| `/en/shop` | 71 / 96 / 93 | 66 / 96 / 92 | 5.5 s | 2.9 s | ~0 |
| `/en/products/test-new-4` | 72 / 96 / 86 | 63 / 96 / 83 | **6.0 s** | **6.0 s** | 0 |
| `/en/collections` | 71 / 95 / 92 | 67 / 95 / 91 | 5.8 s | 2.9 s | ≤0.01 |
| `/en/about` | 76 / 95 / 85 | 74 / 95 / 82 | 5.2 s | 2.9 s | 0 |
| `/en/cart` | 71 / 95 / 92 | 70 / 95 / 91 | 5.3 s | 2.9 s | ≤0.014 |
| `/pt` home | 71 / 96 / 86 | 68 / 96 / 83 | 5.5 s | 2.7 s | ~0 |
| `/pt/shop` | 70 / 96 / 93 | 67 / 96 / 92 | 6.0 s | 2.9 s | ~0 |

INP: not reported by this Lighthouse preset (null). TBT / unused JS called out below.

## Verified findings

### PERF-ADV-001 — Mobile LCP ≥5 s on key routes; PDP worst

| | |
|---|---|
| **Severity** | high |
| **Evidence** | Lighthouse mobile LCP: home 5.5 s, shop 5.5 s, PDP `test-new-4` **6.0 s** (desktop PDP also 6.0 s). Audits `largest-contentful-paint` on `/tmp` LH JSON runs 2026-10-28. |
| **Proposed minimal fix** | Prioritize LCP image: `fetchpriority=high` / preload hero; ensure PDP primary media uses sized `next/image` or CDN width params; defer non-critical JS (Clarity/FB/GTM). |
| **Expected impact** | Large — LCP is the main mobile perf drag. |
| **Estimated size** | M |
| **Fix owner** | storefront |

### PERF-ADV-002 — Unused JavaScript ~100 KiB+ on home

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | Lighthouse `unused-javascript` mobile home: score 0, “Potential savings of 102 KiB”; `bootup-time` 1.3 s; `mainthread-work-breakdown` 2.2 s. |
| **Proposed minimal fix** | Code-split admin-only / analytics; load GTM/Clarity/FB after consent / `requestIdleCallback`. |
| **Expected impact** | Medium — TBT / INP headroom. |
| **Estimated size** | M |
| **Fix owner** | storefront |

### A11Y-ADV-001 — Footer wordmark contrast 1.1:1

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | Lighthouse `color-contrast` score 0. Nodes: `footer.artifact-footer … span` (“SYNARAVA”, “Jewellery & Accessories”) fg `#ebebe9` on bg `#f6f6f4`, ratio **1.1** (need ≥3:1 for large text). |
| **Proposed minimal fix** | Darken footer wordmark tokens or lighten background until ≥3:1 (large) / 4.5:1 (normal). |
| **Expected impact** | Medium a11y score / legal contrast. |
| **Estimated size** | XS–S |
| **Fix owner** | storefront |

### SEO-ADV-001 — Home missing meta description (EN + measured)

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | Lighthouse `meta-description` score 0 on `/en` and `/pt` home. Shop/cart/collections pass SEO category higher (92–93). |
| **Proposed minimal fix** | Wire site SEO description (admin Site SEO) into home `<meta name="description">` for each locale. |
| **Expected impact** | SERP snippet quality (prod). |
| **Estimated size** | S |
| **Fix owner** | storefront / admin SEO |

### SEO-ADV-002 — PT home `<title>` / og:title still English

| | |
|---|---|
| **Severity** | medium |
| **Evidence** | `curl` 2026-10-28: `/pt` title = `Jewellery & Accessories for Everyday Wear | Synarava` (same as `/en`). Canonical correctly `/pt`. |
| **Proposed minimal fix** | Localize home title/description in CMS / site SEO for `pt`. |
| **Expected impact** | Locale SEO honesty. |
| **Estimated size** | S (content) or S (wiring if field missing) |
| **Fix owner** | storefront / content |

### SEO-ADV-003 — Staging robots/sitemap block indexing (ops note)

| | |
|---|---|
| **Severity** | low (staging) / critical if copied to prod |
| **Evidence** | `robots.txt` Disallow `/`; empty sitemap; `x-robots-tag: noindex`. |
| **Proposed minimal fix** | Confirm production env does **not** inherit this; document staging-only flags in release runbook. |
| **Expected impact** | Prevent accidental prod noindex. |
| **Estimated size** | XS (docs/ops verify) |
| **Fix owner** | infra |

## Passing / healthy signals

- Accessibility category **95–96** across pages (aside from contrast).
- Valid `rel=canonical` and `hreflang` (Lighthouse score 1) on sampled pages.
- Product page emits multiple `application/ld+json` blocks (6 matches on PDP HTML).
- CLS ≈ 0 on most routes.
- Security headers present (CSP with nonce, HSTS, `X-Frame-Options: DENY`).

## Ranked fix list (severity × blast / size)

1. **PERF-ADV-001** LCP (esp. PDP) — highest user-visible win.  
2. **A11Y-ADV-001** footer contrast — XS CSS.  
3. **SEO-ADV-001** home meta description.  
4. **SEO-ADV-002** PT title localization.  
5. **PERF-ADV-002** unused JS / third parties.  
6. **SEO-ADV-003** verify prod robots/sitemap ≠ staging.

## Hypotheses

| Id | Claim |
|----|-------|
| PERF-ADV-H1 | Desktop PDP LCP 6 s may be unoptimized hero dimensions / Shopify CDN without width params — needs element screenshot follow-up. |
| PERF-ADV-H2 | INP unknown here; field data (CrUX) needed for real INP. |

## Repro

```bash
npx lighthouse@11.6.0 "https://synarava-shop-app-staging.up.railway.app/en" \
  --only-categories=performance,seo,accessibility \
  --form-factor=mobile --chrome-flags="--headless --no-sandbox"
```
