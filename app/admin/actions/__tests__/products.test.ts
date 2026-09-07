const mocks = vi.hoisted(() => ({
  findConflictingProduct: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: { findFirst: mocks.findConflictingProduct },
  },
}));

vi.mock("@/lib/media/local-upload", () => ({ saveProductImageUpload: vi.fn() }));
vi.mock("@/lib/s3", () => ({ getS3Bucket: vi.fn(), getS3PublicUrl: vi.fn() }));
vi.mock("@/lib/shopify/config", () => ({ isShopifyConfigured: vi.fn(() => false) }));
vi.mock("@/lib/shopify/product-sync", () => ({ deleteShopifyProduct: vi.fn() }));

import { saveProductAction } from "../products";

function validProductFormData() {
  const formData = new FormData();
  formData.set("name", "Existing ring");
  formData.set("slug", "existing-ring");
  formData.set("sku", "RING-1");
  formData.set("price", "125");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveProductAction", () => {
  it("rejects a create whose slug belongs to another product instead of overwriting it", async () => {
    mocks.findConflictingProduct.mockResolvedValue({
      id: "existing-product",
      slug: "existing-ring",
      sku: "OTHER-SKU",
    });

    await expect(saveProductAction(validProductFormData())).resolves.toMatchObject({
      error: "A product with this slug already exists.",
      fieldErrors: { slug: "A product with this URL slug already exists." },
    });
  });

  it("rejects a create whose SKU belongs to another product instead of overwriting it", async () => {
    mocks.findConflictingProduct.mockResolvedValue({
      id: "existing-product",
      slug: "another-ring",
      sku: "RING-1",
    });

    await expect(saveProductAction(validProductFormData())).resolves.toMatchObject({
      error: "A product with this SKU already exists.",
      fieldErrors: { sku: "A product with this SKU already exists." },
    });
  });
});
