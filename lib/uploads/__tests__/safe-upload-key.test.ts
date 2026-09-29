import { describe, expect, it } from "vitest";

import { isSafeUploadKey } from "@/lib/uploads/safe-upload-key";

describe("isSafeUploadKey", () => {
  it("accepts normal upload keys", () => {
    expect(isSafeUploadKey("uploads/collections/ring.webp")).toBe(true);
    expect(isSafeUploadKey(["uploads", "products", "a-b_1.webp"])).toBe(true);
  });

  it("rejects traversal and odd segments", () => {
    expect(isSafeUploadKey("uploads/../secret.webp")).toBe(false);
    expect(isSafeUploadKey(["uploads", "..", "secret.webp"])).toBe(false);
    expect(isSafeUploadKey("uploads/foo/bar/../x.webp")).toBe(false);
    expect(isSafeUploadKey("uploads/foo%2F..%2Fsecret")).toBe(false);
    expect(isSafeUploadKey("media/uploads/x.webp")).toBe(false);
    expect(isSafeUploadKey("uploads")).toBe(false);
  });
});
