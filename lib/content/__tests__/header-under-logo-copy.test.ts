import { describe, expect, it } from "vitest";

import { STOREFRONT_COPY_GROUPS } from "@/lib/content/storefront-copy-fields";
import { HEADER_UNDER_LOGO_BY_LOCALE } from "@/lib/seo/home-seo-defaults";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";

describe("header under logo (brand.curatedGoods)", () => {
  it("is editable under Shared → Header, not Footer tagline", () => {
    const header = STOREFRONT_COPY_GROUPS.find((group) => group.id === "header-chrome");
    const footer = STOREFRONT_COPY_GROUPS.find((group) => group.id === "footer-brand");
    expect(header?.fields.some((field) => field.key === "brand.curatedGoods")).toBe(true);
    expect(header?.fields.find((field) => field.key === "brand.curatedGoods")?.label).toBe(
      "Header under logo",
    );
    expect(footer?.fields.some((field) => field.key === "brand.curatedGoods")).toBe(false);
    expect(footer?.fields.some((field) => field.key === "footer.tagline")).toBe(true);
  });

  it("ships EN/PT/RU jewellery defaults", () => {
    expect(en.brand.curatedGoods).toBe(HEADER_UNDER_LOGO_BY_LOCALE.en);
    expect(pt.brand.curatedGoods).toBe(HEADER_UNDER_LOGO_BY_LOCALE.pt);
    expect(ru.brand.curatedGoods).toBe(HEADER_UNDER_LOGO_BY_LOCALE.ru);
  });
});
