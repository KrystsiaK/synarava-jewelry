import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddToCartButton } from "../add-to-cart-button";

function setupFetch(payload: object, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: () => Promise.resolve(payload),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AddToCartButton", () => {
  it("renders Add to cart button initially", () => {
    render(<AddToCartButton productSlug="birch-bracelet" />);
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeInTheDocument();
  });

  it("shows Adding… while pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    );
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("Adding…");
  });

  it("disables button while pending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows success message after successful add", async () => {
    setupFetch({ ok: true, count: 3 });
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Piece added to cart")).toBeInTheDocument());
  });

  it("shows cart count after successful add", async () => {
    setupFetch({ ok: true, count: 3 });
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("3 pieces in cart")).toBeInTheDocument());
  });

  it("dispatches cart-updated event on success", async () => {
    setupFetch({ ok: true, count: 2 });
    const listener = vi.fn();
    window.addEventListener("synarava:cart-updated", listener);
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(listener).toHaveBeenCalled());
    window.removeEventListener("synarava:cart-updated", listener);
  });

  it("shows error message on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Network error")).toBeInTheDocument());
  });

  it("shows error message on API error payload", async () => {
    setupFetch({ ok: false, error: "Out of stock" }, false);
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Out of stock")).toBeInTheDocument());
  });

  it("re-enables button after response", async () => {
    setupFetch({ ok: true, count: 1 });
    const user = userEvent.setup();
    render(<AddToCartButton productSlug="birch-bracelet" />);
    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });
});
