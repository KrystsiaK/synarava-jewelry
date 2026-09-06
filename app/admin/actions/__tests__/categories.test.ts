const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  categoryUpsert: vi.fn(),
  categoryFindUnique: vi.fn(),
  categoryDelete: vi.fn(),
  productCount: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    productCategory: {
      upsert: mocks.categoryUpsert,
      findUnique: mocks.categoryFindUnique,
      delete: mocks.categoryDelete,
    },
    product: {
      count: mocks.productCount,
    },
  },
}));

vi.mock("../shared", () => ({
  revalidateStorefront: mocks.revalidateStorefront,
  writeAuditLog: mocks.writeAuditLog,
}));

import { deleteCategoryAction, saveCategoryAction } from "../categories";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const savedCategory = {
  id: "cat-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  slug: "rings",
  name: "Rings",
  description: null,
  sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.categoryUpsert.mockResolvedValue(savedCategory);
  mocks.categoryFindUnique.mockResolvedValue(savedCategory);
});

describe("saveCategoryAction", () => {
  it("rejects a submission with no name", async () => {
    const result = await saveCategoryAction(formData({}));
    expect(result).toEqual({ error: "Category name is required." });
    expect(mocks.categoryUpsert).not.toHaveBeenCalled();
  });

  it("derives the slug from the name when no slug is given", async () => {
    await saveCategoryAction(formData({ name: "Lava Stone Rings" }));
    expect(mocks.categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ slug: "lava-stone-rings" }),
      }),
    );
  });

  it("falls back to 0 for a non-numeric sortOrder instead of writing NaN", async () => {
    await saveCategoryAction(formData({ name: "Rings", sortOrder: "not-a-number" }));
    expect(mocks.categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sortOrder: 0 }),
      }),
    );
  });

  it("parses a valid sortOrder", async () => {
    await saveCategoryAction(formData({ name: "Rings", sortOrder: "5" }));
    expect(mocks.categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ sortOrder: 5 }),
      }),
    );
  });

  it("creates vs. updates based on whether categoryId is present", async () => {
    await saveCategoryAction(formData({ name: "Rings" }));
    expect(mocks.categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "rings" } }),
    );

    await saveCategoryAction(formData({ categoryId: "cat-1", name: "Rings" }));
    expect(mocks.categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cat-1" } }),
    );
  });
});

describe("deleteCategoryAction", () => {
  it("rejects a submission with no categoryId", async () => {
    const result = await deleteCategoryAction(formData({}));
    expect(result).toEqual({ error: "Category id is missing." });
    expect(mocks.categoryDelete).not.toHaveBeenCalled();
  });

  it("deletes the category and reports affected products", async () => {
    mocks.productCount.mockResolvedValue(7);

    const result = await deleteCategoryAction(formData({ categoryId: "cat-1" }));

    expect(mocks.categoryDelete).toHaveBeenCalledWith({ where: { id: "cat-1" } });
    expect(result).toEqual({
      success: "Category deleted. Products that used it now have no category.",
      deletedCategoryId: "cat-1",
      affectedProducts: 7,
    });
  });
});
