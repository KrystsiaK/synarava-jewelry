---
title: Sync collections
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-24
---

# Sync collections

## Goal

Keep Synarava collection copy aligned with Shopify without silent overwrites.
Each collection has two states: a Shopify copy (auto-fetched, read-only) and a
Synarava copy (editable). Nothing is written into Synarava automatically —
every change is a human [Apply](glossary:sync), either **Take Shopify** or
**Keep ours** (push ours to Shopify).

## Before you start

- Open **Catalog → Collections**.
- Shopify Admin API must be connected. If the banner says Shopify is
  disconnected, **Run conflict check** stays disabled until credentials work.
- Decide per field whether Shopify or Synarava should win before you confirm.

:::diagram name=product-ownership label="Two states: Synarava and Shopify"
:::

:::good-to-know
Opening a collection or running a conflict check refreshes the Shopify-side
copy and recounts differences. It does not apply those differences. Save still
writes only the local Synarava collection.
:::

## Steps

:::steps
### Read the conflict banner on Collections

The banner above the collections table reports the last saved conflict status.
It is not a live Shopify feed until you run a check.

- **N collections with conflicts** — N collections where at least one field
  differs between Synarava and the saved Shopify copy.
- **check may be outdated** — the last successful check is older than 30
  minutes. The number may be out of date. Fix: **Run conflict check**.
- **N saved conflict collections** — repeats the saved count when the check is
  not currently ready (for example stale, checking, or failed).
- **Last full check** with a date — when that last successful check ran.
- **Show conflicts** — opens the conflict list. Hidden when the count is 0.
- **Run conflict check** — re-fetches Shopify and recounts. Disabled while a
  check is running, or when Shopify is disconnected.

Other banner states:

- **checking** / **Checking conflicts…** — a check is in progress.
- **conflict status unavailable (last check failed)** — the last check failed;
  saved conflicts are not replaced with a false zero.
- **Shopify disconnected** — credentials or connection are missing; the check
  button is disabled.
- **No saved conflicts** — zero conflicts. The banner still shows; **Show
  conflicts** is hidden.

### Open one collection’s fields

Choose **Show conflicts**, then open a collection. For each differing field you
see **Ours (Synarava)** and **Shopify**. Pick **Take Shopify** (copy into
Synarava) or **Keep ours** (send Synarava to Shopify). Unsupported fields stay
visible but cannot be chosen one-by-one.

### Preview, then Apply

Continue to the preview. Nothing is written until you confirm. After Apply, the
Collections page refreshes and fully resolved collections leave the banner
count. Run **Run conflict check** again when you want a fresh Shopify recount
of the whole list.
:::

:::warning
**Take Shopify** on a collection that exists only in Synarava removes that
collection from Synarava. Linked products stay; only the collection record is
removed.
:::

## What if...

:::what-if
### The banner says the check may be outdated

**Cause:** The last successful full check is older than 30 minutes.

**What happens:** You still see the last saved count, marked as possibly
outdated.

**What to do:** Choose **Run conflict check**.

### Run conflict check is disabled

**Cause:** A check is already running, or Shopify is disconnected.

**What happens:** The button stays inactive; the banner names the state.

**What to do:** Wait for **Checking conflicts…** to finish, or restore Shopify
Admin API credentials and try again.

### A field says it cannot be chosen here

**Cause:** That commerce field has no safe field-by-field write yet, or the
direction is not allowed for this row.

**What happens:** Both values stay visible; Choose is blocked for that field.

**What to do:** Use a supported field (Name, Handle, Description, SEO title,
SEO description), or resolve presence / Adopt Shopify when the UI offers a
whole-item action.
:::

## Known limits

- Field-by-field commerce Apply supports Name, Handle, Description, SEO title,
  and SEO description. Other commerce diffs can appear as blocked.
- One Apply batch accepts at most 200 field changes; bulk “for all” covers at
  most 50 collections at a time.
- Hero, manifesto, symbolism, and site publish state stay Synarava-only and are
  not part of the Shopify commerce window.
- Collection membership (which products belong) is not resolved through this
  Collections conflict banner.

## Verified on

Draft, not verified yet. Grounded in the Collections conflict banner and apply
paths in the current admin code; still needs an end-to-end check in `/admin/help`.
