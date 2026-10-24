---
title: Sync collections with Shopify
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-24
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
- The **only** place that fetches Shopify and compares is the admin top-bar
  Shopify sync control. Catalog banners only display the last saved result.

:::good-to-know
There are two copies of commerce fields: a **Shopify** copy (left cell in the
conflict UI) and a **Synarava** copy (right cell). Nothing is written
automatically when you open the page. Webhooks update the Shopify-side copy and
conflict flags. A full catalog check runs from the admin top-bar Shopify control
(once at login, on click, and after every product / collection / language-setting
Save). While a check runs, Save and Take Shopify / Keep ours stay disabled;
fields stay editable. Sync status lives only on that top-bar control.
:::

## Steps

:::steps
### Read the conflict banner

On **Catalog → Collections**, the banner shows the saved conflict status:

- **N collections with conflicts** when at least one collection differs, or
  **No conflicts** when the count is zero.
- **Last full check \<date\>** whenever a check timestamp is stored (same
  source as the top-bar sync control). Hover shows “Last full conflict check”.

**Show conflicts** appears only when the count is greater than zero.

### Open ConflictResolver

Choose **Show conflicts** (or a row badge) to open ConflictResolver. Conflicts
are grouped by collection; each field is one row with two clickable cells:

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

Apply opens the existing preview/confirm summary of exactly the chosen
changes (including the warning that Take Shopify on **Only in Synarava**
removes the collection from Synarava). Confirm writes only those selections,
then re-fetches conflict signals.
:::

:::warning
The banner is display-only (saved conflict counts and last full-check time). It
does not show check progress. Use the admin top-bar Shopify control for status
(**Shopify current \<time\>**, **Checking Shopify…**, **Check failed**, or
**Shopify disconnected**) and to start a manual full check. Saving a collection
also runs that same full check. Use **Show conflicts** to review or resolve
differences.
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

**Cause:** That field has no safe field-by-field writer yet (blocked commerce).

**What happens:** The row is visible but not selectable. It stays a conflict
until scoped apply exists for that field.

**What to do:** Resolve the selectable fields that you can. Do not look for a
second Pull/Push conflict UI — there is only ConflictResolver.
:::

## Known limits

- Collection commerce windows cover Shopify-shaped fields such as title, handle,
  description, and SEO. Hero, manifesto, symbolism, and site state stay
  Synarava-only and are not resolved through this conflict list.
- Which products belong to a collection is product-driven membership sync, not
  part of the collection commerce window yet.
- Blocked commerce fields cannot be chosen cell-by-cell until scoped writers
  exist; whole-record conflict pull/push was removed from this UI.

## Verified on

Draft, grounded in ConflictResolver (`components/synarava-cms/conflict-resolver`)
and the conflict banner (`CatalogConflictStatus`). End-to-end admin verification
still pending.
