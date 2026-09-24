# Infrastructure audit — Postgres + Railway Bucket

**Mode:** read-only audit, then confirmed cleanup (test-mode hygiene)  
**Audit generated:** 2026-09-24T21:45:34Z  
**Cleanup executed:** 2026-09-24 (after explicit confirmation)  
**Sources:** Prisma via `lib/db.ts`, S3 via `lib/s3.ts`, site videos via `lib/site-videos.ts`.  
**Scripts:** `scripts/audit/infrastructure-audit.mjs` (read-only), `scripts/audit/infrastructure-cleanup.mjs` (dry-run / `--execute`).

## Storage policy (confirmed)

- Keep local media that is actually used (page JSON, collection hero/cover, product locals when `imageUrl` is **not** already on Shopify CDN).
- Do **not** keep bucket duplicates of product images Shopify already serves (`cdn.shopify.com`) — storage costs money.
- Shopify is not the only media source; local Synarava uploads remain valid when they are the real reference.

---

## Cleanup results (post-execute)

| Metric | Before | After |
| --- | ---: | ---: |
| `MediaAsset` | 73 | **13** |
| Bucket objects | 73 | **13** |
| Product local primary / ProductMedia | 2 products | **0** (CDN only; no local dupes) |
| Collection heroes | 6 | **6** kept |
| Page JSON-referenced assets | 7 | **7** kept |
| Legacy tables (`User`, `Cart`, …) | 14 | **0** (migration `20260924221500_drop_legacy_local_commerce`) |
| `AuditLog.actorId` / `MediaAsset.uploadedById` / `Page.authoredById` | present | **dropped** |
| Expired customer sessions deleted | — | 2 |

**Remaining bucket prefixes:** `uploads/collections/` 6 · `uploads/pages/` 7 · products/videos 0.

**Detached Shopify CDN duplicates then deleted from bucket:** `form-pearl-lariat-necklace`, `red-heart-paracord-bag-charm` (local `primaryAssetId` + `ProductMedia` removed; CDN `imageUrl` kept).

**Orphans removed:** 60 (`uploads/collections` 18 · `uploads/products` 10 · `uploads/pages` 32 unused).

---

## Original audit snapshot (pre-cleanup)

The sections below preserve the audit findings as measured **before** cleanup. Counts are historical.

**Audit S3 config (no secrets):** `region=auto`, endpoint set, `S3_PUBLIC_URL` unset, `S3_USE_PROXY` unset (treated as `false`), `forcePathStyle=true`.

**Inventory (pre-cleanup)**

| Resource | Count |
| --- | ---: |
| `MediaAsset` | 73 |
| Bucket objects | 73 |
| `Product` | 61 |
| `ProductMedia` | 2 |
| `ProductVariant` | 61 |
| `Collection` | 12 |
| `SiteSetting` rows | 1 (`shopify.store_binding` only) |
| site-videos slots set | 0 |
| Database size | ~16.7 MiB (`pg_database_size`) |

`MediaAsset.key` set ≡ bucket key set (bijection) at audit time.

---

## Severity legend

| Level | Meaning |
| --- | --- |
| high | Broken storefront media contract or integrity risk |
| medium | Architectural drift / cleanup candidates |
| low | Policy / prefix / hygiene |
| info | Observation only |

---

## Media findings (pre-cleanup)

### M1 — `MediaAsset` without primary / ProductMedia / hero / cover

| | |
| --- | --- |
| **Severity** | medium |
| **Count** | 64 / 73 |
| **By prefix** | `uploads/pages` 39 · `uploads/collections` 18 · `uploads/products` 7 |
| **JSON-referenced (kept)** | 7 |
| **No FK and no JSON** | 57 |

**Status:** cleaned — unreferenced orphans deleted; JSON-referenced pages kept.

---

### M2 / M3 / M4 — bucket ↔ DB alignment

All **info · 0** at audit time (bijection, matching bucket names). Remains aligned after cleanup (13/13).

---

### M5 — Product / variant / collection URLs

#### M5a — Product

| | |
| --- | --- |
| **Severity** | high (pre-cleanup); duplicates **resolved** |
| **Pre-cleanup** | 59 CDN-only + 2 CDN+local primary |
| **Post-cleanup** | 61 CDN `imageUrl`, 0 local product assets |

CDN-only product images are intentional when Shopify already hosts the file. Local gallery files that duplicated CDN were removed.

#### M5b — `ProductVariant.imageUrl` — info · 0

#### M5c — Collection heroes — 6 local `/media/` heroes kept (editorial, not CDN dupes)

---

### M6 — site-videos

info · 0 slots / 0 `uploads/videos/**` objects.

---

### M7 — Duplicate heuristics

M7b one same-size pair in collections — both were orphans and removed.

---

### M8 — non-READY attached to published — info · 0

---

### M9 — foreign hosts

61 Shopify CDN product URLs retained by policy (no local dupe). No local `/uploads/` leftovers.

---

### M10 — `uploads/pages/`

Canonical via `savePageImageUpload` (`lib/media/local-upload.ts`). After cleanup: **7** JSON-referenced page keys remain.

---

## Data integrity

| ID | Result |
| --- | --- |
| D1 orphan joins/translations | 0 |
| D2 sync FAILED/CONFLICT without AdminIssue | 0 |
| D3 empty/broken localized handles & redirects | 0 |
| D4 unread SiteSetting keys | 0 (only `shopify.store_binding` present) |
| D5 OPEN AdminIssue missing entity | 0 |
| D6 expired sessions | cleaned |
| D7 growth tables | `AuditLog` ~15% of small DB — retention optional |
| D8 legacy tables vs Prisma schema | **resolved** by `20260924221500_drop_legacy_local_commerce` |

---

## Postgres optimization (pre-cleanup observations)

| Metric | Value |
| --- | --- |
| DB size (then) | ~16.7 MiB |
| Cache hit | 99.99% |
| `max_connections` | 500 |
| `pg_stat_statements` | not installed |
| Migration name drift (audit) | 0 |

No urgent VACUUM.

---

## Method notes

- Bucket walk: `ListObjectsV2` only; bodies never downloaded.
- Cleanup used `DeleteObject` only for keys already classified as unreferenced / Shopify duplicates.
- Secrets and connection strings omitted from this report.
