const mocks = vi.hoisted(() => ({
  getCurrentAdminSession: vi.fn(),
  uploadProductMediaAction: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  getCurrentAdminSession: mocks.getCurrentAdminSession,
}));

vi.mock("@/app/admin/actions/products", () => ({
  uploadProductMediaAction: mocks.uploadProductMediaAction,
}));

import { POST } from "../route";

describe("product media upload route", () => {
  it("rejects uploads without an admin session", async () => {
    mocks.getCurrentAdminSession.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/admin/api/products/media", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("parses multipart data and delegates an authenticated upload", async () => {
    mocks.getCurrentAdminSession.mockResolvedValue({ username: "admin" });
    mocks.uploadProductMediaAction.mockResolvedValue({ success: "Gallery image uploaded." });
    const body = new FormData();
    body.set("productId", "product-1");
    body.set("file", new File(["image bytes"], "photo.jpg", { type: "image/jpeg" }));

    const request = { formData: vi.fn().mockResolvedValue(body) } as unknown as Request;
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mocks.uploadProductMediaAction).toHaveBeenCalledWith(expect.any(FormData));
  });
});
