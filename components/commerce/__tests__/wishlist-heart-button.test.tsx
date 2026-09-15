import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
}));

import { WishlistHeartButton } from "../wishlist-heart-button";

describe("WishlistHeartButton", () => {
  beforeEach(() => {
    navigation.push.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("redirects signed-out visitors to sign in and preserves the product return path", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/en/products/pearl-necklace?finish=gold");

    render(<WishlistHeartButton productSlug="pearl-necklace" isSignedIn={false} />);
    await user.click(screen.getByRole("button", { name: "Save to wishlist" }));

    expect(navigation.push).toHaveBeenCalledWith(
      "/en/login?redirectTo=%2Fen%2Fproducts%2Fpearl-necklace%3Ffinish%3Dgold",
    );
  });

  it("shows why a signed-in product could not be saved instead of failing silently", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, isSaved: false })))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ ok: false, error: "Wishlist access is unavailable." }),
        { status: 400 },
      ));

    render(<WishlistHeartButton productSlug="pearl-necklace" isSignedIn />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Save to wishlist" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wishlist access is unavailable.");
    expect(screen.getByRole("button", { name: "Save to wishlist" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("confirms a successful save with a filled Saved state", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, isSaved: false })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, isSaved: true })));

    render(<WishlistHeartButton productSlug="pearl-necklace" isSignedIn />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Save to wishlist" }));

    expect(await screen.findByRole("button", { name: "Remove from wishlist" })).toHaveTextContent("Saved");
  });

  it("does not let a late initial lookup overwrite a successful save", async () => {
    const user = userEvent.setup();
    let resolveInitialLookup: (response: Response) => void = () => undefined;
    const initialLookup = new Promise<Response>((resolve) => {
      resolveInitialLookup = resolve;
    });
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockReturnValueOnce(initialLookup)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, isSaved: true })));

    render(<WishlistHeartButton productSlug="pearl-necklace" isSignedIn />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Save to wishlist" }));
    expect(await screen.findByRole("button", { name: "Remove from wishlist" })).toHaveTextContent("Saved");

    await act(async () => {
      resolveInitialLookup(new Response(JSON.stringify({ ok: true, isSaved: false })));
      await initialLookup;
    });

    expect(screen.getByRole("button", { name: "Remove from wishlist" })).toHaveTextContent("Saved");
  });
});
