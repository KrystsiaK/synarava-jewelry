const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  findUniquePost: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/admin-session", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: vi.fn(),
  revalidateStorefrontTemplate: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { post: { findUnique: mocks.findUniquePost } },
}));
vi.mock("@/lib/media/local-upload", () => ({ savePageImageUpload: vi.fn() }));
vi.mock("@/lib/s3", () => ({ getS3Bucket: vi.fn(), getS3PublicUrl: vi.fn() }));

import { savePostAction } from "@/app/admin/actions/posts";

describe("savePostAction", () => {
  it("explains which locale blocks publication", async () => {
    const formData = new FormData();
    formData.set("slug", "studio-story");
    formData.set("workflowState", "PUBLISHED");
    formData.set("enTitle", "Studio story");
    formData.set("enExcerpt", "A short story.");
    formData.set("enBody", "The full story.");
    formData.set("enReviewed", "1");
    formData.set("ptTitle", "História do atelier");

    await expect(savePostAction(formData)).resolves.toEqual({
      error: "Cannot publish yet: Portuguese excerpt, Portuguese body, Portuguese review.",
    });
  });
});
