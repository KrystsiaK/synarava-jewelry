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

:::good-to-know
There are two copies of commerce fields: a **Shopify** copy (fetched, read-only
in the conflict UI) and a **Synarava** copy (editable). Nothing is written
automatically when you open the page or run a check. Webhooks and refresh only
update the Shopify-side copy and conflict flags.
:::

## Steps

:::steps
### Read the conflict banner

On **Catalog → Collections**, the banner shows the saved conflict status:

- **N collections with conflicts** when at least one collection differs, or
  **No saved conflicts** when the count is zero.
- **check may be outdated** when the last successful full check is older than
  30 minutes (`STALE_AFTER_MS`).
- **Last full check \<date\>** whenever a check timestamp is stored (including
  when status is ready). Hover shows “Last full conflict check”.
- Other states: **checking Shopify now**, **conflict status unavailable (last
  check failed)**, **Shopify disconnected**.

**Show conflicts** appears only when the count is greater than zero.
**Run conflict check** is disabled while a check is in progress or Shopify is
disconnected.

### Run conflict check (banner only)

Choose **Run conflict check**. The check refreshes the banner count and
**Last full check** time. It does **not** open the conflict list by itself.

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
**Run conflict check** only updates the banner. Use **Show conflicts** when you
want to review or resolve differences.
:::

## What if...

:::what-if
### Show conflicts is missing

**Cause:** The saved conflict count is zero.

**What happens:** The banner shows **No saved conflicts** and hides
**Show conflicts**.

**What to do:** Run conflict check if the status may be outdated, or continue
editing — there is nothing to resolve in the list.

### Run conflict check stays disabled

**Cause:** A check is already running, or Shopify is disconnected.

**What happens:** The button is disabled; the banner may say **checking Shopify
now** or **Shopify disconnected**.

**What to do:** Wait for the in-flight check, or restore Shopify Admin
connectivity and store binding before checking again.

### A check fails

**Cause:** Credentials, scopes, store mismatch, or a Shopify error.

**What happens:** One error toast with a human message; the banner may show
failed status. The conflict list does not open automatically.

**What to do:** Read the toast, fix the connection or binding from Products if
needed, then run the check again.
:::

## Known limits

- Collection commerce windows cover Shopify-shaped fields such as title, handle,
  description, and SEO. Hero, manifesto, symbolism, and site state stay
  Synarava-only and are not resolved through this conflict list.
- Which products belong to a collection is product-driven membership sync, not
  part of the collection commerce window yet.
- A full check older than 30 minutes is marked stale on the banner.

## Verified on

Draft, grounded in the conflict banner (`CatalogConflictStatus`), collection
CMS check flow (`useCatalogConflictCheck`), and sync signal age
(`STALE_AFTER_MS` in `lib/sync/build-signals.ts`). End-to-end admin verification
still pending.
