import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  setProductReviewStatus: vi.fn(),
  setProductReviewsSettings: vi.fn(),
  findMany: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));
vi.mock("@/lib/reviews/mutations", () => ({
  setProductReviewStatus: mocks.setProductReviewStatus,
}));
vi.mock("@/lib/reviews/settings", () => ({
  setProductReviewsSettings: mocks.setProductReviewsSettings,
}));
vi.mock("@/lib/db", () => ({
  db: { productReview: { findMany: mocks.findMany } },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefrontPath,
}));

import {
  moderateProductReviewsAction,
  saveProductReviewsSettingsAction,
} from "../reviews";

describe("admin review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ username: "admin" });
    mocks.setProductReviewStatus.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([{ product: { slug: "lava-ring" } }]);
    mocks.setProductReviewsSettings.mockResolvedValue({ moderationBeforePublish: true });
  });

  it("refuses moderation without a session", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    const formData = new FormData();
    formData.set("status", "PUBLISHED");
    formData.append("ids", "r1");
    await expect(moderateProductReviewsAction(formData)).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.setProductReviewStatus).not.toHaveBeenCalled();
  });

  it("publishes selected reviews when authenticated", async () => {
    const formData = new FormData();
    formData.set("status", "PUBLISHED");
    formData.append("ids", "r1");
    await expect(moderateProductReviewsAction(formData)).resolves.toMatchObject({
      updated: 1,
      success: expect.stringContaining("PUBLISHED"),
    });
    expect(mocks.setProductReviewStatus).toHaveBeenCalledWith({
      ids: ["r1"],
      status: "PUBLISHED",
      moderatedBy: "admin",
    });
  });

  it("saves moderation settings when authenticated", async () => {
    const formData = new FormData();
    // unchecked → false
    await expect(saveProductReviewsSettingsAction(formData)).resolves.toMatchObject({
      success: "Review settings saved.",
    });
    expect(mocks.setProductReviewsSettings).toHaveBeenCalledWith({
      moderationBeforePublish: false,
    });
  });
});
