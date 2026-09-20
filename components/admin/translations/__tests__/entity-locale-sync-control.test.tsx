import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EntityLocaleSyncControl } from "@/components/admin/translations/entity-locale-sync-control";

const scope = { entityType: "PRODUCT" as const, entityId: "product-1" };

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("EntityLocaleSyncControl", () => {
  it("checks the given locale on mount and shows the difference count", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ run: { status: "SUCCEEDED" }, differenceCount: 2 }),
    ));
    render(<EntityLocaleSyncControl scope={scope} locale="PT" />);

    expect(await screen.findByText("2 differences")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      expect.stringContaining("locale=pt-PT"),
    );
    const [, requestInit] = vi.mocked(fetch).mock.calls[0];
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("entityType=PRODUCT");
    expect(requestInit?.method).toBe("GET");
  });

  it("shows In sync with no Review link when nothing differs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ run: { status: "SUCCEEDED" }, differenceCount: 0 }),
    ));
    render(<EntityLocaleSyncControl scope={scope} locale="EN" />);

    expect(await screen.findByText("In sync")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review" })).not.toBeInTheDocument();
  });

  it("surfaces a fetch failure as an unavailable state instead of crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<EntityLocaleSyncControl scope={scope} locale="EN" />);

    expect(await screen.findByText("Check unavailable")).toBeInTheDocument();
  });

  it("runs a manual check via POST, then re-fetches the latest state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ run: { status: "SUCCEEDED" }, differenceCount: 1 }))
      .mockResolvedValueOnce(jsonResponse({ run: { status: "SUCCEEDED" } }))
      .mockResolvedValueOnce(jsonResponse({ run: { status: "SUCCEEDED" }, differenceCount: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<EntityLocaleSyncControl scope={scope} locale="PT" />);

    expect(await screen.findByText("1 difference")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check Portuguese against Shopify" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(await screen.findByText("In sync")).toBeInTheDocument();
  });
});
