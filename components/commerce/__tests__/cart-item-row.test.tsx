import { render, screen } from "@testing-library/react";

vi.mock("@/app/cart/actions", () => ({
  decreaseCartItemAction: vi.fn(),
  increaseCartItemAction: vi.fn(),
  removeCartItemAction: vi.fn(),
}));

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
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/birch-bracelet");
  });

  it("renders remove button", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("renders increase and decrease buttons", () => {
    render(<CartItemRow item={item} />);
    expect(screen.getByRole("button", { name: "+" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "-" })).toBeInTheDocument();
  });
});
