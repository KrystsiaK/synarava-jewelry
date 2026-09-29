import { describe, expect, it } from "vitest";

import { isPublicHttpUrl } from "@/lib/security/is-public-http-url";

describe("isPublicHttpUrl", () => {
  it("allows public https hosts", () => {
    expect(isPublicHttpUrl("https://cdn.example.com/a.webp")).toBe(true);
    expect(isPublicHttpUrl("http://203.0.113.10/x.png")).toBe(true);
  });

  it("blocks private and local targets", () => {
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
    expect(isPublicHttpUrl("ftp://example.com/x")).toBe(false);
  });
});
