import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProductConflictCompareBanner } from "@/components/admin/products/product-conflict-compare-banner";

describe("ProductConflictCompareBanner", () => {
  it("renders nothing when icon would also show zero (one-sided-only case)", () => {
    const { container } = render(
      <ProductConflictCompareBanner
        signal={null}
        onOpen={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows conflict + differences (not 'fields') matching the icon badge", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductConflictCompareBanner
        signal={{
          leafCount: 3,
          differenceCount: 3,
          shared: true,
          sharedCount: 2,
          locales: [
            { code: "pt", name: "Portuguese", nativeName: "Português", count: 1 },
          ],
        }}
        onOpen={onOpen}
      />,
    );
    const button = screen.getByRole("button", {
      name: /3 conflicts \(3 differences\) from Shopify/i,
    });
    expect(button).toBeInTheDocument();
    // Shared never lists every language tab — only Shared + locales with leaves.
    expect(button.textContent).toMatch(/Shared/);
    expect(button.textContent).toMatch(/Portuguese/);
    expect(button.textContent).not.toMatch(/English/);
    expect(button.textContent).not.toMatch(/Russian/);
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows 1 conflict (N differences) for a whole-item leaf", () => {
    render(
      <ProductConflictCompareBanner
        signal={{
          leafCount: 1,
          differenceCount: 5,
          shared: true,
          sharedCount: 1,
          locales: [],
        }}
        onOpen={() => {}}
      />,
    );
    const button = screen.getByRole("button", {
      name: /1 conflict \(5 differences\) from Shopify/i,
    });
    expect(button.textContent).toMatch(/Shared/);
    expect(button.textContent).not.toMatch(/Portuguese|Russian|English/);
    expect(button.textContent).not.toMatch(/field/i);
  });
});
