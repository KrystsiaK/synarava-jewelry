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
  it("groups the product editor into task-based sections", () => {
    render(<TabsHarness />);

    expect(screen.getByRole("tab", { name: /Essentials/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Content/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Media/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Product page/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Shopify/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start with the sellable product" })).toBeInTheDocument();
  });

  it("changes the active explanation when a tab is selected", () => {
    render(<TabsHarness />);

    fireEvent.click(screen.getByRole("tab", { name: /Media/i }));

    expect(screen.getByRole("tab", { name: /Media/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Build the product gallery" })).toBeInTheDocument();
  });

  it("supports arrow-key navigation and omits Shopify before creation", () => {
    render(<TabsHarness includeShopify={false} />);

    const essentials = screen.getByRole("tab", { name: /Essentials/i });
    essentials.focus();
    fireEvent.keyDown(essentials, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: /Catalog/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: /Shopify/i })).not.toBeInTheDocument();
  });
});
