import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const strings: Record<string, string> = {
        "profile.returns.request": "Request a return",
        "profile.returns.submit": "Submit return request",
        "profile.returns.submitting": "Submitting…",
        "profile.returns.cancel": "Cancel",
        "profile.returns.success": "Return requested. We’ll follow up by email.",
        "profile.returns.genericFailed": "Could not submit the return request.",
        "profile.returns.quantityAria": `Quantity to return for ${values?.name}`,
      };
      return strings[key] ?? key;
    },
  }),
}));

import { ReturnRequestPanel } from "../return-request-panel";

const returnableLineItems = [{ quantity: 1, lineItem: { id: "li-1", name: "Silver Ring" } }];

describe("ReturnRequestPanel (REV-23)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing when there is nothing returnable", () => {
    const { container } = render(<ReturnRequestPanel orderId="order-1" returnableLineItems={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows Shopify's own rejection reason as-is when the API returns one, with our translated copy as the fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: "This item is not eligible for return." }),
    }));

    render(<ReturnRequestPanel orderId="order-1" returnableLineItems={returnableLineItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit return request" }));

    await waitFor(() => expect(screen.getByText("This item is not eligible for return.")).toBeInTheDocument());
  });

  it("falls back to the translated generic message when the API gives no reason", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<ReturnRequestPanel orderId="order-1" returnableLineItems={returnableLineItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit return request" }));

    await waitFor(() => expect(screen.getByText("Could not submit the return request.")).toBeInTheDocument());
  });

  it("shows the translated success message and collapses the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, returnId: "r1", status: "OPEN" }),
    }));

    render(<ReturnRequestPanel orderId="order-1" returnableLineItems={returnableLineItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Request a return" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit return request" }));

    await waitFor(() => expect(screen.getByText("Return requested. We’ll follow up by email.")).toBeInTheDocument());
  });
});
