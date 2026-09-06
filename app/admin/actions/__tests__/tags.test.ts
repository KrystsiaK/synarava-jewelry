const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  tagUpsert: vi.fn(),
  tagFindUnique: vi.fn(),
  tagDelete: vi.fn(),
  productTagCount: vi.fn(),
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
    tag: {
      upsert: mocks.tagUpsert,
      findUnique: mocks.tagFindUnique,
      delete: mocks.tagDelete,
    },
    productTag: {
      count: mocks.productTagCount,
    },
  },
}));

vi.mock("../shared", () => ({
  revalidateStorefront: mocks.revalidateStorefront,
  writeAuditLog: mocks.writeAuditLog,
}));

import { deleteTagAction, parseTags, saveTagAction } from "../tags";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const savedTag = {
  id: "tag-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  slug: "oak",
  name: "Oak",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tagUpsert.mockResolvedValue(savedTag);
  mocks.tagFindUnique.mockResolvedValue(savedTag);
});

describe("parseTags", () => {
  it("splits, slugifies, and dedupes a comma-separated list", () => {
    expect(parseTags("Oak, oak, Lava Stone")).toEqual(["oak", "lava-stone"]);
  });

  it("drops empty entries", () => {
    expect(parseTags("oak,, lava")).toEqual(["oak", "lava"]);
  });
});

describe("saveTagAction", () => {
  it("requires an admin session before touching the database", async () => {
    await saveTagAction(formData({ name: "Oak" }));
    expect(mocks.requireAdminSession).toHaveBeenCalledWith("/admin/products");
  });

  it("rejects a submission with no name", async () => {
    const result = await saveTagAction(formData({}));
    expect(result).toEqual({ error: "Tag name is required." });
    expect(mocks.tagUpsert).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only name", async () => {
    const result = await saveTagAction(formData({ name: "   " }));
    expect(result.error).toBe("Tag name is required.");
  });

  it("derives the slug from the name when no slug is given", async () => {
    await saveTagAction(formData({ name: "Lava Stone" }));
    expect(mocks.tagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ slug: "lava-stone", name: "Lava Stone" }),
      }),
    );
  });

  it("creates a new tag when no tagId is submitted", async () => {
    const result = await saveTagAction(formData({ name: "Oak" }));
    expect(mocks.tagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "oak" } }),
    );
    expect(result.success).toBe("Tag created.");
  });

  it("updates the existing tag when a tagId is submitted", async () => {
    const result = await saveTagAction(formData({ tagId: "tag-1", name: "Oak" }));
    expect(mocks.tagUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tag-1" } }),
    );
    expect(result.success).toBe("Tag updated.");
  });

  it("logs the mutation and revalidates storefront and admin paths", async () => {
    await saveTagAction(formData({ name: "Oak" }));
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.revalidateStorefront).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/products");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/tags");
  });
});

describe("deleteTagAction", () => {
  it("rejects a submission with no tagId", async () => {
    const result = await deleteTagAction(formData({}));
    expect(result).toEqual({ error: "Tag id is missing." });
    expect(mocks.tagDelete).not.toHaveBeenCalled();
  });

  it("deletes the tag and reports how many products were affected", async () => {
    mocks.productTagCount.mockResolvedValue(3);

    const result = await deleteTagAction(formData({ tagId: "tag-1" }));

    expect(mocks.tagDelete).toHaveBeenCalledWith({ where: { id: "tag-1" } });
    expect(result).toEqual({
      success: "Tag deleted and removed from products.",
      deletedTagId: "tag-1",
      affectedProducts: 3,
    });
  });
});
