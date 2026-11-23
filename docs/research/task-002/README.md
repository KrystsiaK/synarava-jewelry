# TASK-002 — Competitor research & crawler tooling audit

**Date:** 2026-11-23 · **Status:** for owner approval · **Nothing installed or implemented.**
Evidence: `evidence/*.json` (raw PoC output, every row has `url` + `fetchedAt`), collector: `poc.mjs` (Node 22 built-ins only, 0 deps).

Synarava baseline (live JSON-LD, shop.synarava.com): gold-tone fashion jewelry, beaded/charm bracelets, necklaces, earrings, **€22.90–40.90**.

> ⚠️ Captured in Black Friday week — many observed prices may be promotional. Price ranges = min/max of a 6-product sample, not a full catalog.

## A. Small independent brands (17 verified + 5 unreachable)

"Catalog" = product URLs in the public sitemap (observed). Socials = links from the brand's own site (observed). **Followers/engagement: not collected** — no permitted logged-out method; needs Meta Business Discovery (see B). **Commercial success: unverified for all brands.**

| # | Brand | Country | Material / fit | Price sample € | Catalog | Example (URL, price) | Socials | Extraction |
|---|---|---|---|---|---|---|---|---|
| 1 | [Aurora Joalharia](https://aurorajoalharia.com) | PT | 316L steel gold-plated, PT motifs — **very close** | 20.90–60.21 | 229 | [Argolas Medalha Coração](https://aurorajoalharia.com/products/argolas-medalha-coracao-com-zirconias) 35.99 | [IG](https://www.instagram.com/aurora.joalharia) · [TT](https://www.tiktok.com/@aurora.joalharia) | JSON-LD 6/6 |
| 2 | [Magnolia Jewellery](https://www.magnolia-jewellery.pt) | PT | gold-plated, steel/silver — **very close** | 20.40–47.40 | 980 | [Corrente lisa de chapas](https://www.magnolia-jewellery.pt/products/l26978g) 38.40 | [IG](https://www.instagram.com/magnolia_jewellery_pt) | JSON-LD 6/6 |
| 3 | [Boutique Minimaliste](https://theboutiqueminimaliste.com) | PT (Lisbon) | PVD gold-plated steel, vintage-inspired — close | 28–64.60 | 688 | [Brigitte Necklace](https://theboutiqueminimaliste.com/products/brigitte-necklace) 55.20 | [IG](https://www.instagram.com/boutiqueminimaliste) · [TT](https://www.tiktok.com/@boutique_minimaliste) | JSON-LD 6/6 |
| 4 | [Disé Jewelry](https://disejewelry.pt) | PT | steel gold/silver tone — cheaper tier | 7.50–14.90 | 614 | [Escapulário](https://disejewelry.pt/products/escapulario) 9.90 | [IG](https://www.instagram.com/disejewelry.pt) · [TT](https://www.tiktok.com/@disejewelry.pt) | JSON-LD 6/6 |
| 5 | [Charme Biju](https://www.charmebiju.com.pt) | PT | steel gold-tone bracelets | — | — | — | [IG](https://www.instagram.com/charmebijuonline) · [TT](https://www.tiktok.com/@charmebijuonline) | needs `.gz` product-sitemap adapter |
| 6 | [Bohème Lisboa](https://www.bohemelisboa.com) | PT (Lisbon) | sterling + vermeil | 30–80 | 146 | [Dome ring](https://www.bohemelisboa.com/product-page/ring) 60 | [IG](https://www.instagram.com/bohemelisboa) | JSON-LD 6/6 (Wix) |
| 7 | [Marechiaro](https://marechiarojewellery.com) | PT (Lisbon) | silver + 18k plating, handmade | 50–130 | 91 | [Odeceixe Pearl Earrings](https://marechiarojewellery.com/products/odeceixe-pearl-earrings) 95 | [IG](https://www.instagram.com/marechiarojewellery) | JSON-LD 6/6 |
| 8 | [Bergue](https://berguejewelry.com) | PT (Lisbon) | recycled silver/gold, handmade | 68–248 | 324 | [mushroom](https://berguejewelry.com/pt/products/mushroom) 135 | [IG](https://www.instagram.com/berguejewelry) | Shopify `.js` 6/6 (no Product JSON-LD) |
| 9 | [Allis Jewellery](https://allisjewellery.com) | PT (Porto) | silver / gold, tile motifs | 40–145 | 115 | [Savannah Ring](https://allisjewellery.com/all-products/p/savannah-ring) 95 | [IG](https://www.instagram.com/allisjewellery) | JSON-LD 6/6 (Squarespace) |
| 10 | [Clélia Jewellery](https://cleliajewellery.com) | PT | handmade, gold-tone | 62–231 | 91 | [Ananás Brincos Longos](https://cleliajewellery.com/produto/pineaplle-brincos-longos-dourados/) 138 | [IG](https://www.instagram.com/cleliajewellery_) | JSON-LD 6/6 (WooCommerce) |
| 11 | [Paula Vieira](https://www.paulavieirajewellery.com) | PT (Lisbon) | atelier, upper tier | 77–365 | 448 | [Vulcana Long Earrings](https://www.paulavieirajewellery.com/products/vulcana-long-oxi-gold-earrings) 180 | [IG](https://www.instagram.com/paulavieirajewellery) · [TT](https://www.tiktok.com/@paulavieirajewellery) | JSON-LD 6/6 |
| 12 | [Akhsar](https://akhsar.com) | PT (Porto) | handmade silver/gold | — | — | — | not linked on site | no sitemap (404) |
| 13 | [Casilda Finat](https://casildafinatmc.com) | ES | charms, enamel — close on charms | 4.50–24.50 | 663 | [Anillo Meñique Ojos](https://casildafinatmc.com/products/anillo-menique-ojos) 18 | [IG](https://www.instagram.com/casildafinatmc) | JSON-LD 6/6 |
| 14 | [Eleonor de Casanovas](https://www.eleonordecasanovas.com) | ES | designer | — | — | — | [IG](https://www.instagram.com/eleonordecasanovas) · [TT](https://www.tiktok.com/@eleonorjewels) | WP product-sitemap found, URL pattern adapter needed |
| 15 | [Corelune](https://corelunejewellery.de) | DE | steel gold-plated, lucky-charm necklaces — **very close** | 26.95–44.95 | 1000+ | [Lucky Charm Anhängerkette](https://corelunejewellery.de/products/anhaengerkette-lucky-charm-edelstahl) 34.95 | not linked on homepage | JSON-LD 6/6 |
| 16 | [Anni-Lu](https://www.anni-lu.com) | DK | beaded bracelets — close category, mid-size | 9–110 | 467 | [Red Crush Bracelet](https://anni-lu.com/products/red-crush-bracelet) 42.50 | [IG](https://www.instagram.com/_anni_lu_) | og:price 6/6 — **currency varies by geo (DKK/EUR)** |
| 17 | [Muse of My Own](https://museofmyown.com) | EU | vermeil/diamond — upper tier | 76–139 | 540 | [Beaded Diamond Ring](https://museofmyown.com/products/beaded-stackable-diamond-ring) 139 | [IG](https://www.instagram.com/muse.of.my.own) · [TT](https://www.tiktok.com/@muse.of.my.own) | JSON-LD 6/6 |

Unreachable for an honest bot (respected, **manual only**): Vidal & Vidal (403), Balaboosté (403), Bazar33 (403), Belis / shopbelis.com and Yseult (no response).
Mid-size reference: [Apodemia](https://www.apodemia.com) (ES) €31.25–106.25 — **only brand exposing engagement on-site**: JSON-LD `aggregateRating` 130–355 reviews/product (observed).

### Recommendation — monitor list
- **Small (7):** Aurora Joalharia, Magnolia Jewellery, Boutique Minimaliste, Disé, Casilda Finat, Corelune, Anni-Lu.
- **Benchmarks (3):** Singularu, Parfois, PDPAOLA (verified earlier: €9.99–32.99 / €5.99–25.99 / €39–85).

## B. Tooling audit

Already available, no install: Node `fetch` collector (`poc.mjs`), `@playwright/test` + `jsdom` (repo devDeps), chrome-devtools MCP (ECC plugin), in-app browser. ECC `deep-research` skill references Firecrawl/Exa MCP but **neither is configured**.

| Tool | Install effort | Cost | ToS / legal | Security | Railway fit | Verdict |
|---|---|---|---|---|---|---|
| **Existing fetch collector** | 0 (port to TS) | €0 | sitemap + robots + public structured data, honest UA, 1.5 s delay | no third party sees our targets | runs inside `synarava-web` | **Use** |
| Firecrawl MCP | API key + MCP config | free tier 1,000 credits (sources disagree: monthly vs one-time), then $16–19/mo | provider handles fetching | targets + content go to a third-party processor | SaaS, fine | Not needed — no site in sample required rendering |
| Apify MCP | API token + MCP | $5/mo free credit, Actors pay-per-result | Instagram Actors scrape Meta (logged-out scraping won in *Meta v. Bright Data*, 2024, but contract/tortious claims remain a risk) | agent can discover and run paid Actors on its own — needs spend caps | SaaS | **Reject** for Instagram; unnecessary for websites |
| Crawl4AI | Python + Playwright Chromium (Docker) | €0 licence, but container needs ≥4 GB RAM (official README) | same as ours | extra service to patch | separate Railway service ≈ €10–20+/mo | **Reject** — exceeds €0–10 budget, nothing to render |
| Playwright MCP | npx | €0 | — | Microsoft: "not a security boundary"; container + bind localhost | dev tool, not prod | **Not added** — chrome-devtools MCP + in-app browser already cover manual checks |
| **Meta IG Business Discovery API** | Synarava IG Business/Creator account linked to a FB Page + Meta app; permissions `instagram_basic`, `pages_read_engagement` (+ `instagram_manage_insights` per some guides) | free | official, permitted | long-lived token in env, ~60-day refresh | plain HTTPS from `synarava-web` | **Recommend, phase 2** — only legitimate source of followers/media/likes; targets must be Business/Creator accounts |

Rate limits for Business Discovery conflict across sources (≈200 calls/h per app user vs per account) — verify on Meta docs at setup; our need is ~10 calls/week.

### Read-only comparison (real sources, 2026-11-23)
- **fetch + JSON-LD** priced 15/17 small brands + all 9 earlier competitors. Fallbacks added in PoC: `og:price` (Anni-Lu), public Shopify `/products/<handle>.js` (Bergue, robots-checked).
- **Browser (in-app, JS-rendered)** on Bergue: same €68.00 as `.js` → no gain; adds related-product prices (noise). On Malababa the sitemap URL was a 404 — a stale sitemap, not a rendering problem.
- Remaining gaps are adapter work (gz product sitemap, WP URL pattern), not tooling.
- Robots.txt observation: Lovisa's robots.txt contains an "Agent instructions" link aimed at AI agents — not followed. Competitor text must go through existing `scrubPromptInjectionFromFacts` before any LLM call.

## Costs (estimated)
Crawl: €0 (≈150 requests/week inside existing service). LLM ideas: Gemini Flash-Lite, < $0.10/month within existing `AI_MONTHLY_BUDGET_USD`. Meta API: free. **Total ≈ €0–1/month.** Research/PoC cost today: €0.

## Updated MVP scope (≈12 h, Cursor)
1. **Collector** `lib/marketing/competitors/` — port `poc.mjs` to TS: robots (longest-match), sitemap index + `.gz`, JSON-LD → og → Shopify `.js`, honest UA, per-domain delay, fixed domain allowlist in code (owner-approved list above). Fixture tests, no live network in CI.
2. **Table `CompetitorObservation` + ADR-0012** — justified by the validated workflow: change detection needs history. `kind = initial | changed | removed`, content hash of (name, price, currency, availability), `fetchedAt`, `url`, `source`. No source/brand table.
3. **Admin** `/admin/marketing` — read-only list of observations + "Scan now" (existing admin auth + rate limit).
4. **Content ideas** — ≥10 Reels ideas (hook, script, shot list, week slot), EN + PT-PT, built from real products via `buildProductContentFacts`; competitor observation ids optional, must exist if cited. Claim-guard + injection scrub reused. Ideas stored in a `ContentIdea` table (editable calendar); approve/reject/edit also logged as AuditLog events. *(Updated after owner review: AuditLog is not the calendar store.)*
5. Guards preserved: no Product/ProductTranslation writes, no social publishing, budget/kill-switch/AuditLog unchanged.
6. **Phase 2 (not MVP):** IG Business Discovery after owner sets up Meta app.

Sources: [Visão](https://visao.pt/visaose7e/comprar/2023-06-14-joalharia-de-autor-7-marcas-portuguesas-sem-genero/), [Portugal Undiscovered](https://portugal-undiscovered.com/portuguese-jewellery-brands-you-need-to-know/), [Corelune guide](https://corelunejewellery.de/en/blogs/news/schmuck-unter-50-euro-kleines-budget), [From the Labels](https://fromthelabels.com/blog/top-12-bohemian-jewelry-brands-to-know), [Mont Coeur](https://montcoeur.com/20-marcas-de-joyas-espanolas-perfectas-para-lucir-en-el-apreski/), [Tryadeli — Business Discovery](https://www.tryadeli.com/blog/instagram-business-discovery-api), [Phyllo — IG API 2026](https://www.getphyllo.com/post/instagram-api-guide), [Firecrawl pricing review](https://scrapegraphai.com/blog/firecrawl-pricing), [fastCRW Firecrawl pricing](https://fastcrw.com/blog/firecrawl-pricing-explained), [apify-mcp-server](https://github.com/apify/apify-mcp-server), [Crawl4AI Docker README](https://github.com/unclecode/crawl4ai/blob/main/deploy/docker/README.md), [Playwright MCP security](https://www.mintlify.com/microsoft/playwright-mcp/guides/security), [TechCrunch — Meta v. Bright Data](https://techcrunch.com/2024/01/24/court-rules-in-favor-of-a-web-scraper-bright-data-which-meta-had-used-and-then-sued).
