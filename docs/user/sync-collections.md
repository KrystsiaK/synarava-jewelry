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
- Collections use the same conflict banner and list flow as Products.
- The **only** place that fetches Shopify and compares is the admin top-bar
  Shopify sync control. Catalog banners only display the last saved result.

:::good-to-know
There are two copies of commerce fields: a **Shopify** copy (fetched, read-only
in the conflict UI) and a **Synarava** copy (editable). Nothing is written
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

### Open the conflict list

Choose **Show conflicts** (or a row badge) to open the list. Presence badges
include **Only in Synarava** and **Only in Shopify** when a collection exists
on one side only.

### Choose a direction, then preview

For each differing field or row:

- Down arrow (**Take Shopify**) copies Shopify into Synarava.
- Up arrow (**Keep ours**) keeps Synarava and can send it to Shopify.
- **Take Shopify for all** / **Keep ours for all** apply that choice to every
  eligible row.

Nothing is written until you confirm the preview.

### Confirm Apply and wait for refresh

After Apply, the UI refreshes conflict signals and reloads the page state so
counts and editors match the new windows.
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
:::

## Known limits

- Collection commerce windows cover Shopify-shaped fields such as title, handle,
  description, and SEO. Hero, manifesto, symbolism, and site state stay
  Synarava-only and are not resolved through this conflict list.
- Which products belong to a collection is product-driven membership sync, not
  part of the collection commerce window yet.

## Verified on

Draft, grounded in the conflict banner (`CatalogConflictStatus`) and sync
signal age (`checkedAt` from the same full-check source as the top-bar control).
End-to-end admin verification still pending.
