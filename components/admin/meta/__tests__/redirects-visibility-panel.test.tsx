import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RedirectsVisibilityPanel } from "@/components/admin/meta/redirects-visibility-panel";
import type { RedirectsVisibilityReport } from "@/lib/seo/redirects-visibility";

const okReport: RedirectsVisibilityReport = {
  shopify: {
    status: "ok",
    shopDomain: "synarava.myshopify.com",
    adminRedirectsUrl: "https://admin.shopify.com/store/synarava/content/redirects",
    count: 2,
    countPrecision: "EXACT",
    truncated: false,
    redirects: [
      { id: "gid://shopify/UrlRedirect/1", path: "/old-ring", target: "/products/lava-ring" },
      { id: "gid://shopify/UrlRedirect/2", path: "/about-us", target: "/pages/about" },
    ],
  },
  local: {
    count: 1,
    samples: [
      {
        id: "local-1",
        entityType: "PRODUCT",
        locale: "pt",
        fromHandle: "anel-antigo",
        toHandle: "anel-lava",
      },
    ],
  },
};

describe("RedirectsVisibilityPanel", () => {
  it("renders Shopify and local redirect samples with a Shopify Admin link", () => {
    render(<RedirectsVisibilityPanel report={okReport} />);

    expect(screen.getByText("Redirects")).toBeInTheDocument();
    expect(screen.getByText("/old-ring")).toBeInTheDocument();
    expect(screen.getByText("/products/lava-ring")).toBeInTheDocument();
    expect(screen.getByText("anel-antigo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage in Shopify/i })).toHaveAttribute(
      "href",
      "https://admin.shopify.com/store/synarava/content/redirects",
    );
    expect(screen.getByText(/Online Store host/i)).toBeInTheDocument();
  });

  it("explains a missing navigation scope without inventing a local editor", () => {
    render(
      <RedirectsVisibilityPanel
        report={{
          shopify: {
            status: "missing_scope",
            shopDomain: "synarava.myshopify.com",
            adminRedirectsUrl: "https://admin.shopify.com/store/synarava/content/redirects",
            requiredScope: "read_online_store_navigation",
            message: "Access denied",
          },
          local: { count: 0, samples: [] },
        }}
      />,
    );

    expect(screen.getByText(/read_online_store_navigation/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Shopify URL Redirects/i })).toBeInTheDocument();
    expect(screen.queryByText(/second redirect editor/i)).toBeInTheDocument();
  });
});
