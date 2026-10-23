import type { Meta, StoryObj } from "@storybook/react-vite";

import { AdminHelpArticle } from "@/components/admin/shared/admin-help-article";
import type { HelpArticle } from "@/lib/admin/help-docs";

const article: HelpArticle = {
  slug: "add-a-product",
  title: "Add a product",
  section: "Catalog",
  status: "draft",
  verifiedOn: null,
  updatedOn: "2026-10-23",
  headings: [
    { id: "goal", label: "Goal" },
    { id: "before-you-start", label: "Before you start" },
    { id: "steps", label: "Steps" },
    { id: "what-if", label: "What if..." },
  ],
  body: `## Goal

Create a product while keeping the ownership boundary clear: Shopify owns the commerce core, while Synarava keeps the editorial content used by the storefront.

## Before you start

- Prepare a unique name, slug, and SKU.
- Set a price greater than zero.
- Prepare a main image before choosing [Published](glossary:published).

:::diagram name=product-ownership label="One product, two clear owners"
:::

:::good-to-know
The product editor is a Shopify skeleton plus Synarava sections. Save and [Sync](glossary:sync) are separate actions.
:::

## Steps

:::steps
### Enter the required identity

Add the name, slug, SKU, and price. These values are required for every save.

### Save the full local product

Choose **Save product**. The Sync section appears after the first save.

### Add media and choose a state

Add a main image before setting the product to Published or Unlisted.
:::

## What if...

:::what-if
### I cannot see Sync yet

**Cause:** The product has not completed its first save.

**What happens:** The create form does not show Sync.

**What to do:** Complete the required fields and save once.

### Publishing is blocked

**Cause:** The product has no main image.

**What happens:** Published and Unlisted cannot be saved.

**What to do:** Add an image in Media, then choose the state again.
:::`
};

const meta = {
  title: "synarava-cms/AdminHelpArticle",
  component: AdminHelpArticle,
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [390, 768, 1440] },
  },
  decorators: [
    (Story) => <div className="admin-terminal !block min-h-dvh p-4 md:p-8"><Story /></div>,
  ],
  args: { article },
} satisfies Meta<typeof AdminHelpArticle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Light390: Story = { globals: { theme: "light" }, parameters: { viewport: { defaultViewport: "mobile1" } } };
export const Dark390: Story = { globals: { theme: "dark" }, parameters: { viewport: { defaultViewport: "mobile1" } } };
export const Light768: Story = { globals: { theme: "light" }, parameters: { viewport: { defaultViewport: "tablet" } } };
export const Dark768: Story = { globals: { theme: "dark" }, parameters: { viewport: { defaultViewport: "tablet" } } };
export const Light1440: Story = { globals: { theme: "light" } };
export const Dark1440: Story = { globals: { theme: "dark" } };
