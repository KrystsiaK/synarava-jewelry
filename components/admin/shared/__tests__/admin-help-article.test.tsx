import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminHelpArticle } from "@/components/synarava-cms";

const article = {
  slug: "add-a-product",
  title: "Add a product",
  section: "Catalog",
  status: "draft" as const,
  verifiedOn: null,
  updatedOn: "2026-10-23",
  headings: [
    { id: "goal", label: "Goal" },
    { id: "steps", label: "Steps" },
    { id: "what-if", label: "What if..." },
  ],
  body: `## Goal

Understand [Sync](glossary:sync).

:::diagram name=product-ownership
:::

:::note
Save and Sync are separate.
:::

## Steps

:::steps
### Save the product

Save it locally.

### Check the result

Review the status.
:::

## What if...

:::what-if
### Publishing is blocked

**Cause:** The image is missing.

**What to do:** Add an image.
:::

| Field | Owner |
|---|---|
| Price | Shopify |

<script>window.bad = true</script>`,
};

describe("AdminHelpArticle", () => {
  it("renders the article reading flow and ignores raw HTML", async () => {
    const user = userEvent.setup();
    const { container } = render(<AdminHelpArticle article={article} />);

    expect(screen.getByRole("heading", { level: 1, name: "Add a product" })).toBeVisible();
    expect(screen.getByText("Draft, not verified yet")).toBeVisible();
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeVisible();
    expect(screen.getByRole("img", { name: /information moves/i })).toBeVisible();
    expect(screen.getByText("Step 1 of 2")).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(container.querySelector("script")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Publishing is blocked" }));
    expect(screen.getByText("The image is missing.")).toBeVisible();
  });
});
