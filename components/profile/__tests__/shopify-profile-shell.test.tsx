import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import en from "@/messages/en.json";
import { flattenMessages } from "@/lib/i18n/utils";

const enFlat = flattenMessages(en as Record<string, unknown>);
function interpolate(message: string, values?: Record<string, string | number>) {
  if (!values) return message;
  return message.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => (
    Object.hasOwn(values, key) ? String(values[key]) : match
  ));
}

// A real dictionary lookup (rather than a stub returning the key) so these
// tests exercise the actual English copy a user sees, the same way the app's
// TranslationProvider does — REV-23 moved this component's copy into i18n
// keys, so a bare `t: (key) => key` mock would make every assertion below
// meaningless.
vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    locale: "en",
    t: (key: string, values?: Record<string, string | number>) => interpolate(enFlat[key] ?? key, values),
    plural: (key: string, count: number, values?: Record<string, string | number>) => {
      const category = new Intl.PluralRules("en").select(count);
      return interpolate(enFlat[`${key}.${category}`] ?? enFlat[`${key}.other`] ?? key, { ...values, count });
    },
  }),
}));

import { ShopifyProfileShell } from "../shopify-profile-shell";
import type { ShopifyCustomerProfile } from "@/lib/shopify/customer-account/api";

const customer = {
  id: "gid://shopify/Customer/1",
  displayName: "Jane Doe",
  firstName: "Jane",
  lastName: "Doe",
  creationDate: "2026-01-01T00:00:00.000Z",
  imageUrl: "",
  emailAddress: { emailAddress: "jane@example.com" },
  defaultAddress: null,
  addresses: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  orders: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
} as unknown as ShopifyCustomerProfile;

describe("ShopifyProfileShell security tab", () => {
  it("labels the tab Sign-in & security instead of the bare Security slug", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByRole("tab", { name: /sign-in & security/i })).toBeInTheDocument();
  });

  it("explains the sign-in is Shopify-managed and unrelated to a browser Google account", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText(/managed entirely by Shopify/i)).toBeInTheDocument();
    expect(screen.getByText(/separate from any Google account/i)).toBeInTheDocument();
  });

  it("shows the current session's remaining lifetime", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T00:00:00.000Z"));
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-09-25T00:00:00.000Z"
      />,
    );

    expect(screen.getByText(/asked to sign in again in 10 days/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("submits sign-out to the Shopify logout endpoint", () => {
    render(
      <ShopifyProfileShell
        customer={customer}
        activeTab="security"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    const form = screen.getByRole("button", { name: /sign out on this device/i }).closest("form");
    expect(form).toHaveAttribute("action", "/api/auth/shopify/logout");
  });
});

function buildOrder(id: string) {
  return {
    id,
    name: `#${id}`,
    processedAt: "2026-01-01T00:00:00.000Z",
    financialStatus: "PAID",
    fulfillmentStatus: "FULFILLED",
    statusPageUrl: `https://shop.example/orders/${id}`,
    totalPrice: { amount: "10.00", currencyCode: "EUR" },
    totalRefunded: { amount: "0.00", currencyCode: "EUR" },
    fulfillments: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    returnInformation: { returnableLineItems: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
    lineItems: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  };
}

describe("ShopifyProfileShell orders tab pagination (REV-13)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an honest '50+' count instead of implying the fetched page is everything", () => {
    const customerWithMoreOrders = {
      ...customer,
      orders: { nodes: [buildOrder("1")], pageInfo: { hasNextPage: true, endCursor: "cursor-1" } },
    } as unknown as ShopifyCustomerProfile;

    render(
      <ShopifyProfileShell
        customer={customerWithMoreOrders}
        activeTab="orders"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("1+ orders")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more orders" })).toBeInTheDocument();
  });

  it("appends the next page of orders and updates the count once loaded", async () => {
    const customerWithMoreOrders = {
      ...customer,
      orders: { nodes: [buildOrder("1")], pageInfo: { hasNextPage: true, endCursor: "cursor-1" } },
    } as unknown as ShopifyCustomerProfile;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        nodes: [buildOrder("2")],
        pageInfo: { hasNextPage: false, endCursor: null },
      }),
    }));

    const user = userEvent.setup();
    render(
      <ShopifyProfileShell
        customer={customerWithMoreOrders}
        activeTab="orders"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Load more orders" }));

    await waitFor(() => expect(screen.getByText("2 orders")).toBeInTheDocument());
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more orders" })).not.toBeInTheDocument();
  });

  it("notes truncated line items and points to the full order details instead of hiding them silently", () => {
    const customerWithTruncatedOrder = {
      ...customer,
      orders: {
        nodes: [{
          ...buildOrder("1"),
          lineItems: {
            nodes: [{ id: "li-1", name: "Ring", productId: null, quantity: 1, image: null, totalPrice: null }],
            pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
          },
        }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    } as unknown as ShopifyCustomerProfile;

    render(
      <ShopifyProfileShell
        customer={customerWithTruncatedOrder}
        activeTab="orders"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText(/Showing the first 1 items/)).toBeInTheDocument();
  });
});

describe("ShopifyProfileShell total spent (REV-14)", () => {
  it("sums each currency separately instead of mixing them into one number", () => {
    const customerWithMixedCurrencies = {
      ...customer,
      orders: {
        nodes: [
          { ...buildOrder("1"), totalPrice: { amount: "100.00", currencyCode: "USD" }, totalRefunded: { amount: "0.00", currencyCode: "USD" } },
          { ...buildOrder("2"), totalPrice: { amount: "100.00", currencyCode: "EUR" }, totalRefunded: { amount: "0.00", currencyCode: "EUR" } },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    } as unknown as ShopifyCustomerProfile;

    render(
      <ShopifyProfileShell
        customer={customerWithMixedCurrencies}
        activeTab="overview"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("US$100.00 + €100.00")).toBeInTheDocument();
    expect(screen.queryByText("US$200.00")).not.toBeInTheDocument();
    expect(screen.queryByText("€200.00")).not.toBeInTheDocument();
  });

  it("subtracts refunded amounts from the total instead of counting the full order price", () => {
    const customerWithRefund = {
      ...customer,
      orders: {
        nodes: [
          { ...buildOrder("1"), totalPrice: { amount: "100.00", currencyCode: "EUR" }, totalRefunded: { amount: "40.00", currencyCode: "EUR" } },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    } as unknown as ShopifyCustomerProfile;

    render(
      <ShopifyProfileShell
        customer={customerWithRefund}
        activeTab="overview"
        wishlistProducts={[]}
        sessionExpiresAt="2026-10-15T00:00:00.000Z"
      />,
    );

    expect(screen.getByText("€60.00")).toBeInTheDocument();
  });
});
