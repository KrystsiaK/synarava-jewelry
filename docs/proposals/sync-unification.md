# Sync unification — two states only (Shopify vs Synarava)

**Status:** proposal rewrite (docs only; no app code)  
**Supersedes:** earlier “three pipelines / one engine” draft merged via #234  
**Audited:** `origin/staging` @ `b7044f13` (2026-10-23); GraphQL check via Shopify Admin schema / docs (API **2026-07**, same as `SHOPIFY_ADMIN_API_VERSION` default)  
**Related:** [ADR-0003](../adr/0003-commerce-conflict-deep-diff.md), [commerce-sync](../wiki/commerce-sync.md), [languages-as-data](./languages-as-data.md), Mission Control [§0 Simplicity Contract](../runbooks/mission-control-hub-plan.md), skill `shopify-commerce-compare`

## Owner model (hard)

Exactly **two** states per Shopify-synced resource:

| State | Role |
| --- | --- |
| **Shopify state** | Fetched automatically on admin load and after any local change. Read-only copy. Never edited in Synarava. |
| **Synarava state** | Editable. The only place operators change data. |

- **Divergence** = difference between those two.
- **No third “base” / common-ancestor state.** No per-pipeline shadow copies of the same facts.
- **Nothing writes Synarava data automatically.** Only a human action (field, translation, entity, section, or all) applies a choice in either direction.
- The system **only fetches, compares, and shows.**
- Fields Shopify cannot hold stay **local-only** (no fake Shopify state).
- **Languages:** adding a language adds a locale tab everywhere in the admin tree. Translations page = add / hide / export / import language bundle with **diff preview before import** — not a second conflict workstation.

### Waterfall on **every** sync action (hard)

Every sync action (admin load, after local Save, after webhook refresh flag, after any Apply leaf, manual Check) runs this loop — no shortcuts:

```text
1. Fetch full Shopify state
2. Read our Synarava state
3. Compare in ONE function
4. Render the whole admin tree from that SINGLE result
```

After resolving **any** single leaf (one field, one translation, one entity, one section, or all), **repeat steps 1–4**.

**One result → one selector:** nav badge, list chip, editor banner, locale tab, section chip — every counter is derived from that single compare result by **one** selector function (e.g. `selectSyncCounts(result, view)`). **No second counting path** (no parallel “reconcile differences length” vs “commerce inspect length” vs “store conflictReport”).

Simplicity (§0): no new runtime deps; prefer delete over new tables/abstractions; stop and ask the owner only when the code cannot decide.

---

## 1. Target shape (after migration)

```text
  sync action (load | save | webhook refresh | apply leaf | check)
        │
        ▼
  1. fetch full Shopify state   ──►  shopifySnapshot (+ translation copies)
  2. read Synarava state        ──►  workingSnapshot / columns / translations
  3. compare (ONE function)     ──►  SyncResult
  4. render admin tree          ──►  selectSyncCounts(SyncResult, view)
        │
        ▼
  human chooses (field | translation | entity | section | all)
        │
        ├── apply Shopify → Synarava   (only path that writes Synarava from remote)
        └── apply Synarava → Shopify   (push)
        │
        └── then waterfall 1–4 again
```

**Single module layout** (names illustrative; keep functions small):

```text
lib/sync/
  refresh-shopify-state.ts   # step 1 — fetch + persist Shopify copy only
  compare.ts                 # step 3 — THE one compare function
  select.ts                  # step 4 — one selector for every counter/view
  result.ts                  # SyncResult type (single tree SoT for UI)
  apply/
    product.ts
    collection.ts
    translation.ts
    presence.ts
  types.ts

components/admin/shared/
  field-conflict-panel.tsx   # one inline field-level UI (reads SyncResult)
```

Entity columns (`name`, `priceCents`, …) remain Synarava **projections for UI**, written only by human Save or human Apply — never by webhook refresh. Shopify-shaped Synarava window = `workingSnapshot` (or renamed `synaravaSnapshot`); Shopify window = `shopifySnapshot`.

Translations page keeps: languages lifecycle + export/import **with dry-run diff before import** + optional sync **summary** (counts from the same `selectSyncCounts`, links only). Conflict apply lives on entity/catalog UIs.

---

## 2. Violations today — every automatic Synarava write

Disposition: **delete** | **change to “only refresh Shopify state + flag”** | **keep with reason**.

### 2.1 Webhooks → pull / archive

| # | Location | What it does | Disposition |
| --- | --- | --- | --- |
| V1 | `app/api/shopify/webhooks/products/route.ts:45` | `inventory_levels/update` → `pullShopifyInventory` | **Change** — refresh Shopify inventory into Shopify state / inventory projection used for compare; **do not** write `ProductVariant.stockOnHand` (Synarava) until human Apply. Flag divergence. |
| V2 | `app/api/shopify/webhooks/products/route.ts:46–52` | `products/delete` → sets product `status: "ARCHIVED"`, `visibility: "PRIVATE"`, `syncStatus: "UNLINKED"` | **Change** — refresh Shopify state as “missing / deleted”; set conflict/presence flag only. Archive/unlink Synarava only on human Apply (“accept Shopify delete”). |
| V3 | `app/api/shopify/webhooks/products/route.ts:62` | Other product topics → `pullShopifyProduct(..., { pullTranslations: false })` | **Change** — call a new “refresh Shopify state only” path; never `savePulledProduct` column overwrite from webhooks. Flag commerce divergence. |

### 2.2 `pullShopifyProduct` / `savePulledProduct` (automatic Synarava overwrite)

| # | Location | What it does | Disposition |
| --- | --- | --- | --- |
| V4 | `lib/shopify/product-sync.ts:761–905` (`savePulledProduct`) | Upserts Synarava product columns from remote (name, slug, description, price, SEO, status, visibility, …) when not blocked by PENDING/FAILED/CONFLICT | **Change** — split into (a) refresh `shopifySnapshot` + flag, (b) human Apply = today’s overwrite. Webhooks and silent paths use (a) only. |
| V5 | `lib/shopify/product-sync.ts:374–387` (`agreedProjectionWrite`) | After pull/push agreement writes **both** `shopifySnapshot` **and** `workingSnapshot` from remote | **Change** — on refresh: write Shopify state only. Aligning Synarava window to Shopify is an Apply (or explicit “adopt all”). After human Apply-all or successful Push, setting both equal is OK **as the result of that human action**. |
| V6 | `lib/shopify/product-sync.ts:952–956` | During pull translations loop, `applyShopifyProductTypeLabel` upserts `TaxonomyValueLabel` | **Change** — store Shopify product_type translation on Shopify state / pending overlay; write taxonomy label table only on human Apply (or keep labels as local-only Synarava editorial — owner Q2). |
| V7 | `lib/shopify/product-sync.ts:985–1040` | `decideProductTranslationPull` → `APPLY_REMOTE` / `UNCHANGED` **auto-upserts** `ProductTranslation` | **Delete** auto-apply branch from non-human paths. Refresh may update a **Shopify translation copy** used for compare; writing `ProductTranslation` requires human Apply. `force: true` today (`translations.ts:118`) is “always APPLY_REMOTE” — keep only when the caller is an explicit human Pull/Apply. |
| V8 | `lib/shopify/product-sync.ts:1045+` | Pull finishes by upserting variants, tags, collections, media, etc. into Synarava | **Change** — same as V4: Synarava writes only on human Apply; webhook refresh stops at Shopify state + flags. |
| V9 | `lib/shopify/product-sync.ts:1547–1568` (`pullShopifyInventory`) | Writes `productVariant.stockOnHand` from Shopify | **Change** — see V1. |
| V10 | `lib/shopify/product-sync.ts:1265–1276` | Public `pullShopifyProduct` used by admin sync action **and** webhooks **and** presence apply | **Change** — rename/split APIs: `refreshShopifyProductState` (safe) vs `applyShopifyProductToSynarava` (human). Admin “Pull” button = human Apply. |
| V11 | `lib/shopify/catalog-presence-server.ts:162` | Presence Apply Shopify-only → `pullShopifyProduct(..., true)` | **Keep** — human Apply path (Field Decisions / presence). Must call the explicit apply API, not the webhook refresh path. |
| V12 | `app/admin/actions/sync.ts:541` | Manual admin pull → `pullShopifyProduct(..., force)` | **Keep** — human action. Same apply API as V11. |

### 2.3 Inspect / seed that mutates Synarava

| # | Location | What it does | Disposition |
| --- | --- | --- | --- |
| V13 | `lib/shopify/product-sync.ts:1350–1386` (`inspectProductSyncState`) | Fetches remote, writes `shopifySnapshot`, **seeds `workingSnapshot` from Shopify+columns when null**, may set `syncStatus` | **Change** — always refresh Shopify state; **do not** create/overwrite Synarava `workingSnapshot` on inspect. First-link seed becomes human “Adopt Shopify as Synarava” (or create entity flow). Status/flags from compare only. |
| V14 | `lib/shopify/product-sync.ts:1372–1377` | `alignMetafieldResolvedValues(working, shopify)` then persists working | **Change** — enrichment for display must not rewrite Synarava state on inspect; compute at compare/read time or store only on Shopify side. |

### 2.4 Collections

| # | Location | What it does | Disposition |
| --- | --- | --- | --- |
| V15 | `lib/shopify/collection-presence-server.ts:48–75` (`persistCollectionCommerceWindows`) | Writes **both** snapshots + Synarava columns (`name`, `slug`, description, SEO) + EN `collectionTranslation` | **Change** — refresh path: `shopifySnapshot` only. Apply path (human Pull): today’s full write. |
| V16 | `lib/shopify/collection-presence-server.ts:229–287` (`pullShopifyCollection`) | Creates/updates Synarava collection from remote; always `finish` → V15 | **Change** — same split as product pull. Presence Apply (**Keep**, human) uses apply API; no silent auto-pull. |

### 2.5 Human Save write-through (not violations)

These write **Synarava** state from the editor. They are human actions.

| Location | Note |
| --- | --- |
| `app/admin/actions/products.ts` + `writeThroughLocalCommerceToProjection` | **Keep** — Save → Synarava window. |
| `app/admin/actions/collections.ts` + `writeThroughLocalCollectionToProjection` | **Keep**. |
| `lib/sku/persist-local-sku.ts` | **Keep** — SKU assign is human. |
| `lib/shopify/commerce-field-apply.ts` / `reconciliation-apply.ts` / catalog|collection conflict apply | **Keep** — human Apply. |

---

## 3. Violations — third state (base / ancestor)

Owner model: **no third state.** Divergence is two-way only.

| # | Location | What it is | Disposition |
| --- | --- | --- | --- |
| T1 | `ShopifyTranslationBinding.lastSyncedSnapshot` (`prisma/schema.prisma:772`, reads in `translation-reconciliation.ts:125`, `reconciliation-apply.ts:78`) | Legacy single-locale common ancestor; schema says no longer written | **Delete** column after readers stop using it (fallback already deprecated). |
| T2 | `ShopifyTranslationSnapshot` (`prisma/schema.prisma:787–798`, `translation-sync.ts:40–66`) | Per-(binding, locale) “common ancestor” for three-way diff | **Delete** model and writers once compare is two-way (Synarava translation row vs live/fetched Shopify translation). Audit trail stays on `TranslationSyncEvent` if still useful. |
| T3 | Three-way compare `compareLocalizedFields(..., base, local, shopify)` (`lib/i18n/sync-comparison.ts:129–152`, `:160–194`) | Classifies LOCAL_ONLY / SHOPIFY_ONLY / CONFLICT using base | **Change** — two-way only: equal → no row; unequal → divergence (both sides shown). One-sided empty is still a divergence the human can Apply either way (or leave). Drop LOCAL_ONLY/SHOPIFY_ONLY as *auto-direction* semantics. |
| T4 | `planReconcile` (`translation-reconciliation.ts:39–67`) | Builds direction from three-way kinds | **Change** — plan becomes “list divergences”; direction only at human Apply. |
| T5 | `lib/shopify/projection-merge.ts` (full file, esp. `:29–47`, `:70+`) | Three-way B/L/R commerce merge; `shouldPersistBase` / `shopifyBaseSnapshot` | **Delete** once unused (commerce detect already uses two-window deep-diff in `shopify-projection-diff.ts`). |
| T6 | `Product.shopifyBaseSnapshot` (`prisma/schema.prisma:189`, marked `@deprecated`) | Dead third commerce snapshot | **Delete** column in a cleanup migration. |

---

## 4. Violations — duplicated copies of the same two states

| # | Location | What it is | Disposition |
| --- | --- | --- | --- |
| D1 | `CommerceSyncStore.ourSnapshot` / `shopifySnapshot` / `conflictReport` (`prisma/schema.prisma:237–243`, `lib/commerce-store/refresh.ts:28–53`) | Full-catalog duplicate of per-entity windows + cached diffs | **Change → delete store table** after badges/compare read entity windows (or a cheap derived query). Until then, treat store as **cache only**, rebuilt from entity Shopify/Synarava states — never a third SoT. Prefer delete (Simplicity). |
| D2 | Parallel pipelines: translation reconcile table vs live `inspectProductSyncState` vs collection conflict omitting commerce | Same resource, different compare UIs **and multiple counters** | **Change** — one compare (`lib/sync/compare.ts`) → one `SyncResult` → one `selectSyncCounts`; one field UI; Translations summary-only. |
| D3 | `decideProductTranslationPull` path **and** `ShopifyFieldDivergence` reconcile | Two translation conflict engines | **Delete** auto decision engine from pull; one compare + human Apply. |
| D4 | Nav badges from `getLatestReconcileDifferences` **vs** catalog chips from `getCatalogConflictSignals` **vs** banner/icon from inspect+signals | Second/third counting paths | **Delete** all but `selectSyncCounts(SyncResult, view)` (waterfall step 4). |

---

## 5. AUTO reconcile trigger

| # | Location | What it is | Disposition |
| --- | --- | --- | --- |
| A1 | `components/admin/translations/admin-shopify-sync-signal.tsx:85` + `app/admin/api/shopify/reconcile/route.ts:85–94` | Session AUTO reconcile on admin | **Keep as fetch+compare+show** (writes `ShopifyReconcileRun` / divergence **flags**, not Synarava content). Rename mentally to “auto check”, not “auto sync”. Must not call Apply. |

---

## 6. Migration plan (PR-sized)

Each PR: characterization tests for current behavior first where behavior changes; staging first; no new deps; schema via offline `migrate diff` only.

### PR1 — Stop automatic Synarava writes (highest priority)

1. Add tests locking: webhook products/update must **not** change Synarava columns when local differs; inventory webhook must **not** change `stockOnHand` under the new contract (or document interim).
2. Split `refreshShopifyProductState` vs `applyShopifyProductToSynarava`.
3. Webhook route (V1–V3): refresh Shopify state + set `syncStatus`/divergence flags only.
4. `pullShopifyInventory`: stop writing Synarava stock (V1/V9).
5. `products/delete`: flag only (V2).
6. Keep admin Pull / presence Apply on the explicit apply API (V11/V12).

**Exit:** webhooks never mutate editable Synarava commerce/translation rows.

### PR2 — Inspect / seed no longer writes Synarava

1. `inspectProductSyncState`: persist `shopifySnapshot` (+ status from compare) only (V13/V14).
2. Missing `workingSnapshot`: show “Adopt Shopify” CTA; do not silent-seed.

**Exit:** opening a product cannot create Synarava window from Shopify without a click.

### PR3 — Two-way translation compare (remove third state)

1. Compare Synarava translation ↔ Shopify translation only (T3/T4).
2. Stop writing/reading `ShopifyTranslationSnapshot` / `lastSyncedSnapshot` in reconcile (T1/T2).
3. Remove auto `APPLY_REMOTE` from pull translation loop (V7); pull translations = refresh Shopify translation copy + flag.

**Exit:** no three-way base in hot path; tests updated from LOCAL_ONLY/SHOPIFY_ONLY auto-direction to two-way divergence.

### PR4 — Collections parity

1. Same refresh vs apply split (V15/V16).
2. Surface collection commerce divergences in the same Field Conflict UI (today’s gap: windows exist, conflict read model often translation+presence only).

### PR5 — Module layout + waterfall + one UI

1. Move refresh / **one** `compare` / **one** `selectSyncCounts` / apply behind `lib/sync/*` (thin re-exports OK during move).
2. Wire admin load, post-Save, post-Apply, and Check through the waterfall; delete parallel counter builders (D4).
3. One `FieldConflictPanel`; product/collection workspaces become wrappers.
4. Translations page: languages + export/import **diff preview** + summary from the same selector; remove merge/apply list.

### PR6 — Delete dead weight

See §7. Drop `CommerceSyncStore` if badges no longer need it (D1). Drop `projection-merge` / `shopifyBaseSnapshot` / translation snapshot tables (T1/T2/T5/T6).

---

## 7. What gets deleted (end state)

| Delete | After |
| --- | --- |
| Webhook → `savePulledProduct` / inventory column write | PR1 |
| Silent `workingSnapshot` seed on inspect | PR2 |
| Auto `APPLY_REMOTE` translation upserts on pull | PR3 |
| `ShopifyTranslationSnapshot` table + `lastSyncedSnapshot` column | PR3/PR6 |
| Three-way kinds as auto-apply drivers in `sync-comparison` / `planReconcile` | PR3 |
| `lib/shopify/projection-merge.ts` + `Product.shopifyBaseSnapshot` | PR6 |
| `CommerceSyncStore` (if replaced) | PR6 |
| `TranslationsCms` field merge/apply UI | PR5 |
| Duplicate collection/product dialog implementations | PR5 |

**Keep:** ADR-0003 `canonicalize` + `diffShopifyProjections`; human Save write-through; human Apply adapters; language bundle export/import; local-only Synarava fields; `TranslationSyncEvent` / `ProductSyncEvent` as audit of **human** sync actions.

---

## 8. Languages (unchanged intent, tighter page role)

| Keep on Translations | Detail |
| --- | --- |
| Add / hide / restore / delete language | Registry + locale tabs everywhere ([languages-as-data](./languages-as-data.md)) |
| Export / import bundle | `lib/i18n/language-bundle.ts` |
| **Diff preview before import** | **Gap today:** import upserts immediately (`languages-panel.tsx` import handler). Add dry-run: counts + sample field deltas; confirm before write |
| Summary only | Unresolved divergence counts + links into Products / Collections / Pages / Settings |

Conflict field Apply does **not** live on this page.

---

## 9. Shopify Admin GraphQL (API **2026-07**) — fetch shape

Verified against the live Admin GraphQL schema (Shopify MCP `graphql_schema`) and [manage translated content](https://shopify.dev/docs/apps/build/markets/manage-translated-content) / [rate limits](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits). Store default version: `SHOPIFY_ADMIN_API_VERSION` → `2026-07` (`lib/shopify/admin.ts`).

### Can existing translations per locale ride the same paginated query?

**Yes.**

| Mechanism | What the API allows |
| --- | --- |
| `translatableResources(first:, after:, resourceType:)` | Paginated list of `TranslatableResource`. Each node exposes `translations(locale: String!)` (also `marketId`, `outdated`). Nesting `translations(locale:)` under the connection is the documented pattern ([translatableResource / TranslatableResource](https://shopify.dev/docs/api/admin-graphql/latest/objects/TranslatableResource)). Our code already does this in `fetchTranslatableResourceIndex` (`lib/shopify/translations.ts:341–346`). |
| `Product.translations(locale: String!)` / `Collection.translations(locale: String!)` | Same locale-filtered field on the commerce objects themselves (schema). A `products(first:)` / `collections(first:)` page can request commerce fields **and** `translations(locale:)` in **one** GraphQL operation. |
| Multiple locales | `translations` takes a **single required** `locale: String!` per field selection. Multiple locales in one document = GraphQL **aliases** (e.g. `tPt: translations(locale: "pt-PT")`, `tRu: translations(locale: "ru")`) or one request per locale. No multi-locale array argument on the field. |

**Implication for waterfall step 1:** “Full Shopify state” for catalog sync can include commerce + per-locale translations without a separate Bulk Operation. Prefer nesting on `products` / `collections` (and/or one `translatableResources` pass per resource type) so step 1 stays a small number of paginated Admin queries.

### Is Bulk Operation required at our size (~52 products, ~12 collections)?

**No.**

- Single GraphQL query hard cap: **1000 cost points**; pagination up to **250** nodes per page ([rate limits](https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits)).
- 52 products and 12 collections each fit in **one page** (`first: 100` is enough).
- Shopify positions bulk ops for **large** catalogs (thousands of products / avoiding max cost), not for this scale.
- At ~2–3 published non-default locales, even aliased multi-locale selections stay far under the 1000-point single-query ceiling for this catalog size.

**Use bulk only if** catalog growth or nested metafield/translation fan-out later pushes requested cost near 1000 or page counts become large — not as part of the initial unification design.

---

## 10. Simplicity Contract checklist

- [ ] No new npm dependency
- [ ] Prefer **deleting** `CommerceSyncStore` / snapshot tables over adding a fourth store
- [ ] No interface-with-one-impl for “ISyncEngine” — plain functions in `lib/sync/`
- [ ] One compare + one selector (no parallel counters)
- [ ] No Bulk Operation dependency for current catalog size
- [ ] Schema changes: offline `migrate diff` only; deploy via pipeline
- [ ] Agents stay read-only on real DBs

---

## 11. Open questions (only what code / API cannot decide)

1. **Inventory:** Should Synarava `stockOnHand` remain an editable Synarava field (human Apply from Shopify), or become a read-only mirror of Shopify with no local override?
2. **Taxonomy product_type labels** written by `applyShopifyProductTypeLabel`: Treat as Synarava local-only editorial, or as Shopify state that only lands in Synarava on Apply?
3. **First-time link / Shopify-only adopt:** Is one human confirmation (“Create Synarava from Shopify”) enough, or should Adopt always go through the same field-level Apply UI?
4. **`products/delete`:** Prefer soft-flag forever until human archives, or auto-archive after an explicit grace policy? (Code cannot invent the policy.)

GraphQL same-query / bulk questions are **answered** in §9 — not open.

Everything else in §§2–8 follows from the owner model + current call sites + Admin API.
