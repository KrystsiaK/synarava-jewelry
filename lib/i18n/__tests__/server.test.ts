import { getServerTranslations } from "@/lib/i18n/server";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getStorefrontCopy: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/content/storefront-copy", () => ({ getStorefrontCopy: mocks.getStorefrontCopy }));
vi.mock("@/lib/content/commerce-copy", () => ({ getCommerceCopy: vi.fn(async () => ({})) }));

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers({ "x-locale": "ru" }));
  mocks.getStorefrontCopy.mockResolvedValue({});
});

describe("server translations", () => {
  it("renders Russian UI copy for a Russian request", async () => {
    const { locale, t } = await getServerTranslations();

    expect(locale).toBe("ru");
    expect(t("nav.cart")).toBe("Корзина");
  });

  it("uses an English fallback for keys missing from the partial Russian dictionary", async () => {
    const { t } = await getServerTranslations();

    // shop.allProducts is translated in ru.json; pick a key still EN-only.
    expect(t("footer.returns")).toBe("Returns");
  });

  it("translates PDP related and reviews chrome in Russian", async () => {
    const { t } = await getServerTranslations();

    expect(t("product.relatedTitle")).toBe("Вам также может понравиться");
    expect(t("reviews.title")).toBe("Отзывы покупателей");
    expect(t("reviews.shareTitle")).toBe("Поделитесь впечатлением");
    expect(t("reviews.signInCta")).toBe("Войти, чтобы оставить отзыв");
  });
});
