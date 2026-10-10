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
        commerceFieldCount={0}
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
          shared: true,
          sharedCount: 2,
          locales: [
            { code: "pt", name: "Portuguese", nativeName: "Português", count: 1 },
          ],
        }}
        commerceFieldCount={2}
        localeTabs={LOCALE_TABS}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByRole("button", { name: /3 fields differ from Shopify/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /3 fields differ from Shopify/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
