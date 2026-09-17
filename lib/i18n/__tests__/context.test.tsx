import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";

import { TranslationProvider, useTranslations } from "../context";

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

function CartLabel() {
  const { t, locale } = useTranslations();
  return <p>{locale}:{t("nav.cart")}</p>;
}

describe("TranslationProvider (REV-20)", () => {
  it("renders the Portuguese dictionary on the very first render, not just after a client fetch", () => {
    render(
      <TranslationProvider initialLocale="pt">
        <CartLabel />
      </TranslationProvider>,
    );

    expect(screen.getByText("pt:Carrinho")).toBeInTheDocument();
  });

  it("still renders English by default", () => {
    render(
      <TranslationProvider initialLocale="en">
        <CartLabel />
      </TranslationProvider>,
    );

    expect(screen.getByText("en:Cart")).toBeInTheDocument();
  });

  it("layers admin-editable overrides on top of the static dictionary", () => {
    render(
      <TranslationProvider initialLocale="pt" initialOverrides={{ en: {}, pt: { "nav.cart": "Sacola" } }}>
        <CartLabel />
      </TranslationProvider>,
    );

    expect(screen.getByText("pt:Sacola")).toBeInTheDocument();
  });

  it("follows the URL back to English after browser back navigation, not the last chosen locale (REV-21)", () => {
    mockUsePathname.mockReturnValue("/pt/shop");
    const { rerender } = render(
      <TranslationProvider initialLocale="pt">
        <CartLabel />
      </TranslationProvider>,
    );
    expect(screen.getByText("pt:Carrinho")).toBeInTheDocument();

    // Simulates the browser Back button: the router updates the pathname the
    // provider reads, without the provider (mounted once in the root layout)
    // ever remounting.
    mockUsePathname.mockReturnValue("/en/shop");
    rerender(
      <TranslationProvider initialLocale="pt">
        <CartLabel />
      </TranslationProvider>,
    );

    expect(screen.getByText("en:Cart")).toBeInTheDocument();
  });

  it("follows a direct client-side Link to a different locale route, not only the switcher", () => {
    mockUsePathname.mockReturnValue("/en");
    const { rerender } = render(
      <TranslationProvider initialLocale="en">
        <CartLabel />
      </TranslationProvider>,
    );
    expect(screen.getByText("en:Cart")).toBeInTheDocument();

    mockUsePathname.mockReturnValue("/pt");
    rerender(
      <TranslationProvider initialLocale="en">
        <CartLabel />
      </TranslationProvider>,
    );

    expect(screen.getByText("pt:Carrinho")).toBeInTheDocument();
  });
});
