import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ProductEditorTabs,
  type ProductEditorSection,
} from "@/components/admin/products/product-editor-tabs";

function TabsHarness({ includeShopify = true }: { includeShopify?: boolean }) {
  const [active, setActive] = useState<ProductEditorSection>("essentials");

  return (
    <ProductEditorTabs
      active={active}
      onChange={setActive}
      includeShopify={includeShopify}
    />
  );
}

describe("ProductEditorTabs", () => {
  it("groups the product editor into Shopify and Synarava clusters", () => {
    render(<TabsHarness />);

    expect(screen.getByRole("group", { name: "Shopify" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Synarava" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Title & organization/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Price Sell/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Metafields/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Content/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Media/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Sync/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Product page/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Product identity" })).toBeInTheDocument();

    const shopifyGroup = screen.getByRole("group", { name: "Shopify" });
    expect(shopifyGroup).toContainElement(screen.getByRole("tab", { name: /Title & organization/i }));
    expect(shopifyGroup).toContainElement(screen.getByRole("tab", { name: /Price Sell/i }));
    expect(shopifyGroup).toContainElement(screen.getByRole("tab", { name: /Metafields/i }));
    expect(shopifyGroup).toContainElement(screen.getByRole("tab", { name: /Sync/i }));
    expect(screen.getByRole("group", { name: "Synarava" })).toContainElement(
      screen.getByRole("tab", { name: /Product page/i }),
    );
  });

  it("hides Sync and Metafields when includeShopify is false", () => {
    render(<TabsHarness includeShopify={false} />);
    expect(screen.queryByRole("tab", { name: /Sync/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Metafields/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Catalog/i })).toBeInTheDocument();
  });

  it("changes the active explanation when a tab is selected", () => {
    render(<TabsHarness />);

    fireEvent.click(screen.getByRole("tab", { name: /Media/i }));

    expect(screen.getByRole("tab", { name: /Media/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Build the product gallery" })).toBeInTheDocument();
  });

  it("tints sections with open issues and lists them under the description", () => {
    const issues = [
      {
        id: "iss-1",
        key: "k1",
        entityType: "PRODUCT",
        entityId: "p1",
        entityLabel: "Ring",
        fieldPath: "field-taxonomy-category",
        issueType: "MISSING_TAXONOMY",
        severity: "WARNING",
        status: "OPEN" as const,
        title: "Missing category",
        description: "No category",
        targetHref: "/admin/products/p1#field-taxonomy-category",
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        resolvedAt: null,
        notificationSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    render(
      <ProductEditorTabs
        active="catalog"
        onChange={() => {}}
        issueSections={new Set(["catalog"])}
        sectionIssues={issues}
        onIssueActivate={() => {}}
      />,
    );

    expect(screen.getByRole("tab", { name: /Catalog/i })).toHaveAttribute("data-issue", "true");
    expect(screen.getByRole("button", { name: /Missing category/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Title & organization/i })).not.toHaveAttribute("data-issue");
  });

  it("keeps the tabpanel body inside the same root as sticky section chrome", () => {
    render(
      <ProductEditorTabs active="content" onChange={() => {}}>
        <div role="tabpanel" aria-labelledby="product-editor-tab-content">
          Panel body
        </div>
      </ProductEditorTabs>,
    );

    const root = screen.getByRole("tablist").closest("[data-component='ProductEditorTabs']");
    const panel = screen.getByRole("tabpanel");
    expect(root).toContainElement(panel);
  });
});
