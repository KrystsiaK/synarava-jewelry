---
title: Sync collections with Shopify
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-25
---

# Sync collections with Shopify

## Goal

Compare Synarava collections with Shopify and resolve differences without
automatic writes. Every change that updates Synarava or Shopify content is a
human **Apply** after preview.

## Before you start

- Shopify Admin credentials must be configured and the catalog store binding
  must match the current shop.
- Collections use the **same** ConflictResolver UI as Products (one shared
  control in synarava-cms).
- Shopify fetch+compare runs from the admin top-bar Shopify control (once at
  login, on click) and after Save. Catalog banners and ConflictResolver open
  only display the last SyncResult leaves (`skipRefresh` — no Shopify fetch).

:::good-to-know
There are two copies of commerce fields: a **Shopify** copy (left cell in the
conflict UI) and a **Synarava** copy (right cell). Nothing is written
automatically when you open the page or the conflict list. Webhooks update the
Shopify-side copy. A full catalog check runs from the admin top-bar Shopify
control (once at login, on click) and after every product / collection /
language-setting Save. While a check runs, Save and Take Shopify / Keep ours
stay disabled; fields stay editable. Conflict counts come from SyncResult
leaves — not from a `syncStatus: CONFLICT` database flag.
:::

## Steps

:::steps
### Read the conflict banner

On **Catalog → Collections**, the banner shows the saved SyncResult status:

- **N collections with conflicts** when at least one collection has ≥1 open
  leaf, or **No conflicts** when the count is zero. N is the number of
  **distinct collections** with ≥1 open conflict (commerce, translation, or
  presence) — the same `countConflictedItems` figure as the Collections menu
  badge (not a `syncStatus` query).
- **Last full check \<date\>** from `SyncResult.checkedAt`: a fresh waterfall
  stamps the run that produced the counts; skipRefresh reads use the latest
  SUCCEEDED AUTO/MANUAL reconcile `completedAt` (same source as the top-bar
  Shopify signal). Hover shows “Last full conflict check”.

**Show conflicts** appears only when the count is greater than zero.

### Open ConflictResolver

Choose **Show conflicts** (or a row badge) to open ConflictResolver. Opening
the list does **not** fetch Shopify again — it maps the saved SyncResult
leaves into rows. Conflicts are grouped by collection; each field is one row
with two clickable cells:

- **Left = Shopify**
- **Right = Synarava (ours)**

Presence-only items use the same row model. The missing side shows
**Not in Shopify** or **Not in Synarava**.

### Choose a subset, then Apply

- Click a cell to choose that side (highlighted). Click again to clear.
- You may select any subset — even a single conflict. Unchosen rows stay as
  conflicts.
- Footer **Take Shopify for all** / **Keep ours for all** only *select*
  every eligible row; they do not write.
- Footer shows **N selected** and **Apply (N)** (disabled when N is 0).

### Confirm preview

Apply opens the confirm dialog for exactly the chosen changes. Each row shows:

- a plain-language headline (for example **Create "Pets" in Shopify**,
  **Update price in Shopify**, **Take Shopify's title into Synarava**, or
  **Remove "Pets" from Synarava (linked products stay)**)
- the chosen source cell, an arrow into the side that will be written, and
  that target’s **before → after** values (create starts from **Not in
  Shopify** / **Not in Synarava**; remove ends at **Removed**)
- a footer count of how many changes go to Shopify vs Synarava

Nothing is written until you **Confirm changes** (the acknowledgement
checkbox still appears for clears / removals). Confirm writes only those
selections. Apply may refresh that one collection for write safety, then
rebuilds leaves; after a successful Apply the after-save full check runs.
:::

:::warning
The banner is display-only (saved SyncResult counts and last full-check time).
It does not show check progress. Use the admin top-bar Shopify control for
status (**Shopify current \<time\>**, **Checking Shopify…**, **Check failed**,
or **Shopify disconnected**) and to start a manual full check. Saving a
collection also runs that same full check. Use **Show conflicts** to review or
resolve differences without starting another fetch.
:::

## What if...

:::what-if
### Show conflicts is missing

**Cause:** The saved conflict count is zero.

**What happens:** The banner shows **No conflicts** and hides
**Show conflicts**.

**What to do:** Use the top-bar Shopify control (or Save) if you expect new
differences, or continue editing — there is nothing to resolve in the list.

### Banner looks outdated

**Cause:** No successful full check recently, or Shopify changed after the last
top-bar check.

**What happens:** The banner still shows the last saved count and
**Last full check** time (when available).

**What to do:** Use the admin top-bar Shopify sync control to fetch and compare
again.

### A commerce field says “Cannot choose here”

**Cause:** That collection commerce field has no safe field-by-field writer, and
collections have no whole-item pull/push path (products do — see products doc).

**What happens:** The row is visible but not selectable. It stays a conflict.

**What to do:** Resolve selectable fields (scoped commerce, translations,
presence). Do not look for a second conflict UI — there is only ConflictResolver.
:::

## Known limits

- Collection commerce windows cover Shopify-shaped fields such as title, handle,
  description, and SEO. Hero, manifesto, symbolism, and site state stay
  Synarava-only and are not resolved through this conflict list.
- Which products belong to a collection is product-driven membership sync, not
  part of the collection commerce window yet.
- Blocked collection commerce fields stay non-selectable until a collection
  whole-item apply path exists (products already resolve blocked fields via
  whole-item sync inside the same ConflictResolver).

## Verified on

Draft, grounded in ConflictResolver (`components/synarava-cms/conflict-resolver`)
and the conflict banner (`CatalogConflictStatus`). End-to-end admin verification
still pending.
