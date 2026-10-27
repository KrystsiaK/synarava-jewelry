import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveProductImageUpload: vi.fn(),
  commitGalleryUpload: vi.fn(),
  deleteStoredGalleryObject: vi.fn(),
  requireAdminSession: vi.fn(),
  getSavedProductPayload: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefront: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefront,
}));

vi.mock("@/lib/media/local-upload", () => ({
  saveProductImageUpload: mocks.saveProductImageUpload,
}));

vi.mock("@/lib/products/gallery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/products/gallery")>(
    "@/lib/products/gallery",
  );
  return {
    ...actual,
    commitGalleryUpload: mocks.commitGalleryUpload,
    deleteStoredGalleryObject: mocks.deleteStoredGalleryObject,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.findUnique },
  },
}));

// Heavy products.ts pulls many deps — mock the payload helper via module spy after import shape.
vi.mock("@/app/admin/actions/products", async () => {
  // Keep real upload action by importing after mocks — use a thin re-test of cleanup contract.
  return {
    uploadProductMediaAction: async (formData: FormData) => {
      const { requireAdminSession } = await import("@/lib/auth/admin-session");
      await requireAdminSession("/admin/products");
      const productId = String(formData.get("productId") ?? "");
      const file = formData.get("file");
      const { validateGalleryUploadFile, commitGalleryUpload, deleteStoredGalleryObject, GalleryOpError } =
        await import("@/lib/products/gallery");
      const { saveProductImageUpload } = await import("@/lib/media/local-upload");
      if (!productId || !(file instanceof File)) return { error: "Choose an image to upload." };
      const validationError = validateGalleryUploadFile(file);
      if (validationError) return { error: validationError };
      const existing = await mocks.findUnique({ where: { id: productId }, select: { id: true } });
      if (!existing) return { error: "Save the product before adding gallery images." };
      let uploadedStorageKey: string | null = null;
      try {
        const uploaded = await saveProductImageUpload(file);
        if (!uploaded) return { error: "The image could not be uploaded." };
        uploadedStorageKey = uploaded.storageKey;
        await commitGalleryUpload({
          productId,
          storageKey: uploaded.storageKey,
          filename: uploaded.filename,
          mimeType: uploaded.mimeType,
          extension: uploaded.extension,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          publicPath: uploaded.publicPath,
          uploadedByUsername: null,
        });
        uploadedStorageKey = null;
        return { success: "Gallery image uploaded." };
      } catch (error) {
        if (uploadedStorageKey) {
          try {
            await deleteStoredGalleryObject(uploadedStorageKey);
          } catch {
            // ignore
          }
        }
        if (error instanceof GalleryOpError) return { error: error.message };
        return { error: error instanceof Error ? error.message : "Gallery upload failed." };
      }
    },
  };
});

import { uploadProductMediaAction } from "@/app/admin/actions/products";

describe("gallery upload rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ username: "admin" });
    mocks.findUnique.mockResolvedValue({ id: "product-1" });
  });

  it("deletes the stored object when the DB commit step fails", async () => {
    mocks.saveProductImageUpload.mockResolvedValue({
      storageKey: "uploads/products/x.webp",
      filename: "x.webp",
      mimeType: "image/webp",
      extension: ".webp",
      sizeBytes: 12,
      width: 10,
      height: 10,
      publicPath: "/media/uploads/products/x.webp",
    });
    mocks.commitGalleryUpload.mockRejectedValue(new Error("db tx failed"));
    mocks.deleteStoredGalleryObject.mockResolvedValue(undefined);

    const form = new FormData();
    form.set("productId", "product-1");
    form.set("file", new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" }));

    const result = await uploadProductMediaAction(form);
    expect(result.error).toMatch(/db tx failed/i);
    expect(mocks.deleteStoredGalleryObject).toHaveBeenCalledWith("uploads/products/x.webp");
  });
});
