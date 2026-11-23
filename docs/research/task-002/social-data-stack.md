# TASK-002 — Social data: buy-vs-build, stack, test plan

**Date:** 2026-11-23 · **Status:** for owner approval · nothing installed, no accounts created.

## Selected data stack

| Need | Source | Buy/Build | Cost | When |
|---|---|---|---|---|
| Competitor websites (prices, new / removed products) | own fetch + JSON-LD collector (`poc.mjs` → TS) | build | €0 | **MVP now** |
| Own Instagram performance | Metricool Free (manual review) → later Meta Instagram Insights API | buy → build | €0 | test now, API later |
| 5 small competitors on Instagram | Metricool Free competitors → later Meta Business Discovery | buy → build if needed | €0 | test now |
| Ad research (content ideas) | Meta Ad Library (web UI), TikTok Creative Center (web UI) | human-assisted | €0 | now, manual notes |
| TikTok competitor tracking | **none** — no compliant, reliable source found | — | — | parked |
| AI analysis | existing Gemini provider, reads only normalized `MarketSignal`s | existing | < $0.10/mo | MVP |

No custom social scraping. No Apify/Firecrawl/Crawl4AI. No new subscriptions.

## Findings and limitations

**Metricool Free** (official help center, read 2026-11-23):
- 1 brand, **30 days** analytics history, 20 scheduled posts/month.
- **5 fixed competitors** for Facebook / Instagram / Bluesky / Twitch — *"you cannot remove or change them on Free"*. **TikTok competitors not supported.**
- Analytics viewable in-app only, watermarked, **no export** (no PDF/PPT; CSV not mentioned).
- **API only on Advanced/Custom** (from ~$53–67/month → outside budget). **Metricool MCP available on any plan, including Free** — possible human-assisted bridge for Claude, not for the Railway app.
- Not stated by Metricool: which competitor metrics are shown, whether competitor history is retained, Reels/Stories metrics on Free → **must be verified in the test**.

**Meta Instagram Business Discovery API** (third-party guides; Meta docs to confirm at setup):
- Needs Synarava IG Business/Creator account linked to a Facebook Page, a Meta app, permissions `instagram_basic`, `pages_read_engagement` (some guides add `instagram_manage_insights`). Owner-as-app-admin should work in Development mode without App Review — **to verify**.
- Returns public counts for other *professional* accounts: `followers_count`, `media_count`, recent media `like_count`, `comments_count`, `timestamp`, `permalink`. No reach/saves for competitors. Personal accounts and age-gated accounts are not returned.
- Free; Platform Rate Limits (sources conflict on exact numbers; our need ≈ 10 calls/week).

**Meta Instagram Insights API (own account)** — views, reach, saved, shares, total_interactions per media; `impressions` deprecated (replaced by `views`). Basis for later *performance feedback* (did an approved idea perform?).

**Meta Ad Library** — web UI public. API (`ads_archive`) free but needs Meta identity confirmation (days) and covers commercial ads **delivered to EU/UK in the last year** — fine for PT. Start manually.

**TikTok** — Creative Center: web research only, no official API; TikTok Terms prohibit automated extraction without written approval. Commercial Content API (DSA ad library): EU-only data, **commercial users not eligible**. → TikTok used only as manual inspiration; no competitor tracking.

## Modular boundary (provider-independent AI layer)

One normalized record; every provider maps into it; the AI layer never imports a provider.

```ts
type MarketSignal = {
  id: string;                     // provider row id, prefixed: "web:<cuid>", "manual:<cuid>"
  source: "website" | "manual" | "metricool" | "meta_business_discovery" | "meta_insights" | "ad_library";
  kind: "product_observation" | "account_snapshot" | "ad" | "own_post" | "note";
  brand: string;
  url: string;                    // verifiable public URL
  observedAt: string;             // ISO-8601, when WE observed it
  change: "initial" | "changed" | "removed" | null;
  summary: string;                // scrubbed plain text, used in prompts
  data: Record<string, string | number | boolean | null>;
};
```

MVP implements only `website` (from `CompetitorObservation`) and `manual` (owner-pasted note with URL, e.g. from Ad Library). Adding Metricool/Meta later = one mapper, zero changes to ideas generation.

## Measurable outputs

| Output | Metric | Source |
|---|---|---|
| Competitor changes | price changes / new / removed products per week, each with URL + timestamp | `CompetitorObservation` |
| Actionable ideas | ideas generated, approved, rejected per week | `ContentIdea` (calendar) + AuditLog (events) |
| Performance feedback (later) | reach / saves / shares of posts made from approved ideas vs. account median | Metricool (manual) → Insights API |

## Test plan (before any social integration is built)

Owner actions are marked 👤 — they need the owner's own accounts/consent; Claude does not create accounts or grant OAuth.

**T0 — prerequisites (👤, 15 min)**
1. Confirm Synarava Instagram is a Business or Creator account and linked to a Facebook Page.
2. **Do not add competitors yet.** Manually verify each candidate first (record date + screenshot): professional account (category label / Contact button), ≥ 4 posts or Reels in the last 30 days, product type and price tier comparable to Synarava. Candidates: `aurora.joalharia`, `magnolia_jewellery_pt`, `boutiqueminimaliste`, `disejewelry.pt`, `casildafinatmc`; reserves `bohemelisboa`, `_anni_lu_`. Lock the 5 in Metricool (**irreversible on Free**) only after the owner approves the verified list.

**T1 — Metricool Free + Metricool MCP first (👤 signup + connect IG, 20 min; Claude then tests MCP read-only)**
Order: connect own IG → test Metricool MCP on own data → verify candidates (T0.2) → lock 5 competitors → test MCP on competitor data. T2 runs **only if** Metricool + MCP fails the decision gate.
| Check | Pass criterion |
|---|---|
| Own IG metrics | followers, reach, views, saves, shares per post visible |
| Reels/Stories | Reels metrics visible on Free (yes/no) |
| History | data older than connection date? (expected ≤ 30 days) |
| Competitors | which fields shown (followers, posts, engagement), history kept after 7 days |
| Export | any CSV/PDF on Free (expected none) |
| Metricool MCP | connects on Free; returns own + competitor data readable by Claude |

**T2 — Meta Graph API Explorer — only if T1 fails (👤 creates Meta app in Development mode, 30 min; read-only calls)**
| Call | Pass criterion |
|---|---|
| `GET /{ig-user-id}?fields=business_discovery.username(<handle>){followers_count,media_count,media.limit(10){like_count,comments_count,timestamp,permalink,media_type}}` × 5 handles | ≥ 4/5 return data without App Review |
| `GET /{ig-media-id}/insights?metric=views,reach,saved,shares` on 3 own posts | metrics returned |
| Token | long-lived token obtainable; expiry noted |

**T3 — human-assisted ad research (👤 or Claude in browser, 20 min)**
Ad Library (EU, Portugal) + TikTok Creative Center for the 10 monitored brands: record ad URL, date seen, format, hook. Pass: ≥ 5 usable notes, each with a public URL.

**Decision gate (after T1–T3 + 7 days)**
- Metricool Free covers competitor + own metrics adequately → keep it manual, no build.
- Metricool lacks history/metrics or MCP is unusable → build Business Discovery + Insights mapper (≈ 4–6 h) into `MarketSignal`.
- TikTok stays parked until a compliant source exists.

Sources: [Metricool — Free vs paid](https://help.metricool.com/main-differences-between-free-and-paid-plans-bl0v9), [Metricool — plans & API](https://help.metricool.com/plans-add-ons-and-api-access-explained-xux1u), [Metricool pricing](https://metricool.com/pricing/), [Tryadeli — Business Discovery](https://www.tryadeli.com/blog/instagram-business-discovery-api), [Instagram official APIs reference (gist)](https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42), [Lilach Bullock — Meta Ad Library API](https://www.lilachbullock.com/meta-ad-library-api/), [AdPitStop — Ad Library API](https://adpitstop.com/en/guides/ad-library-api), [TikTok Commercial Content API](https://developers.tiktok.com/products/commercial-content-api), [TikTok API pricing / eligibility](https://imisofts.com/blog/tiktok-api-pricing/), [ConductAtlas — TikTok scraping clause](https://conductatlas.com/platform/tiktok/tiktok-terms-of-service/prohibition-on-scraping-and-data-extraction/).
