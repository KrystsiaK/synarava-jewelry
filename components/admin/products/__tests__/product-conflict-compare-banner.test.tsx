import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProductConflictCompareBanner } from "@/components/admin/products/product-conflict-compare-banner";

const LOCALE_TABS = [
  { code: "en", label: "English" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

describe("ProductConflictCompareBanner", () => {
  it("renders nothing when icon would also show zero (one-sided-only case)", () => {
    const { container } = render(
      <ProductConflictCompareBanner
        signal={null}
        localeTabs={LOCALE_TABS}
        onOpen={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the same field count the icon badge would show", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductConflictCompareBanner
        signal={{
          leafCount: 3,
          shared: true,
          sharedCount: 2,
          locales: [
            { code: "pt", name: "Portuguese", nativeName: "Português", count: 1 },
          ],
        }}
        localeTabs={LOCALE_TABS}
        onOpen={onOpen}
      />,
    );
    const button = screen.getByRole("button", { name: /3 fields differ from Shopify/i });
    expect(button).toBeInTheDocument();
    // Shared never lists every language tab — only Shared + locales with leaves.
    expect(button.textContent).toMatch(/Shared/);
    expect(button.textContent).toMatch(/Portuguese/);
    expect(button.textContent).not.toMatch(/English/);
    expect(button.textContent).not.toMatch(/Russian/);
    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not list languages for shared-only conflicts", () => {
    render(
      <ProductConflictCompareBanner
        signal={{
          leafCount: 1,
          shared: true,
          sharedCount: 1,
          locales: [],
        }}
        localeTabs={LOCALE_TABS}
        onOpen={() => {}}
      />,
    );
    const button = screen.getByRole("button", { name: /1 field differ from Shopify/i });
    expect(button.textContent).toMatch(/Shared/);
    expect(button.textContent).not.toMatch(/Portuguese|Russian|English/);
  });
});
