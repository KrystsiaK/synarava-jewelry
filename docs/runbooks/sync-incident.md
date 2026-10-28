# Sync went wrong — one-page incident runbook

**Audience:** owner / on-call. **Scope:** catalog sync / conflicts behaving badly.  
Not a DB wipe playbook — that is [`database-incident-recovery.md`](database-incident-recovery.md).  
Owner daily steps: [`admin-guide-ru.md`](admin-guide-ru.md). Never paste secrets into chat.

---

## 1. Symptoms → first guess

| What you see | Likely cause |
|---|---|
| **Shopify disconnected** / Check failed stuck | Credentials, app install, or store binding |
| **N conflicts** suddenly huge after a quiet day | Stale last check, wrong shop binding, or bulk Shopify edit |
| Counters say 0 but product still shows conflict chrome | Stale UI / need top-bar Manual check (leaves are SoT, not `syncStatus`) |
| Push / Create blocked: SKU not assigned | PENDING-\* — Inventory → Family → Preview → Confirm assign |
| Keep ours disabled on a product | Multi-variant gate (Take Shopify still OK) or form dirty / Save first |
| Rate-limit / throttle message | Shopify Admin API budget — wait, retry once |
| Apply “succeeded” but conflict returns | Convergence did not clear leaf — recheck that entity; do not mass Take Shopify |
| Presence: Missing in Shopify / Only in Synarava unexpected | Wrong store binding or accidental Remove / Create |

---

## 2. Diagnosis (safe, read-only)

**In admin (preferred first):**

1. Note top-bar state + last full-check time.
2. Click Shopify **Manual** once; wait for **Shopify current** or a clear failure.
3. Open **Show conflicts** — confirm leaf count ≈ banner (not “distinct products”).
4. Open one bad product: is the form dirty? Save or discard before Apply.
5. Confirm you are on the intended environment (staging vs production URL).

**SELECT-only SQL** (Railway Data / Query — never UPDATE/DELETE from this page):

- Store binding + readiness slices: [`scripts/db/prod-readiness-check.sql`](../../scripts/db/prod-readiness-check.sql) (one section at a time).
- Soft-deleted collections/products from destructive Remove: list archives

```sql
SELECT id, "resourceType", "entityId", reason, "archivedAt"
FROM "SyncEntityArchive"
ORDER BY "archivedAt" DESC
LIMIT 20;
```

Restore path (owner/dev only, after backup): [`scripts/db/restore-entity-archive.sql`](../../scripts/db/restore-entity-archive.sql).

---

## 3. Safe actions

1. **One** Manual top-bar check; wait for it to finish.
2. Resolve **≤10** products: choose Take Shopify / Keep ours → **read preview** → Confirm.
3. For PENDING SKU: Inventory → Family → Preview → Confirm assign → Save → Push/Create.
4. Rate limit: wait tens of seconds; retry **one** action.
5. Wrong shop suspicion: stop writes; compare binding / `myshopify` domain with expected; ask for help before Push.
6. Accidental archive: backup first, then restore SQL with an engineer — do not invent INSERT scripts.

---

## 4. What NOT to do

| Do not | Why |
|---|---|
| Blind **Take Shopify for all** + Confirm on the whole catalog | Mass overwrite of Synarava edits |
| Blind **Keep ours for all** on multi-variant / unknown set | Can push wrong variant shape or fail mid-batch |
| Run `prisma migrate`, `db push`, or any write SQL “to fix sync” | Can wipe or diverge production (see 2026-10-19 incident) |
| Point agent tools at production write URLs | Same |
| Parallel Push / Apply storms while throttled | Makes diagnosis worse |
| Treat `Product.syncStatus = CONFLICT` as the conflict inventory | Leaves from the last SyncResult are the SoT |
| Delete rows / clear `shopifySnapshot` by hand | Breaks two-state compare |
| “Fix” linked unit cost by Pushing from Synarava | Cost is never pushed on linked products |

---

## 5. Escalate when

- Disconnected / Check failed after two Manual retries
- Binding domain ≠ intended shop
- Preview wants to Remove many products you did not expect
- Conflicts reappear immediately after a careful Confirm on one entity
- Health revision ≠ the deploy you think is live

Then: freeze catalog writes, capture symptom + time + environment, ping the developer with **no secrets**.
