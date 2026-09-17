import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  decreaseCartItemAction: vi.fn(),
  increaseCartItemAction: vi.fn(),
  removeCartItemAction: vi.fn(),
}));

vi.mock("@/app/[locale]/cart/actions", () => mocks);

import { CartItemRow } from "../cart-item-row";

const item = {
  id: "item-1",
  slug: "birch-bracelet",
  title: "Birch Bracelet",
  imageUrl: "/bracelet.jpg",
  materialLine: "Oak · Silver",
  quantity: 2,
  price: "€240",
  total: "€480",
};

describe("CartItemRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.decreaseCartItemAction.mockResolvedValue({ ok: true });
    mocks.increaseCartItemAction.mockResolvedValue({ ok: true });
    mocks.removeCartItemAction.mockResolvedValue({ ok: true });
  });

  it("renders item title", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByText("Birch Bracelet")).toBeInTheDocument();
  });

  it("renders material line", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByText("Oak · Silver")).toBeInTheDocument();
  });

  it("renders quantity", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders price and total", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByText("€240 each")).toBeInTheDocument();
    expect(screen.getByText("€480")).toBeInTheDocument();
  });

  it("renders product link", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/products/birch-bracelet");
  });

  it("renders remove button", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("renders increase and decrease buttons", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeInTheDocument();
  });

  it("explains when no more inventory is available", () => {
    render(<CartItemRow item={{ ...item, maxQuantity: 2 }} />);

    const increaseButton = screen.getByRole("button", { name: "Increase quantity" });
    expect(increaseButton).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    fireEvent.focus(increaseButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent("No more items available");
  });

  it("disables the other controls while a change is in flight (REV-11)", async () => {
    let resolveRemove!: (state: { ok: boolean }) => void;
    mocks.removeCartItemAction.mockReturnValue(new Promise((resolve) => { resolveRemove = resolve; }));
    const user = userEvent.setup();
    render(<CartItemRow item={item} />);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(screen.getByRole("button", { name: "Increase quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decrease quantity" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();

    resolveRemove({ ok: true });
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove" })).not.toBeDisabled());
  });

  it("surfaces an action failure instead of failing silently (REV-11)", async () => {
    mocks.increaseCartItemAction.mockResolvedValue({ ok: false, error: "Couldn't update this item." });
    const user = userEvent.setup();
    render(<CartItemRow item={item} />);

    await user.click(screen.getByRole("button", { name: "Increase quantity" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't update this item."));
  });
});
