---
title: Add a product
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-23
---

# Add a product

## Goal

Create a product while keeping the ownership boundary clear: Shopify owns the
commerce core, while Synarava keeps the editorial content used by the
storefront. Saving and syncing are separate parts of that workflow.

## Before you start

- Prepare a unique name, slug, and SKU.
- Set a price greater than zero. These four values are required for every save.
- Prepare a main product image before choosing [Published](glossary:published)
  or Unlisted. A product can remain a [Draft](glossary:draft) without one.

:::diagram name=product-ownership label="One product, two clear owners"
:::

:::good-to-know
The product editor is a Shopify skeleton plus Synarava sections. Shopify-owned
fields can be compared or transferred with [Sync](glossary:sync). Synarava-only
editorial fields survive Shopify synchronization.
:::

## Steps

:::steps
### Start in the product create form

Open **Catalog → Products** and start a new product. The create form keeps the
product as a private draft while there is work to save.

### Enter the required product identity

Add the name, slug, SKU, and a price greater than zero. A duplicate slug or SKU
is shown as a field error and does not update the existing product.

### Work through the Shopify and Synarava sections

Use the **Shopify** group for Product, Price, Inventory, Metafields, Media, and
Sync. Use the **Synarava** group for Passport and Product page editorial
content. Description, SEO, category, collections, and Site state are in the
Product section.

### Save the full local product

Choose **Save product** to save the complete product locally. Switching tabs
does not clear entered values. The Sync section appears after the first save.

### Add media before publishing

Add a main product image before setting the product to Published or Unlisted.
Supported uploads are JPEG, PNG, WebP, or AVIF images up to 10 MB. The first
gallery image is the catalog cover, and gallery images can be reordered.

### Choose the storefront state

Keep the product in **Draft** to hide it. **Published** makes it visible in the
catalog and at its direct link. **Unlisted** removes it from catalog and search
but keeps the direct link and cart access available.

### Resolve Shopify conflicts in ConflictResolver

When the products list or editor shows conflicts, open **Show conflicts** (or
the conflict chip — text **N conflict(s) for …**). Conflicts sit on a tree:
shared fields (image, price, …) on the **English / base** tab only; a
Portuguese-only title conflict lights **PT** and the product total, never EN.
The list banner is store-wide; the editor uses the same indicator at product,
locale, and section level. One shared UI — ConflictResolver — lists every
differing field with **Shopify** on the left and **Synarava** on the right.
Items are headed **Product · Title  SKU …**. Scope chips say **Shared** (base
commerce) or **EN · English** / **PT · Português**. Media rows state what they
are (for example **Image 1 exists only in Synarava, not in Shopify**). Click a
cell to choose that side; Apply opens the confirm dialog grouped by the same
item headers. Each change row leads with the field and direction
(**Price: Shopify → Synarava**), shows source → target with before/after, and
the footer counts changes to Shopify vs Synarava. Nothing is written until you
confirm. There is no second Take/Keep or quick-pull dialog in the Sync strip.

When any commerce difference needs a whole-item sync (for example Status or
tags), compare shows one **Product data (N fields)** card for that product —
including otherwise scoped fields. Choosing a side runs one whole-item Pull or
Push; the confirm dialog shows that single aggregate before you confirm.
:::

:::warning
**Save product** always saves the full local product. Sync actions compare or
transfer Shopify-owned fields; they are not a replacement for Save.
:::

## What if...

:::what-if
### I cannot see the Sync section yet

**Cause:** The product has not completed its first save.

**What happens:** The create form does not show Sync yet.

**What to do:** Complete the required name, slug, SKU, and price, then save the
product once.

### Publishing is blocked

**Cause:** The product has no main image.

**What happens:** Published and Unlisted cannot be saved, and the admin reports
“Product image is required before publishing.”

**What to do:** Add an image in Media, then choose the storefront state again.

### A field is highlighted after Save

**Cause:** A required value is missing or invalid, or the slug or SKU already
belongs to another product.

**What happens:** The error appears beside the field and the product is not
saved over an existing record.

**What to do:** Review the highlighted fields, correct the value, and save
again.
:::

## Verified on

Draft, not verified yet. This article is based on section 4 of the admin
runbook and still needs an end-to-end check in the current admin.
