# Infrastructure audit — Postgres + Railway Bucket

**Mode:** read-only (no deletes, updates, or repairs)  
**Generated:** 2026-09-24T21:45:34Z  
**Sources:** Prisma via `lib/db.ts` (`DATABASE_PUBLIC_URL` → `DATABASE_URL`), S3 via `lib/s3.ts` (`ListObjectsV2` only; `HeadObject` not required — key sets matched), site videos via `lib/site-videos.ts`.  
**Repro script:** `scripts/audit/infrastructure-audit.mjs` (does not mutate).

**Audit S3 config (no secrets):** `region=auto`, endpoint set, `S3_PUBLIC_URL` unset, `S3_USE_PROXY` unset (treated as `false`), `forcePathStyle=true`. Stored collection URLs use `/media/...`, so production writes historically assumed proxy mode (`getS3PublicUrl` → `/media/<key>` when `S3_USE_PROXY=true`). Comparisons below use that canonical form where noted.

**Inventory**

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

`MediaAsset.key` set ≡ bucket key set (bijection). No missing objects, no stray bucket keys outside `MediaAsset` (videos unused).

---

## Severity legend

| Level | Meaning |
| --- | --- |
| high | Broken storefront media contract or integrity risk |
| medium | Architectural drift / cleanup candidates |
| low | Policy / prefix / hygiene |
| info | Observation only |

**Cleanup is a separate step** and requires explicit confirmation + dry-run. This document only recommends.

---

## Media findings

### M1 — `MediaAsset` without primary / ProductMedia / hero / cover

| | |
| --- | --- |
| **Severity** | medium |
| **Count** | 64 / 73 |
| **By prefix** | `uploads/pages` 39 · `uploads/collections` 18 · `uploads/products` 7 |
| **Also in Page/Section JSON** | 7 (mostly `uploads/pages/`) — not deletable as pure orphans |
| **No FK and no JSON key** | 57 |

**Examples (≤20)**

| id | key |
| --- | --- |
| `cms6lunlr002pmr0y8qf4eccd` | `uploads/collections/gemini-generated-image-z9i60lz9i60lz9i6-ac42a4e1-962c-4f5e-967b-74e7a35964b0.webp` |
| `cms6n3c4k002qqm0yoqiy7xqn` | `uploads/products/2345-1f3ae130-8bbe-45b6-ad5f-b5db8a2a35fe.webp` |
| `cms6n3cf5002sqm0ymk1hqioy` | `uploads/products/2434-92e560a2-3e25-40d0-a484-acc3ec3a2b94.webp` |
| `cms6n3cl9002uqm0ybhlhn5b1` | `uploads/products/2026-07-07-15-11-36-b7e6401a-b895-4998-8953-ccdb5bf8ea25.webp` |
| `cms91dkz4000mlg0ybjdx438f` | `uploads/products/axis-pearl-shop-6ce550a0-19bb-487a-b974-92e99ba13684.webp` |
| `cms92ihto002plg0yz5jvljz7` | `uploads/products/br-pearl-axis-demonstr-6b09d013-ada3-4602-8538-9a19d43b3b3e.webp` |
| `cms94koho00a8lg0y4ljvouxk` | `uploads/collections/essence-col-cb3081a3-9e0b-4ae2-81c1-7ad82eecb4f5.webp` |
| `cms95ssge00d9lg0yjtuv9v9f` | `uploads/collections/3d918f7f-3dd5-478c-bc9f-02f0fa07a052-e1c542d2-9cb8-4a40-81dd-7e957242d0d5.webp` |
| `cms97ov0t00ellg0y841p55k1` | `uploads/products/9089c578-d6ec-4e43-9f41-07b3cc1715ea-a4218006-617f-4b5f-9788-fbad80060a97.webp` |
| `cms97uv4q00fulg0ywbpl58j1` | `uploads/products/90585de9-72ff-4f0f-adb6-ec2aadcc22dd-dcdee4ba-f73e-4567-988f-3f9cf38eec29.webp` |
| `cmtoh6xhx003jmz0n08jaevfv` | `uploads/collections/dsc-5856-synarava-primary-v1-b30bdb49-572f-4e77-9a41-52ff37803b61.webp` |
| `cmtx6hbdf0004pl0n1hu1w1r8` | `uploads/collections/dsc-5911-a67f47c2-feec-4d1b-8160-fb2575c04b0d.webp` |
| `cmtx6j6zc0007pl0nh1ikzut7` | `uploads/collections/dsc-5916-b17f1f50-145b-4892-b024-23264c24df46.webp` |
| `cmtx6ykp70009pl0ng5zvot2z` | `uploads/collections/dsc-6451-83e22410-1daf-495d-8aaa-95202f7d2fed.webp` |
| `cmtx7d3t6000bpl0no8gd89om` | `uploads/collections/untitled-1-e3662b62-3473-4fb8-954f-e5cd19046dbe.webp` |
| `cmtx7f9d3000dpl0n2sczrqgi` | `uploads/collections/dsc-6332-eee7a28a-97e2-4b67-89fb-4b59ef66d2b7.webp` |
| `cmtx7kpcw000fpl0njdav3gxz` | `uploads/collections/untitled-2-476e07b0-ac1b-4f45-862a-493a4977b28a.webp` |
| `cmtx7o2hl000hpl0n93idajl9` | `uploads/collections/dsc-6332-c29e42f4-4c3a-4949-8423-0bba89f38401.webp` |
| `cmtx7w31k000jpl0nbrypbmrf` | `uploads/collections/dsc-6062-fbe09a8c-ea7a-42dd-8ec4-e6f959f0f434.webp` |
| `cmtx7wymr000lpl0nxi55u41b` | `uploads/collections/dsc-6058-bc6d6dd3-1be9-4613-b856-cff3028a4692.webp` |

**Recommended action:** Split review by prefix. `uploads/pages/**` is written by `savePageImageUpload` (`lib/media/local-upload.ts`) and may only appear in `Page.content` JSON — keep if content still references. Product/collection orphans are candidates for dry-run delete of `MediaAsset` + bucket object after confirming no JSON refs. Models: `MediaAsset`, `Product.primaryAssetId`, `ProductMedia.assetId`, `Collection.heroAssetId` / `coverAssetId`.

---

### M2 — Bucket object with no `MediaAsset.key` and not in site-videos

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

**Recommended action:** None. Bucket and `MediaAsset` are aligned.

---

### M3 — `MediaAsset.key` missing from bucket

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

**Recommended action:** None.

---

### M4 — `MediaAsset.bucket` ≠ current `S3_BUCKET` or null

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

All 73 rows match the configured bucket.

---

### M5 — `Product.imageUrl` / variant / collection URL vs asset

#### M5a — Product

| | |
| --- | --- |
| **Severity** | high |
| **Count** | 61 issues (all products) |

Breakdown (proxy-aware `getS3PublicUrl` with `/media/<key>`):

| Kind | Count |
| --- | ---: |
| `imageUrl` present, `primaryAssetId` null (Shopify CDN) | 59 |
| …of which `ACTIVE`+`PUBLIC` | 47 |
| `primaryAssetId` set but `imageUrl` still Shopify CDN (≠ `/media/<key>`) | 2 |
| `imageUrl` matches `/media/<key>` | 0 |

Host for all foreign URLs: `cdn.shopify.com`.

**Examples — URL without asset (≤10)**

| productId | slug | status / visibility |
| --- | --- | --- |
| `cmu05udyv0246nx0n6kumhdf7` | `crystal-pearl-bracelet-12-mm` | ACTIVE / PUBLIC |
| `cmu35pgww000xnr0nzmddqxb2` | `crystal-pearl-necklace-6-mm` | ACTIVE / PUBLIC |
| `cmu0b3e6l02cznx0nhnie4en6` | `aa-freshwater-rice-pearl-necklace-5-4-5-mm` | ACTIVE / PUBLIC |
| `cms94uyza00ablg0ydh0apqv0` | `essence-pearl-necklace` | DRAFT / PRIVATE |
| `cmt7ptwc70005ob0m8akffy8m` | `heritage-hybrid` | DRAFT / PRIVATE |
| `cms93qzhl0067lg0y4acza12c` | `axis-red-bracelet` | DRAFT / PRIVATE |
| `cms97s4rw00fslg0yvgf6hf65` | `form-black-onyx-lariat-necklace` | DRAFT / PRIVATE |
| `cms98l2lt00i9lg0y3t8anbls` | `form-matte-onyx-lariat-necklace` | DRAFT / PRIVATE |
| `cms93wsjf0077lg0ys2ksrizx` | `axis-turquoise-necklace` | DRAFT / PRIVATE |
| `cms67evth002opb0yendf800x` | `axis-pearl-necklace` | DRAFT / PRIVATE |

**Examples — primary set, imageUrl still CDN**

| productId | slug | `MediaAsset.key` |
| --- | --- | --- |
| `cms95y0ph00dclg0ykgd3sidd` | `form-pearl-lariat-necklace` | `uploads/products/63a8b56c-e75d-4fe4-8f3d-4bb2d77c053d-d6fc9d85-78a4-4e9c-93ad-f1c4ac8fbfbf.webp` |
| `cmtyaim4h005gpl0nge6lygjv` | `red-heart-paracord-bag-charm` | `uploads/products/dsc-6261-6891335b-9fa9-407e-b7f3-cbc8d042554b.webp` |

**Recommended action:** Decide catalog media source of truth. Current admin path (`app/admin/actions/products.ts`) sets `imageUrl = getS3PublicUrl(asset.key)` when attaching media; Shopify sync leaves CDN URLs. Either (a) project Shopify images into `MediaAsset` + rewrite `imageUrl`, or (b) document CDN URLs as intentional Shopify projection and stop treating M5a as a defect for unlinked products. For the 2 linked products, set `imageUrl` to `getS3PublicUrl(primaryAsset.key)` (`lib/s3.ts`) after confirming `S3_USE_PROXY` in deploy. Models: `Product.imageUrl`, `Product.primaryAssetId`, `MediaAsset`.

#### M5b — `ProductVariant.imageUrl`

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

All variant `imageUrl` values are null.

#### M5c — `Collection.heroImageUrl` / `heroAssetId`

| | |
| --- | --- |
| **Severity** | info (after proxy-aware check) |
| **Count** | 0 mismatches |

6 collections have `heroAssetId`; all `heroImageUrl` equal `/media/<key>`. `coverAssetId` unused (0). Initial script flagged mismatches only because the audit process lacked `S3_USE_PROXY=true`.

**Linked collections:** `pearls`, `bag-accessories`, `jewellery` (ACTIVE/PUBLIC); `form`, `axis`, `hair-accessories` (DRAFT/PRIVATE).

---

### M6 — site-videos

| | |
| --- | --- |
| **M6a** | info · 0 — no `SiteSetting` key `site-videos` |
| **M6b** | info · 0 — no `uploads/videos/**` objects |

**Recommended action:** None until videos are uploaded via `app/admin/api/videos/route.ts`. Expected keys: `uploads/videos/<slot>/` for `homeBeads`, `homeModel`, `braceletFilm`, `materialsFilm` (`lib/site-videos.ts`).

---

### M7 — Duplicate heuristics (`MediaAsset.key` remains `@unique`)

| | |
| --- | --- |
| **M7a** filename+sizeBytes | info · 0 |
| **M7b** same sizeBytes in folder | info · 1 group |

**Example**

| folder · sizeBytes | ids | keys |
| --- | --- | --- |
| `uploads/collections` · 143406 | `cmtx7f9d3000dpl0n2sczrqgi`, `cmtx7o2hl000hpl0n93idajl9` | `.../dsc-6332-eee7a28a-97e2-4b67-89fb-4b59ef66d2b7.webp`, `.../dsc-6332-c29e42f4-4c3a-4949-8423-0bba89f38401.webp` |

**Recommended action:** Likely re-upload of same DSC frame. Optional HeadObject ETag compare on these two keys only; keep one if identical. Model: `MediaAsset`.

---

### M8 — `status ≠ READY` but attached to published product/collection

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

---

### M9 — Local `/uploads/` or foreign hosts in imageUrl / JSON

| | |
| --- | --- |
| **Severity** | medium (overlaps M5a) |
| **Count** | 61 (`Product.imageUrl` → `cdn.shopify.com`) |
| **Local `/uploads/`** | 0 |
| **JSON foreign / local leftovers** | 0 beyond product CDN URLs in this pass |

**Examples:** same product ids as M5a (Shopify CDN).

**Recommended action:** Same as M5a. No local `public/uploads` leftovers found in `imageUrl` / scanned JSON. Models: `Product.imageUrl`; JSON fields `Page.content`, `PageTranslation.content`, `CollectionSection.content`, `ProductTranslation.details` clean of `/uploads/` and foreign media hosts in this audit.

---

### M10 — Keys outside `uploads/products|collections|videos`

| | |
| --- | --- |
| **Severity** | low (false “unexpected” vs stated list; code allows pages) |
| **Count** | 39 `MediaAsset` + 39 bucket keys |

All are `uploads/pages/**`, produced by `savePageImageUpload(..., "pages")` in `lib/media/local-upload.ts`.

**Examples (≤10)**

| id | key |
| --- | --- |
| `cmty68pjs003lpl0nvt1tolrj` | `uploads/pages/dsc-5861-2b60744b-cbc3-4efd-a99f-5fe3ba91ff81.webp` |
| `cmty7fzq7003wpl0nb4s1o26r` | `uploads/pages/dsc-6236-64401863-e9aa-4469-91ea-ba187f566f34.webp` |
| `cmty7j06j0041pl0nks8f0o8m` | `uploads/pages/dsc-6252-ee60ccfd-1964-4109-a977-754f7573052e.webp` |
| `cmty7lmj70044pl0nvgdaidmi` | `uploads/pages/dsc-6226-bee24bd8-a49d-4aff-8fe7-1114a5c2ea5c.webp` |
| `cmty7q0w70047pl0n9oj3dksn` | `uploads/pages/u-12-3c5ed7ac-d9e4-4f52-b329-e6dfcb02bd87.webp` |
| `cmty9cyeg005dpl0nlbru38j4` | `uploads/pages/dsc-62552-97f96ab8-28f1-4626-87a6-8037cbbb8c6d.webp` |
| `cmu8439h101ojjx0m78xeafw3` | `uploads/pages/dsc-6049-152043ac-1725-4bef-9bc2-8f970cf67ce8.webp` |
| `cmu8559ms01orjx0m2dn53d72` | `uploads/pages/dsc-67834-cdb2e43d-2329-4530-9016-b329c05aa5c8.webp` |
| `cmu86uhfm01p4jx0maeo26e9g` | `uploads/pages/dsc-5876-eb185b29-5f66-478a-b6ae-8773916213e9.webp` |
| `cmuczgr8n0009s00nfu8v5ng3` | `uploads/pages/dsc-6858-a72135cb-f0e3-4d0d-836c-56c009f3cba9.webp` |

**Recommended action:** Treat `uploads/pages/` as a fourth canonical prefix in future audits (alongside products/collections/videos). No move required. Model: `MediaAsset.key`; code: `lib/media/local-upload.ts`.

**Prefix inventory (all assets)**

| Prefix | Count |
| --- | ---: |
| `uploads/pages/` | 39 |
| `uploads/collections/` | 24 |
| `uploads/products/` | 10 |
| `uploads/videos/` | 0 |

---

## Data integrity

### D1 — Orphan join / translation rows

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

Checked: `ProductMedia`, `ProductTag`, `ProductCollection`, `ProductVariantOptionValue`, `ProductTranslation`, `CollectionTranslation`, `PageTranslation` (LEFT JOIN / NOT IN parent). Consistent with Prisma `onDelete: Cascade`.

---

### D2 — Shopify-linked product FAILED/CONFLICT without OPEN `AdminIssue`

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 |

Query: `Product.shopifyProductId` set ∧ `syncStatus ∈ {FAILED,CONFLICT}` ∧ latest `ProductSyncEvent` same status ∧ no `AdminIssue` OPEN for `entityType=PRODUCT`. Models: `Product`, `ProductSyncEvent`, `AdminIssue` (`lib/admin/issues.ts`).

---

### D3 — Localized handles / redirects

| | |
| --- | --- |
| **D3a** empty `localizedHandle` | info · 0 |
| **D3b** `LocalizedHandleRedirect.entityId` missing | info · 0 |

---

### D4 — `SiteSetting` keys unread by code

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 unread |

**Present:** `shopify.store_binding` (read by `lib/shopify/store-binding.ts`).  
**Absent but known to code:** `site-videos`, `site-seo-v1`, `storefront-copy-v1` — defaults apply until first save.

---

### D5 — OPEN `AdminIssue` with missing entity

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 stale / 15 OPEN total |

---

### D6 — Expired sessions / rate limits (volume only)

| Model | Expired | Total |
| --- | ---: | ---: |
| `AdminSession` (`expiresAt < now`) | 0 | 2 |
| `ShopifyCustomerSession` (`accessTokenExpiresAt`) | 1 | 2 |
| `ShopifyCustomerSession` (`sessionExpiresAt`) | 0 | 2 |
| `RateLimitBucket` (`resetAt`) | 0 | 0 |

**Recommended action:** Optional purge of 1 expired customer session after confirmation. No urgency.

---

### D7 — Growth tables vs DB size

DB ≈ **17 536 703** bytes.

| Table | Bytes | Live tuples | % of DB |
| --- | ---: | ---: | ---: |
| `AuditLog` | 2 580 480 | 398 | 14.71% |
| `ProductSyncEvent` | 147 456 | 14 | 0.84% |
| `ShopifyReconcileRun` | 65 536 | 16 | 0.37% |
| `ShopifyFieldDivergence` | 49 152 | 0 | 0.28% |
| `ProductIncomingUpdateView` | 49 152 | 1 | 0.28% |
| `TranslationSyncEvent` | 32 768 | 0 | 0.19% |
| `ProductIncomingUpdate` | 32 768 | 1 | 0.19% |
| `ShopifyTranslationSnapshot` | 32 768 | 0 | 0.19% |

**Recommended action:** Retention not urgent. Only `AuditLog` is material (~15% of a still-small DB). Revisit if `AuditLog` grows past tens of MB. Models as listed.

---

### D8 — Tables in Postgres absent from current `prisma/schema.prisma`

| | |
| --- | --- |
| **Severity** | medium |
| **Count** | 14 tables |

Not in schema (legacy local commerce / auth):  
`Address`, `AuthAccount`, `Cart` (3 rows), `CartItem` (3), `CustomerProfile`, `Order` (0), `OrderItem`, `Permission`, `Role`, `RolePermission`, `User` (1), `UserRole`, `UserSession` (1), `VerificationToken`.

Also: `AuditLog.actorId` column + index `AuditLog_actorId_createdAt_idx` remain in DB; current Prisma model uses `adminUsername` / `adminSessionId` only.

**Migration name drift (P2):** none — 32 disk migrations ≡ 32 `_prisma_migrations` rows, no failed/unfinished.

**Recommended action:** Separate schema-drift ADR: either restore models or schedule drop migrations after dry-run row export. Do not DROP in this audit. Observation from `information_schema` / `pg_class` vs `prisma/schema.prisma`.

---

## Postgres optimization (observations)

### P1 — Size, dead tuples, scans, indexes, cache, connections

| Metric | Value |
| --- | --- |
| DB size | ~16.7 MiB |
| Cache hit | 99.99% (`blks_hit` / (`blks_hit`+`blks_read`)) |
| `max_connections` | 500 |
| Connections (this DB) | idle 21 · active 1 · idle in transaction 0 |
| `pg_stat_statements` | **not installed** |

**Top tables by `pg_total_relation_size`**

| Table | Bytes | Live |
| --- | ---: | ---: |
| `AuditLog` | 2 580 480 | 398 |
| `Product` | 1 081 344 | 61 |
| `ProductTag` | 491 520 | 649 |
| `Page` | 335 872 | 14 |
| `ShopifyCustomerSession` | 311 296 | 2 |

**Dead-tuple candidates (`pg_stat_user_tables`)** — absolute dead counts are small; ratios look high only because live counts are tiny:

| Table | Live | Dead | Dead % | Last autovacuum |
| --- | ---: | ---: | ---: | --- |
| `ProductTag` | 649 | 72 | 11% | 2026-09-20 |
| `ShopifyCustomerSession` | 2 | 48 | high | null |
| `Page` | 14 | 41 | high | null |
| `RateLimitBucket` | 0 | 38 | — | 2026-09-20 |
| `ProductCharacteristic` | 54 | 34 | 63% | null |

**Seq vs idx on large tables:** no table with `n_live_tup > 1000` and `seq_scan > idx_scan`.

**Unused indexes (`idx_scan = 0`, non-unique, >8 KiB)** — samples:

| Table | Index | Bytes |
| --- | --- | ---: |
| `AuditLog` | `AuditLog_adminSessionId_createdAt_idx` | 57 344 |
| `AuditLog` | `AuditLog_actorId_createdAt_idx` | 32 768 |
| `Collection` | `Collection_status_visibility_sortOrder_idx` | 16 384 |
| `Product` | `Product_categoryId_idx` | 16 384 |
| `Cart` | `Cart_userId_status_idx` | 16 384 |
| `ProductCharacteristic` | `ProductCharacteristic_key_*_idx` (3) | 16 384 each |

**Recommended action:** Do not DROP indexes without confirming rare admin queries. `AuditLog_actorId_*` is legacy (D8). Manual `VACUUM` on tiny tables is optional; autovacuum is enough at this scale. Install `pg_stat_statements` on Railway if query timing is needed later.

### P2 — `_prisma_migrations` vs `prisma/migrations`

| | |
| --- | --- |
| **Severity** | info |
| **Count** | 0 name drift |

See D8 for **model/table** drift not captured by migration filenames.

---

## Summary priority list (no action taken)

1. **M5a / M9 (high):** Catalog still serves Shopify CDN `imageUrl` for 59/61 products (47 published); only 2 have `primaryAssetId`, both with CDN URL still. Align policy with Shopify-as-commerce-SoT vs local `MediaAsset` projection.
2. **M1 (medium):** 57 assets unreferenced by FK or JSON — mainly superseded collection/product uploads + unused page images; dry-run cleanup later.
3. **D8 (medium):** 14 legacy tables + `AuditLog.actorId` remain in Postgres after leaving Prisma schema.
4. **M10 (low):** Document `uploads/pages/` as canonical (already in `lib/media/local-upload.ts`).
5. **D6 / D7 / P1 (info):** One expired customer session; `AuditLog` largest table but DB still small; no vacuum emergency; no `pg_stat_statements`.

---

## Method notes

- Bucket walk: `ListObjectsV2` paginated (`MaxKeys=1000`); object bodies never downloaded.
- Key-set compare first; no blanket `HeadObject`.
- URL normalization: `/media/<key>` treated as canonical public form when proxy mode is the write path (`lib/s3.ts` `getS3PublicUrl`).
- Known `SiteSetting` readers: `site-videos`, `site-seo-v1`, `storefront-copy-v1`, `shopify.store_binding`.
- Secrets and connection strings omitted from this report.
