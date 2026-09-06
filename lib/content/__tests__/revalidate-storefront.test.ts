const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "../revalidate-storefront";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revalidateStorefrontPath", () => {
  it("revalidates the path under every supported locale", () => {
    revalidateStorefrontPath("/shop");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/shop");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pt/shop");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("treats the bare root path as just the locale segment, not '/en/'", () => {
    revalidateStorefrontPath("/");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pt");
  });
});

describe("revalidateStorefrontTemplate", () => {
  it("revalidates a dynamic page template under every locale with the page type", () => {
    revalidateStorefrontTemplate("/products/[slug]");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/products/[slug]", "page");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/pt/products/[slug]", "page");
  });
});
