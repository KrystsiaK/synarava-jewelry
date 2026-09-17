import { render, screen } from "@testing-library/react";

import { TranslationProvider, useTranslations } from "../context";

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
});
