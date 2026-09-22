import { getServerTranslations } from "@/lib/i18n/server";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getStorefrontCopy: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/content/storefront-copy", () => ({ getStorefrontCopy: mocks.getStorefrontCopy }));

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

    expect(t("shop.departments")).toBe("Departments");
  });
});
