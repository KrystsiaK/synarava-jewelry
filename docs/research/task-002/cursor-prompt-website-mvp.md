# Cursor prompt — TASK-002 website-monitoring MVP

Copy everything below the line into one Cursor agent. One PR into `staging`. Do not merge.

---

## Goal
Build the minimal **Marketing Intelligence MVP** for Synarava: (1) monitor competitor websites via public sitemap + structured data, record dated observations and detect changes; (2) generate owner-approvable Reels ideas from **real Synarava products**. No social scraping, no publishing, no product writes.

## Read first
- `docs/research/task-002/README.md` (validated PoC, monitor list), `docs/research/task-002/poc.mjs` (working reference collector — port it, do not reinvent), `docs/research/task-002/social-data-stack.md` (`MarketSignal` contract).
- `docs/adr/0011-ai-draft-into-form.md`, `lib/ai/config.ts`, `lib/ai/product-content/{facts,generate,budget,validate,provider}.ts`, `app/admin/actions/ai-content.ts`, `app/admin/actions/shared.ts` (`writeAuditLog`), `lib/auth/rate-limit.ts` (`checkRateLimit`), `lib/ai/__tests__/ai-content-writes.guard.test.ts`.
- Run `graphify query` before reading code (repo rule, see AGENTS.md).

## Scope

### 1. ADR-0012 `docs/adr/0012-marketing-intelligence.md`
Decisions: exactly two new tables — `CompetitorObservation` (append-only evidence) and `ContentIdea` (editable content calendar); monitored domains live in code; providers map into `MarketSignal`; AI layer reads only `MarketSignal`; AuditLog records audit events (generate, approve, reject, edit, scan) and is **not** the storage of the calendar; no social scraping, no automatic publishing, no Product/ProductTranslation writes; TikTok competitor tracking out of scope. Update `docs/adr/README.md` index.

### 2. Prisma model + migration
```prisma
model CompetitorObservation {
  id           String   @id @default(cuid())
  domain       String
  url          String
  fetchedAt    DateTime @default(now())
  httpStatus   Int
  source       String   // "json-ld" | "og" | "shopify-js" | "sitemap"
  name         String?
  price        Decimal? @db.Decimal(10, 2)
  currency     String?
  availability String?
  contentHash  String
  kind         String   // "initial" | "changed" | "removed"
  previousId   String?
  @@index([url, fetchedAt])
  @@index([domain, fetchedAt])
}
```
```prisma
model ContentIdea {
  id          String    @id @default(cuid())
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  status      String    // "draft" | "approved" | "rejected"
  locale      String    // "en" | "pt"
  productIds  String[]
  signalIds   String[]
  hook        String
  script      String
  shotList    Json      // string[]
  caption     String
  plannedFor  DateTime? // calendar day; null = unscheduled
  @@index([status, plannedFor])
}
```
`ContentIdea` holds only valid, generated ideas (status `draft`); owner edits text/date and approves/rejects in admin. `productIds` must reference existing products at write time (validated, not FK).

Write a `CompetitorObservation` row **only** for `initial`, `changed` (hash of name|price|currency|availability differs from latest row for that URL) or `removed`. Unchanged = no row; scan totals go to one AuditLog row (`marketing.competitors.scan`).

### 3. Collector `lib/marketing/competitors/`
Port `poc.mjs` to TS, no new dependencies (`fetch`, `node:zlib`):
- `targets.ts` — fixed allowlist (owner-approved):
  small: `aurorajoalharia.com`, `magnolia-jewellery.pt`, `theboutiqueminimaliste.com`, `disejewelry.pt`, `casildafinatmc.com`, `corelunejewellery.de`, `anni-lu.com`; benchmarks: `singularu.com`, `parfois.com` (only `^/pt/pt/bijuteria/.*\.html$`, exclude `/comprar-o-look/`), `pdpaola.com`. Each target: origin, product-path regex, label, tier.
- `robots.ts` — `*` group, longest-match Allow/Disallow, `Crawl-delay`. Disallowed URL ⇒ skipped and counted.
- `sitemap.ts` — sitemap index, product sitemaps first, `.gz` support, fallback `/sitemap.xml` → `/sitemap_index.xml`.
- `extract.ts` — JSON-LD `Product`/`ProductGroup` (offers + hasVariant, min price) → `og:price:amount` → Shopify `/products/<handle>.js` (only if robots allows). Record which `source` was used.
- `collect.ts` — per scan per domain: revisit previously observed URLs + up to N new sitemap URLs (cap 20/domain/scan total), sequential per domain with `max(1500 ms, crawl-delay)`, domains in parallel, whole scan ≤ 90 s. URL missing from a successfully read sitemap, or 404/410 ⇒ `removed`.
- Honest UA `SynaravaResearchBot/1.0 (+https://shop.synarava.com)`; 20 s timeout; response size cap (e.g. 3 MB); **reject redirects/URLs outside the target's host (SSRF guard)**; https only.
- Never send page text to the LLM without `scrubPromptInjectionText`.

### 4. `lib/marketing/signals.ts`
`MarketSignal` type exactly as in `social-data-stack.md` + `fromCompetitorObservation()` and `fromManualNote()`. Nothing else (no registry, no classes).

### 5. Ideas `lib/marketing/ideas/`
- Input: 1–10 product ids (load via existing Prisma read + `buildProductContentFacts`), optional `MarketSignal` ids (website observations), optional manual notes `{url, text}` pasted by owner (Ad Library / Creative Center research). Locales `en` + `pt` (PT-PT).
- Output (JSON schema, Gemini via `getContentProvider()`): `ideas[]` with `locale, productIds[], signalIds[], hook, script, shotList[], caption, weekSlot (1–4)`; ask for ≥ 10 ideas total.
- Validation (drop invalid idea + return warning, never silently fix): every `productIds` ⊂ input; every `signalIds` ⊂ input; reuse claim-guard against the referenced products' `factsCorpus` (no invented materials/claims); no competitor brand claims unless a cited signal contains them.
- Reuse kill-switch, budget, rate limit and usage AuditLog. New audit action `ai.marketing.ideas.generate` **must count toward the monthly AI budget** (`sumMonthlyAiSpendUsd` currently filters by `AI_AUDIT_ACTION` — extend it, with a test).

### 6. Admin `/admin/marketing` (+ nav entry)
- Observations: table (brand, URL link, fetchedAt, kind, price/currency, source), filter by kind; "Scan now" server action — `requireAdminSession` + `checkRateLimit` (3/hour).
- Ideas: product multi-select, optional notes, Generate → valid ideas saved as `ContentIdea` drafts (`weekSlot` → initial `plannedFor` in the next 4 weeks). Per idea: edit hook/script/shot list/caption/`plannedFor`, Approve, Reject. Each change updates `ContentIdea` **and** writes an AuditLog event (`marketing.idea.edit|approve|reject`, before/after).
- Calendar: approved ideas grouped by week of `plannedFor`, read from `ContentIdea` (not AuditLog).
- Existing admin UI patterns/components only; no new UI libs.

## Guards (tests, extend the existing guard test pattern)
- `lib/marketing/**` + new actions: no `@/lib/shopify` import; only Prisma writes allowed: `competitorObservation.create`, `contentIdea.create|update`, `auditLog.create` (no deletes).
- No requests to `instagram.com`, `facebook.com`, `tiktok.com` hosts in `lib/marketing/**` (grep guard) and collector refuses any host not in `targets.ts`.
- Actions return `unauthorized` without admin session.

## Tests (vitest, fixtures only — no live network in CI)
robots longest-match + crawl-delay; sitemap index + `.gz`; extract JSON-LD / og / shopify-js fixtures (from `docs/research/task-002/evidence`); diff: initial → unchanged (no row) → changed → removed; off-host redirect rejected; ideas validator drops unknown productId, unknown signalId, invented claim (e.g. "925 sterling" absent from facts); budget sum includes new action; idea edit/approve/reject updates `ContentIdea` and writes exactly one AuditLog event; calendar query returns only approved ideas.

## Definition of done
- `pnpm lint && pnpm typecheck && pnpm test:run` green, CI green, PR into `staging`, **do not merge**. Do not commit `graphify-out/`.
- No new npm dependencies. No cron. No Product/ProductTranslation writes.
- PR description reports **live staging verification**: scan #1 counts per domain (initial rows, skipped by robots, failures with reason); scan #2 ≈ 0 changed rows; one Generate run with ≥ 10 valid ideas (EN + PT) from real products saved as drafts; one idea edited + approved and visible in the calendar; actual AI cost from AuditLog.
