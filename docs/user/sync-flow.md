---
title: Shopify sync flow for catalog owners
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-27
---

# Shopify sync flow for catalog owners

## Goal

Use today’s staging admin sync the way it works now: check Shopify from the
top bar, review differences in one conflict window, choose a side, preview,
then Apply. Create products in Synarava first, push them to Shopify when
ready, and assign SKUs with an explicit family.

## Before you start

- You are signed in to admin on **staging** (or a matching environment).
- Shopify Admin credentials and the catalog store binding match the shop you
  mean to sync.
- Read also: [Shopify sync button](/admin/help/shopify-sync-button),
  [Add a product](/admin/help/add-a-product),
  [Sync collections](/admin/help/sync-collections).

:::good-to-know
There are two copies of commerce data. **Shopify** (left) is fetched and
read-only in the conflict UI. **Synarava** (right) is what you edit. A check
never writes Synarava content by itself. Only a human **Apply** after preview
writes. Nothing here invents a third “working” copy.
:::

## Steps

:::steps
### Use the top-bar Shopify button

In admin, the top bar shows the Shopify sync control. That is the place that
fetches Shopify and compares it with Synarava for the **whole catalog** when
you click it, and once per login session. After Save / Apply / Push / Pull /
SKU assign, Synarava rechecks **only that product or collection** — not the
whole catalog. Opening **Show conflicts** does **not** fetch Shopify again; it
reads the last compare result.

Button states you will see:

| State | Meaning |
| --- | --- |
| **Shopify current \<time\>** | Last successful full check finished |
| **Checking Shopify…** | Full check in progress — Save / Apply stay locked |
| **Check failed** | Check did not finish — click to retry |
| **Shopify disconnected** | Credentials / app / store binding need fixing |

If Shopify answers with a rate-limit (too many Admin API requests), the admin
shows a clear message along the lines of **Shopify is rate-limiting requests;
wait a few seconds and try again**. Wait, then click the top-bar button again.
Do not keep hammering Push / Pull / Apply while that message is up.

### Open the conflicts window

When the banner shows **N conflicts**, choose **Show conflicts**. One shared
UI lists every open difference:

- **Left = Shopify**
- **Right = Synarava (ours)**

Click a cell to choose that side (highlighted). Click again to clear. Footer
**Take Shopify for all** / **Keep ours for all** only *select* rows — they do
not write. **Apply (N)** opens the preview. Nothing is written until you
confirm.

Confirm rows show the field and direction, for example
**Price: Shopify → Synarava**, **Create item: …**, or
**Remove item: Shopify → Synarava** (that wording means the chosen action
removes the Synarava-side item after you confirm — treat removals carefully).

### Understand the “Product data (N fields)” card

When any product commerce difference needs a **whole-item** Pull/Push (tags,
status, cost, and similar), compare shows **one** base card —
**Product data (N fields)** — covering every commerce difference for that
product in this group. Choosing a side on that card selects the **whole
group** for one Pull or Push. That is why one pick looks like it “selects
everything”: the group is one sync unit, not N separate field writers.

If every commerce difference is scoped field-by-field, each field stays its
own selectable card instead.

### Resolve per-language conflicts

Shared commerce facts (price, image, status, …) live on the **English / base**
tab only. A Portuguese-only title conflict lights **PT** (and the product
total), never EN. Locale translation rows (PT/RU, …) are separate from the
**Product data (N fields)** commerce group. Open the locale tab that shows a
dot, choose Shopify or Synarava for that language row, then Apply with preview.

### Create in Synarava, then push to Shopify

1. Open **Catalog → Products** and create a product (name + price required).
2. **Save product** — the local draft exists only in Synarava at first
   (**Only in Synarava**).
3. Assign a unique **SKU** (see next step) before Create is enabled.
4. In the product header choose **Create in Shopify**. That pushes the
   product, confirms any pending SKU reservation, rechecks that product, and
   moves toward **In sync** when the copies match.

Later edits: use **Push** / **Pull** / **Resolve** from the same header when
the status asks for them. **Save product** always saves the full local
product; sync is not a substitute for Save.

### Assign a SKU (explicit family, immutable ledger)

When the portable SKU service is configured, the **Inventory** tab (Push gate
copy: “Stock tab”) shows **Family → Preview → Confirm assign** (or **Resume**
for a pending reservation). PENDING-\* must finish that path before Push:

- You must **choose a family** yourself. Nothing is pre-selected.
- Preview and Confirm stay disabled until a family is chosen.
- The chosen family is sent exactly as selected — there is no silent
  “first family in the list” fallback.
- The registry **ledger is immutable**: a wrong family permanently reserves
  that code path. Preview first; Confirm only when the candidate SKU is right.

If SKU assignment is not configured for this environment, you still type the
SKU field manually before Create in Shopify.

**Cost** is Shopify-owned: linked Keep ours / Push never sends unit cost.
**Multi-variant** products block Keep ours on the whole-item **Product data
(N fields)** card — Take Shopify still works.

**Photos (Media):** each difference is its own row — removed photo, new photo,
order change, or alt text. **Take Shopify** puts Shopify’s photo back / drops
your new one / uses Shopify order or alt. **Keep ours** deletes the Shopify
photo on Push / uploads your new one / keeps your order or alt. A CDN link
change on the same Shopify photo is not a conflict.

### Remove an item with care

Presence conflicts use the same left/right cells. Choosing Shopify on a
Synarava-only row (or the reverse) can create or remove. In the confirm
dialog, direction lines such as **Remove item: Shopify → Synarava** mean the
Synarava copy will be removed after you confirm. Always read the before →
after values and the footer counts before **Confirm changes**.
:::

:::warning
Only behavior on staging **today** is described above. Anything still building
is marked **coming** below — do not expect it in the UI yet.
:::

## Coming (not on staging yet)

- Collection **membership** (which products sit in a collection) inside the
  same collection commerce conflict window — **coming**.
- Collection **whole-item** Pull/Push for every blocked commerce field —
  **coming** (products already use **Product data (N fields)** for that case).
- Automatic collection refresh from a collection webhook path — **coming**
  (product webhooks already refresh the Shopify product copy).

## What if...

:::what-if
### I see a rate-limit message

**Cause:** Shopify Admin API throttled the request.

**What happens:** The action fails with a friendly rate-limit message (wait a
few seconds and try again). Raw `Throttled` is not the owner-facing text.

**What to do:** Pause briefly, then retry the top-bar check or the single
action once. Avoid parallel Push / Apply storms.

### Create in Shopify stays disabled

**Cause:** Usually `SKU required` or `Save changes first`.

**What to do:** Save, assign/confirm SKU with an explicit family, then Create.

### One click selected many fields

**Cause:** You chose a side on **Product data (N fields)**.

**What happens:** The whole commerce group is selected for one Pull/Push.

**What to do:** That is expected. Clear the card if you did not mean a
whole-item sync; use individual field cards when they are shown separately.
:::

## Verified on

Draft for staging owners. Grounded in the live two-state sync model and the
current ConflictResolver / top-bar / SKU assign UI. End-to-end owner walkthrough
on staging still pending (`status: draft`).
