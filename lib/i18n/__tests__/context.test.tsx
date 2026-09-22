import { fireEvent, render, screen } from "@testing-library/react";
import { usePathname, useRouter } from "next/navigation";

import { TranslationProvider, useTranslations } from "../context";

const mockUsePathname = usePathname as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockUsePathname.mockReturnValue("/");
  window.history.replaceState({}, "", "/");
});

function CartLabel() {
  const { t, locale } = useTranslations();
  return <p>{locale}:{t("nav.cart")}</p>;
}

function SwitchButton() {
  const { setLocale } = useTranslations();
  return <button type="button" onClick={() => setLocale("pt")}>Switch</button>;
}

function SwitchToRussianButton() {
  const { setLocale } = useTranslations();
  return <button type="button" onClick={() => setLocale("ru")}>Switch to Russian</button>;
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

  it("renders the Russian dictionary on the first render", () => {
    mockUsePathname.mockReturnValue("/ru");
    render(<TranslationProvider initialLocale="ru"><CartLabel /></TranslationProvider>);

    expect(screen.getByText("ru:Корзина")).toBeInTheDocument();
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

  it("preserves the query string and hash when switching locale (REV-22)", () => {
    mockUsePathname.mockReturnValue("/en/shop");
    window.history.pushState({}, "", "/en/shop?collection=rings#featured");

    render(
      <TranslationProvider initialLocale="en">
        <SwitchButton />
      </TranslationProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    expect(useRouter().push).toHaveBeenCalledWith("/pt/shop?collection=rings#featured");
  });

  it("replaces a Russian route prefix when switching to Portuguese", () => {
    mockUsePathname.mockReturnValue("/ru/shop");
    render(<TranslationProvider initialLocale="ru"><SwitchButton /></TranslationProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    expect(useRouter().push).toHaveBeenCalledWith("/pt/shop");
  });

  it("switches from English to Russian without duplicating the route prefix", () => {
    mockUsePathname.mockReturnValue("/en/shop");
    render(<TranslationProvider initialLocale="en"><SwitchToRussianButton /></TranslationProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Switch to Russian" }));

    expect(useRouter().push).toHaveBeenCalledWith("/ru/shop");
  });
});
