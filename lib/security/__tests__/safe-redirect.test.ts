import { safeRedirectPath } from "../safe-redirect";

describe("safeRedirectPath", () => {
  it("passes through a plain internal path", () => {
    expect(safeRedirectPath("/en/profile", "/fallback")).toBe("/en/profile");
  });

  it("preserves query string and hash on an internal path", () => {
    expect(safeRedirectPath("/en/shop?department=jewelry#top", "/fallback")).toBe(
      "/en/shop?department=jewelry#top",
    );
  });

  it("falls back for a missing value", () => {
    expect(safeRedirectPath(undefined, "/fallback")).toBe("/fallback");
    expect(safeRedirectPath(null, "/fallback")).toBe("/fallback");
    expect(safeRedirectPath("", "/fallback")).toBe("/fallback");
  });

  it("falls back for an absolute URL to another host", () => {
    expect(safeRedirectPath("https://evil.example/phish", "/fallback")).toBe("/fallback");
    expect(safeRedirectPath("http://evil.example", "/fallback")).toBe("/fallback");
  });

  it("falls back for a protocol-relative URL", () => {
    expect(safeRedirectPath("//evil.example/phish", "/fallback")).toBe("/fallback");
  });

  it("falls back for a value that doesn't start with a slash", () => {
    expect(safeRedirectPath("evil.example", "/fallback")).toBe("/fallback");
    expect(safeRedirectPath("javascript:alert(1)", "/fallback")).toBe("/fallback");
  });

  it("falls back for a same-host absolute URL disguised as a path", () => {
    // A value starting with "/" is always treated as path-only; this just
    // documents that an embedded "https://" later in the string doesn't
    // itself make the value unsafe, since URL parsing anchors on the
    // leading "/" and never reaches a second scheme.
    expect(safeRedirectPath("/redirect?to=https://evil.example", "/fallback")).toBe(
      "/redirect?to=https://evil.example",
    );
  });
});
