import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  getS3Bucket: vi.fn(() => "synarava-media"),
}));

vi.mock("@/lib/s3", () => ({
  getS3: () => ({ send: mocks.send }),
  getS3Bucket: mocks.getS3Bucket,
}));

import { adminMediaExists } from "@/lib/admin/issues";

describe("adminMediaExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats /media/uploads paths as S3 objects, not public/ files", async () => {
    mocks.send.mockResolvedValue({});

    await expect(
      adminMediaExists("/media/uploads/collections/dsc-6301-1b5f1e41.webp"),
    ).resolves.toBe(true);

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "synarava-media",
          Key: "uploads/collections/dsc-6301-1b5f1e41.webp",
        }),
      }),
    );
  });

  it("returns false when the S3 object is missing", async () => {
    mocks.send.mockRejectedValue(Object.assign(new Error("NoSuchKey"), { $metadata: { httpStatusCode: 404 } }));

    await expect(
      adminMediaExists("/media/uploads/collections/missing.webp"),
    ).resolves.toBe(false);
  });

  it("rejects path traversal in /media/ keys", async () => {
    await expect(adminMediaExists("/media/uploads/../secret.webp")).resolves.toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
