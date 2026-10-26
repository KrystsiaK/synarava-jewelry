---
title: Shopify sync button
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-26
---

# Shopify sync button

## Goal

Use the top-bar Shopify control as the place that fetches the current Shopify
catalog state and compares it with Synarava (one compare → SyncResult leaves).
Understand what the button states mean, when a check runs, and how banners and
counters stay in sync with that check — not with `syncStatus` flags.

## Before you start

- Shopify Admin credentials and the catalog store binding must match the shop
  you intend to sync.
- Resolving individual collection differences uses the same conflict list as
  products — see [Sync collections with Shopify](/admin/help/sync-collections).

:::good-to-know
There are two copies of commerce data: a **Shopify** copy (fetched
automatically, read-only in the conflict UI) and a **Synarava** copy
(editable columns + `extras`). A check never writes Synarava content. Only a
human **Apply** (Take Shopify / Keep ours, including the “for all” actions)
writes after preview. Synarava’s compare window is **derived** on the fly
(ADR-0009) — it is not a stored duplicate JSON blob.
:::

## Steps

:::steps
### Find the top-bar Shopify sync button

In admin, the top bar shows the Shopify sync control. Together with the
after-Save full check, this is the fetch+compare path for the catalog.
Opening **Show conflicts** / ConflictResolver does **not** fetch Shopify again
— it reads the last SyncResult leaves. Separate “Check Shopify” or “Run
conflict check” controls on catalog pages are not part of this model.

### Read the button state

| State | Meaning | What to do |
| --- | --- | --- |
| **Shopify current \<time\>** | Last successful full check finished at that time | Nothing required; open **Show conflicts** on a banner if you want to review |
| **Checking Shopify…** | A full check is in progress | Wait; fields stay editable, but write actions stay locked (below) |
| **Check failed** (red) | The check did not finish successfully | Click the button to retry. Your last Save was not lost |
| **Shopify disconnected** (red) | Admin cannot reach Shopify (credentials, app install, or store binding) | Fix Admin API credentials / app install for this environment, then retry |

### Know when a check runs

A full check (products, collections, and translations) runs when you:

1. **Click** the top-bar button, or
2. **Open admin for this login session** — once per session (`trigger: AUTO`).
   Navigating between admin pages does **not** start another full check; the
   session reuses the run already started for that login.
3. **Save** — Synarava is saved first, then everything is fetched and compared.

Shopify-side edits still refresh the Shopify copy through product webhooks;
that updates the Shopify-side window without writing Synarava content. Conflict
lists and banners still come from SyncResult leaves after the next full check
(or Apply safety inspect), not from a `syncStatus: CONFLICT` flag.

### Work while a check runs

During a check:

- Field values stay editable.
- **Save**, **Take Shopify** / **Keep ours** (including “for all”), and the
  sync button itself stay disabled until the check finishes (success or error).
- Reloading the page keeps the lock while the check is still running.
- A stuck check expires after 10 minutes and unlocks the UI.

### Read banners and counters after the check

Catalog banners and counters (conflict count, **Last full check**, **Show
conflicts**) all reflect the same SyncResult from that full check. When the
count is greater than zero, open the list from **Show conflicts** and resolve
with preview → Apply (Apply may refresh that one product/collection for safety
before writing). Collections use the same pattern — see
[Sync collections with Shopify](/admin/help/sync-collections).
:::

:::note
How long a full check takes depends on catalog size. Expect seconds for a small
catalog, and up to about a minute for roughly 1 000 products. Treat these as
estimates, not measurements.
:::

## What if...

:::what-if
### Why can't I Save or Apply right now?

**Cause:** A full Shopify check is still running (or the lock has not cleared
after a reload).

**What happens:** Fields remain editable, but Save, Take Shopify / Keep ours
(and “for all”), and the sync button stay disabled.

**What to do:** Wait for **Shopify current**, **Check failed**, or **Shopify
disconnected**. If nothing changes for more than 10 minutes, the stuck check
expires and unlocks the UI — then retry the button if needed.

### I saved and the numbers changed

**Cause:** After Save, Synarava is written first, then a full check fetches
Shopify and compares again.

**What happens:** Banner counts and **Last full check** update from that check.
New differences can appear even though you only saved locally.

**What to do:** Open **Show conflicts** if the count is greater than zero, or
continue editing if there is nothing to resolve.

### Check failed — is my data lost?

**Cause:** The Shopify fetch or compare did not finish (network, credentials,
or Shopify error).

**What happens:** The button shows red **Check failed**. The Save that already
finished in Synarava is still there.

**What to do:** Click the button to retry. If the state becomes **Shopify
disconnected**, fix credentials / app install first.

### Do I need to press the button after saving?

**Cause:** None — after Save, Synarava is written first, then a full check runs.

**What happens:** Counts refresh without an extra click.

**What to do:** Press the button for an on-demand check without saving, to
retry after a failure, or if you want a fresh compare before the next Save.
:::

## Known limits

- A check refreshes the Shopify-side copy and rebuilds SyncResult leaves. It
  never writes Synarava columns or `extras`; only human Apply / Save does.
  Default-locale EN translation rows that duplicate a commerce field already in
  the compare are not listed twice; page copy and non-commerce editorial
  translations still appear as their own rows.
- Product webhooks (`products/create`, `products/update`, inventory) refresh the
  Shopify copy for that product. They do not pull translations, and there is no
  matching collection webhook path for automatic collection commerce refresh.
- Banner stale marking uses a 30-minute window after the last successful full
  check (`STALE_AFTER_MS`).
- Duration figures above are estimates only; the admin does not display a
  measured runtime.

## Verified on

Draft. Grounded in the derived two-state sync model (ADR-0009, `lib/sync` →
SyncResult leaves), the top-bar control
(`components/admin/translations/admin-shopify-sync-signal.tsx`), the reconcile
route full-catalog path (`app/admin/api/shopify/reconcile/route.ts` →
`runCatalogConflictCheck` for session `AUTO` / click `MANUAL`), after-Save full
check (`runAfterSaveCatalogConflictCheck`), catalog conflict banners,
ConflictResolver open via `skipRefresh` loaders, and product webhooks
(`app/api/shopify/webhooks/products/route.ts`).
