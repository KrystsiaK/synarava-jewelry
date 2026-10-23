# Sync unification — one compare engine for Shopify divergences

**Status:** proposal (docs only; no app code in this PR)  
**Base audited:** `origin/main` @ `36f1d1b1` (2026-10-23)  
**Related:** [ADR-0003](../adr/0003-commerce-conflict-deep-diff.md), [commerce-sync](../wiki/commerce-sync.md), [catalog-conflict-resolution-ux](../wiki/catalog-conflict-resolution-ux.md), [languages-as-data](./languages-as-data.md), skill `shopify-commerce-compare`, Mission Control [§0 Simplicity Contract](../runbooks/mission-control-hub-plan.md)

## Goal

Three Shopify “what differs?” pipelines grew in parallel: **translations reconcile**, **product catalog conflict**, and **collection conflict**. They share UX intent (field-level choose Synarava vs Shopify) but duplicate compare logic, persistence, apply stacks, and review UIs. Unify to:

1. **One compare engine** (normalize → deep-diff / three-way classify → divergence rows)
2. **One divergence table** (generalize today’s `ShopifyFieldDivergence`, do not invent a third store)
3. **Per-resource apply adapters** (write paths stay resource-specific)
4. **One inline field-level UI** (shared component; Translations page keeps languages + export/import + summary only)

Simplicity ladder (§0): reuse existing packages and tables; **no new runtime deps**; **no new Prisma table** unless the owner explicitly rejects generalizing `ShopifyFieldDivergence`. Prefer delete over abstraction-with-one-impl.

---

## 1. Current pipelines (end-to-end map)

### A. Translations reconcile

| Layer | What exists today |
| --- | --- |
| **Data sources** | Local: translation rows + `ShopifyTranslationBinding.lastSyncedSnapshot`. Remote: Shopify Translatable Resources API (`fetchResourceTranslationState`). Base: last successful sync snapshot (`ShopifyTranslationSnapshot` / binding snapshot). |
| **Tables** | `ShopifyReconcileRun` (run metadata), `ShopifyFieldDivergence` (unequal localized fields only), `ShopifyTranslationBinding`, `ShopifyTranslationSnapshot`, `TranslationSyncEvent` (write audit — separate from read-only reconcile). |
| **Compare** | Registry three-way: `compareLocalizedFields` in `lib/i18n/sync-comparison.ts` → `planReconcile` in `lib/shopify/translation-reconciliation.ts` → persisted by `runTranslationReconciliation` in `lib/shopify/reconciliation-run.ts`. |
| **Review UI** | `/admin/translations` — `TranslationsCms` full merge list (CONFLICT / LOCAL_ONLY / SHOPIFY_ONLY) + apply via `/admin/api/shopify/reconcile` + `/apply`. Also `LanguagesPanel` (lifecycle / export / import). |
| **Apply** | `applyReconcileChoice` in `lib/shopify/reconciliation-apply.ts` (claim row → write local or `registerTranslations` → resolve divergence). |
| **Nav badges** | `getLatestReconcileDifferences()` in admin layout → `countAdminNavSyncBySection` (`components/admin/shared/admin-nav-config.ts`) → Products / Collections / Pages / Settings sync badges. |
| **Product editor locale** | Not owned here; product editor consumes reconcile rows only through the **catalog conflict** signal (CONFLICT-only). |

### B. Product catalog conflict

| Layer | What exists today |
| --- | --- |
| **Data sources** | Dual windows: `Product.workingSnapshot` (OUR) + `Product.shopifySnapshot`; store map `CommerceSyncStore.ourSnapshot` / `shopifySnapshot` + `conflictReport`; presence `ShopifyCatalogPresenceSnapshot` id `"catalog"`; translations via latest `ShopifyFieldDivergence` (PRODUCT + kind CONFLICT). |
| **Compare** | ADR-0003 path: `canonicalizeShopifyProjection` + `diffShopifyProjections` (`lib/shopify/shopify-projection-diff.ts`) via `inspectProductSyncState` (`lib/shopify/product-sync.ts`) and store-level `compareCommerceStores` (`lib/commerce-store/compare.ts`). Presence: `catalog-presence*`. Unified read model: `getProductCatalogConflict` merges COMMERCE + TRANSLATION + PRESENCE (`lib/shopify/catalog-conflict.ts`). Dedupes EN commerce labels when the same field is already a translation CONFLICT. |
| **Review UI** | `CatalogConflictWorkspace` (list → field decisions → preview → apply); list chips on `/admin/products`; editor: `ProductLocaleConflictControl` (product + per-locale scope), `ProductConflictCompareBanner`, Sync tab strip. |
| **Apply** | `catalog-conflict-apply.ts` → `commerce-field-apply.ts` (scoped commerce) **or** `applyReconcileChoice` (translation) **or** `applyCatalogPresenceDifference`. Whole-product Push/Pull remain separate for unsupported commerce labels. |
| **Nav / badges** | Sidebar: translation divergences only (A). Catalog page / editor: `getCatalogConflictSignals` (commerce `syncStatus` + store field counts + CONFLICT translations + presence). Per-locale control: `filterSignalsForView` + `productConflictBadgeCount` (+ live `commerceFieldCount` from inspect). |
| **Per-locale control** | `ProductLocaleConflictControl` on product header and locale strip (`product-edit-form.tsx`); opens same workspace scoped to `product` / `productLocale` / section via `commerce-conflict-section.ts`. |

### C. Collection conflict

| Layer | What exists today |
| --- | --- |
| **Data sources** | Dual windows exist: `Collection.workingSnapshot` / `shopifySnapshot` + same `CommerceSyncStore` collection map; presence `ShopifyCatalogPresenceSnapshot` id `"collections"`; translations via `ShopifyFieldDivergence` (COLLECTION). |
| **Compare (gap)** | `diffCollectionCommerceWindows` → `diffShopifyProjections` (`collection-commerce-projection.ts:174`). Store refresh writes collection commerce into `conflictReport`. **But** `getCollectionCatalogConflict` (`collection-conflict.ts:91–109`) surfaces **translation + presence only** — no commerce origin rows. `getCollectionConflictSignals` passes `commerceProductIds: []` (no commerce field counts). UX wiki claims commerce is on the surface; code does not yet. |
| **Review UI** | `CollectionConflictWorkspace` (mirror of product dialogs); wired from collections list + collection editor. |
| **Apply** | `collection-conflict-apply.ts` → `applyReconcileChoice` or `applyCollectionPresenceDifference` (Shopify-side for Synarava-only can delete local). No scoped commerce field writer on this path yet (Push/Pull windows live in `collection-presence-server.ts`). |
| **Nav badges** | Same reconcile-difference sidebar counts for COLLECTION; list/editor use collection conflict signals. |

---

## 2. Coverage vs duplication (with file sizes)

Line counts from `origin/main` @ `36f1d1b1` (`wc -l`). Tests listed separately so production surface is clear.

### Coverage table

| Concern | Translations reconcile | Product catalog conflict | Collection conflict | Duplicated? |
| --- | --- | --- | --- | --- |
| Localized PT/RU/… copy vs Shopify | Yes (three-way + base) | Yes (reads same `ShopifyFieldDivergence`, CONFLICT only) | Yes (all kinds in workspace; same table) | **Yes** — two review UIs over one table |
| EN / shared commerce JSON | No (registry fields only) | Yes (`diffShopifyProjections`) | Windows + store compare exist; **not in conflict read model** | **Partial** — engine reused; UI/apply gap on collections |
| Presence (only-in-Shopify / only-in-Synarava) | No | Yes (`catalog` snapshot) | Yes (`collections` snapshot) | Parallel presence modules (product vs collection) |
| Persist divergences | `ShopifyFieldDivergence` + run | Commerce mostly live/`conflictReport`/`syncStatus`; translations reuse A | Same as product for translations; presence snapshot | **Split persistence models** |
| Apply | Reconcile claim/apply | Commerce scoped + reconcile + presence | Reconcile + presence | Three apply entrypoints, overlapping UX |
| Nav attention | Sidebar badges from A | Catalog/editor signals (richer) | Catalog/editor signals | Badge ≠ catalog signal (known; products already unified banner/icon) |
| Languages lifecycle / export-import | `LanguagesPanel` + `language-bundle` | — | — | Unique to Translations page |

### Core production files (lines)

| Area | File | Lines |
| --- | --- | --- |
| Translation compare | `lib/i18n/sync-comparison.ts` | 194 |
| Translation plan | `lib/shopify/translation-reconciliation.ts` | 134 |
| Reconcile run / persist | `lib/shopify/reconciliation-run.ts` | 477 |
| Reconcile apply | `lib/shopify/reconciliation-apply.ts` | 312 |
| Reconcile source / types | `reconciliation-source.ts` + `reconciliation-types.ts` + `reconciliation.ts` | 421 + 42 + 222 |
| Commerce deep-diff (ADR-0003) | `lib/shopify/shopify-projection-diff.ts` | 551 |
| Product inspect (large) | `lib/shopify/product-sync.ts` | 2185 |
| Store compare / refresh | `lib/commerce-store/compare.ts` + `refresh.ts` | 73 + 130 |
| Product conflict read/apply | `catalog-conflict.ts` + `catalog-conflict-apply.ts` + `commerce-field-apply.ts` | 290 + 344 + 434 |
| Product signals | `catalog-conflict-signals.ts` + `-server.ts` | 157 + 413 |
| Product presence | `catalog-presence.ts` + `-server.ts` | 152 + 219 |
| Collection conflict read/apply | `collection-conflict.ts` + `collection-conflict-apply.ts` | 125 + 325 |
| Collection commerce | `collection-commerce-projection.ts` | 176 |
| Collection presence | `collection-presence.ts` + `-server.ts` | 146 + 527 |
| Product conflict UI | `catalog-conflict-workspace.tsx` | 793 |
| Collection conflict UI | `collection-conflict-workspace.tsx` | 613 |
| Locale control / banner / counts | `product-locale-conflict-control.tsx` + banner + badge + summary + section | 151 + 61 + 24 + 55 + 157 |
| Translations merge UI | `translations-cms.tsx` | 530 |
| Languages panel / bundle | `languages-panel.tsx` + `language-bundle.ts` | 311 + 465 |

**Rough production surface in this map:** ~9–10k lines across compare + apply + UI (product-sync alone is 2.1k and only partly conflict-related).

### Characterization tests already locking behavior (lines)

| File | Lines |
| --- | --- |
| `lib/i18n/__tests__/sync-comparison.test.ts` | 123 |
| `lib/shopify/__tests__/shopify-projection-diff.test.ts` | 356 |
| `lib/shopify/__tests__/translation-reconciliation.test.ts` | 159 |
| `lib/shopify/__tests__/reconciliation-run.test.ts` | 254 |
| `lib/shopify/__tests__/reconciliation-apply.test.ts` | 223 |
| `lib/shopify/__tests__/catalog-conflict.test.ts` | 385 |
| `lib/shopify/__tests__/catalog-conflict-apply.test.ts` | 537 |
| `lib/shopify/__tests__/collection-conflict.test.ts` | 171 |
| `lib/shopify/__tests__/collection-conflict-apply.test.ts` | 245 |
| `lib/commerce-store/__tests__/compare.test.ts` | 79 |

First migration PRs should **extend these** (not rewrite them) so current dual-path behavior stays green while the engine consolidates.

---

## 3. Target design

```text
                    ┌─────────────────────────────┐
  Shopify fetch ──► │  Resource window builders    │  (product / collection /
  Local columns ──► │  (already mostly exist)      │   page / storefront copy)
                    └──────────────┬──────────────┘
                                   │ normalize once
                                   ▼
                    ┌─────────────────────────────┐
                    │  Sync engine                │
                    │  - deepDiff (ADR-0003) for  │
                    │    commerce-shaped JSON     │
                    │  - three-way classify for   │
                    │    registry translation     │
                    │    fields (keep semantics)  │
                    │  - presence as synthetic    │
                    │    path `_presence`         │
                    └──────────────┬──────────────┘
                                   │ upsert rows
                                   ▼
                    ┌─────────────────────────────┐
                    │  ShopifyFieldDivergence     │  ← single table
                    │  (+ ShopifyReconcileRun)    │     (generalized columns)
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     Apply adapter:         Apply adapter:        Apply adapter:
     translation            product commerce      collection / presence
     (today’s claim)        (commerce-field)      (presence-server)
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │  FieldConflictPanel (one UI) │
                    │  used by product/collection  │
                    │  editors + catalog lists     │
                    └─────────────────────────────┘
```

### 3.1 Single engine

- **Commerce / Shopify-shaped JSON:** keep `canonicalizeShopifyProjection` + `diffShopifyProjections` as the only detection path ([ADR-0003](../adr/0003-commerce-conflict-deep-diff.md)). No field allowlists for detect.
- **Translations:** keep three-way `local-only` / `shopify-only` / `conflict` semantics from `compareLocalizedFields` (base = last synced snapshot). Implement as an **adapter** that emits the same divergence row shape (path/fieldKey, fingerprints, locale, origin), not a second persisted model.
- **Presence:** one helper that emits `_presence` rows into the same table (or a typed `origin: PRESENCE` with null binding), replacing dual ad-hoc list merges in signal builders.
- One `runSyncCheck({ resourceType, resourceId?, locale? })` orchestrator replaces separate “full reconcile” vs “catalog conflict check” entrypoints for *detection*; triggers still record `ShopifyReconcileRun`.

### 3.2 Single divergence table

**Prefer evolve `ShopifyFieldDivergence`**, not a new table (Simplicity §0 budget).

Suggested additive columns / conventions (exact migration in a later PR after owner OK):

| Column / convention | Purpose |
| --- | --- |
| `origin` | `TRANSLATION` \| `COMMERCE` \| `PRESENCE` (today inferred) |
| `path` | Commerce JSON path (`variants[0].price`); null for registry keys |
| `bindingId` | Nullable for commerce/presence rows without a translation binding |
| Existing fingerprints / values / locale / rootEntity* | Unchanged contract for apply staleness |

`CommerceSyncStore.conflictReport` can remain a **cache/projection** for fast catalog badges, but the authoritative unresolved set for UI/apply should be the divergence table (same rule translations already use: latest unresolved per key, not “only latest run id”).

### 3.3 Per-resource apply adapters

Keep write capability allowlists on the **write** side only (skill already allows this):

| Adapter | Owns |
| --- | --- |
| Translation | Today’s `applyReconcileChoice` |
| Product commerce | `applyCommerceField` + whole Push/Pull for unsupported labels |
| Collection commerce | New thin writer mirroring product scoped fields (title/handle/description/seo) once conflict surface includes commerce |
| Presence | Existing product/collection presence apply |

Orchestrator: one `applyDivergenceChoice(id, direction, fingerprints)` that dispatches by `origin` — UI never branches on three HTTP shapes.

### 3.4 One inline field-level UI

Extract the shared dialog spine from `CatalogConflictWorkspace` / `CollectionConflictWorkspace` / `TranslationsCms` into one component (e.g. `FieldConflictPanel` under `components/admin/shared` → re-export `@/components/synarava-cms` if it becomes chrome):

- Locale spine + shared “Общее” marker (existing UX contract)
- Per-field Synarava | Shopify choice
- Mandatory preview before write
- Clear-non-empty confirmation

Mount points: product editor (existing locale control), collection editor, catalog list dialogs. **Not** a second full merge page on Translations.

---

## 4. What the Translations page keeps

`/admin/translations` becomes a **language operations** surface, not a second conflict workstation.

| Keep | Why |
| --- | --- |
| **Languages** (`LanguagesPanel`) | Add / hide / restore / delete lifecycle; Shopify locale sync; registry SoT ([languages-as-data](./languages-as-data.md), ADR-0007) |
| **Export / import** | Versioned language bundles (`lib/i18n/language-bundle.ts`) |
| **Diff preview before import** | **Gap today:** import upserts immediately with no preview. Add a dry-run diff (counts + sample field changes) on this page only — not via catalog conflict engine |
| **Summary only** | Aggregate sync health: last successful `ShopifyReconcileRun`, total unresolved by section, links into `/admin/products`, `/admin/collections`, `/admin/pages`, `/admin/settings` — **no** per-field merge/apply list |

| Move / delete from this page | Destination |
| --- | --- |
| `TranslationsCms` field merge + apply | Entity editors + catalog Field Decisions (`FieldConflictPanel`) |
| Deep links that dump all LOCAL_ONLY/SHOPIFY_ONLY rows for products | Product conflict signal (CONFLICT + commerce + presence only) |

Nav badges continue to reflect unresolved divergences, but opening a badge lands on the **owning section list**, not Translations merge UI.

---

## 5. Migration plan (PR-sized steps)

Each step: **tests that lock current behavior first** → implement → delete only what that step makes unreachable. No big-bang. Staging first; no production DB experiments (agent DB rules in Mission Control §0).

### PR0 — Characterization freeze (docs + tests only)

- Snapshot golden fixtures for: `compareLocalizedFields`, `diffShopifyProjections`, `getProductCatalogConflict`, `getCollectionCatalogConflict`, nav `countAdminNavSyncBySection`, product badge/banner parity.
- Document intentional asymmetries (collection commerce in store but not in conflict UI; Translations shows LOCAL_ONLY/SHOPIFY_ONLY, product catalog does not).
- **Exit:** green CI; this proposal accepted or amended by owner.

### PR1 — Shared divergence DTO + adapters (no UI change)

- Introduce a pure `SyncDivergence` type used by translation plan, commerce diff, and presence.
- Adapters: `fromTranslationDifference`, `fromShopifyProjectionDiff`, `fromPresenceDifference`.
- Wire adapters behind existing functions without changing persistence.
- **Exit:** existing tests green; no schema change.

### PR2 — Persist commerce (and later presence) into `ShopifyFieldDivergence`

- Additive Prisma migration (nullable `bindingId`, `origin`, `path`) — **only if owner approves table evolution**; otherwise stop.
- Product conflict check upserts commerce CONFLICT rows; keep `conflictReport` as derived cache.
- Apply path for commerce still uses `commerce-field-apply` via `origin`.
- **Exit:** product Field Decisions reads table first; live inspect is revalidation only.

### PR3 — Collection commerce on the conflict surface

- `getCollectionCatalogConflict` includes commerce diffs (close wiki/code gap).
- Scoped apply for collection title/handle/description/seo.
- Signals include commerce field counts for collections.
- **Exit:** collection editor parity with product shared-field spine.

### PR4 — One `FieldConflictPanel` UI

- Extract shared dialogs; product + collection workspaces become thin wrappers.
- Product locale control / banner keep calling the same panel.
- **Exit:** no behavior change; delete duplicated dialog markup.

### PR5 — Translations page slim-down

- Replace `TranslationsCms` merge UI with summary + deep links.
- Add import dry-run diff preview on Languages panel.
- Keep reconcile **run** trigger (or move “Check Shopify” to section headers only — owner choice).
- **Exit:** Translations has no apply-divergence controls.

### PR6 — Delete dead paths

Candidates once PR2–PR5 ship:

| Delete / shrink | After |
| --- | --- |
| Duplicate merge logic in `translations-cms.tsx` | PR5 |
| Parallel signal assembly that re-fetches inspect only for counts | PR2 (table authoritative) |
| Redundant EN commerce vs EN translation double-emit branches | Engine emits once |
| Collection/product workspace fork if truly identical | PR4 |
| Deprecated `Product.shopifyBaseSnapshot` (already marked) | Separate cleanup PR |

Do **not** delete `sync-comparison` three-way logic — fold it into the engine adapter. Do **not** delete `shopify-projection-diff` — it **is** the engine core.

---

## 6. Risks and open questions

### Risks

1. **Schema change on `ShopifyFieldDivergence`** — nullable `bindingId` + `origin` touches the hottest sync table; must migrate without wiping unresolved rows; follow agent DB rules (diff schemas offline; deploy via pipeline only).
2. **Semantic mismatch** — translation three-way (base-aware LOCAL_ONLY) vs commerce two-way deep-diff. Unifying storage must not silently treat LOCAL_ONLY as CONFLICT on the product banner (regression already fixed once; see internal conflict-compare foundation audit).
3. **EN double axis** — commerce window title/description vs translation locale `"en"` for the same strings. Today product conflict dedupes when both CONFLICT; a unified engine must keep one operator-visible row.
4. **Apply capability gap** — many commerce labels still “Can’t choose here”; unifying UI must not imply every row is writable.
5. **Nav badge vs catalog signal** — sidebar counts translation divergences (all kinds); catalog product signal is richer. Unification should pick one operator-facing definition.
6. **Collection commerce gap** — store already diffs collections; exposing them will surface real conflicts operators do not see today (volume unknown).
7. **Simplicity contract** — a premature `ISyncEngine` with one impl fails §0; prefer functions + adapters until a second real backend appears.

### Open questions for the owner

1. **Table evolution OK?** Generalize `ShopifyFieldDivergence` (preferred) vs keep commerce only in `CommerceSyncStore.conflictReport` and only unify UI/DTO?
2. **Translations LOCAL_ONLY / SHOPIFY_ONLY:** remain visible anywhere after slim-down, or only actionable CONFLICT + presence + commerce on entity pages (one-sided auto push/pull stays automatic)?
3. **Where does “Check Shopify” live** after Translations loses the merge UI — per-section headers only, or keep a global check on Translations summary?
4. **Import diff preview:** block import until preview confirmed, or allow force-import for empty target languages?
5. **Pages / storefront copy:** fold into the same engine in the same program of work, or stop at product + collection first?
6. **Collection commerce volume:** acceptable to turn on in the first behavior PR, or need a silent count report on staging first?

---

## 7. Explicit non-goals (this proposal)

- No new npm dependencies
- No Mission Control / wiring-engine changes
- No replacement of Shopify as commerce SoT
- No field allowlists for **detection**
- No app code in the PR that lands this document

---

## 8. References (anchors on main)

| Topic | Anchor |
| --- | --- |
| ADR deep-diff | `docs/adr/0003-commerce-conflict-deep-diff.md` |
| Dual windows wiki | `docs/wiki/commerce-sync.md` |
| UX contract | `docs/wiki/catalog-conflict-resolution-ux.md` |
| Compare engines | `lib/i18n/sync-comparison.ts:160`, `lib/shopify/shopify-projection-diff.ts:372` |
| Persist / read divergences | `lib/shopify/reconciliation-run.ts:75–106`, `339` |
| Product unified conflict | `lib/shopify/catalog-conflict.ts:215` |
| Collection conflict (no commerce yet) | `lib/shopify/collection-conflict.ts:91` |
| Nav badges | `app/admin/(admin)/layout.tsx`, `admin-nav-config.ts:82` |
| Locale control | `components/admin/products/product-locale-conflict-control.tsx:33` |
| Prisma models | `prisma/schema.prisma` — `ShopifyReconcileRun` ~804, `ShopifyFieldDivergence` ~837, `CommerceSyncStore` ~237 |
