import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  decodeBase64UrlJsonCursor,
  encodeBase64UrlJsonCursor,
} from "@/lib/cursor/base64url-json-cursor";

describe("base64url JSON cursor (DEAD-005)", () => {
  it("round-trips fp + id", () => {
    const encoded = encodeBase64UrlJsonCursor({ fp: "q1", id: "row-1" });
    expect(decodeBase64UrlJsonCursor(encoded, "q1")).toBe("row-1");
  });

  it("rejects wrong fingerprint, missing, or malformed input", () => {
    const encoded = encodeBase64UrlJsonCursor({ fp: "q1", id: "row-1" });
    expect(decodeBase64UrlJsonCursor(encoded, "other")).toBeNull();
    expect(decodeBase64UrlJsonCursor(null, "q1")).toBeNull();
    expect(decodeBase64UrlJsonCursor("not-base64-json", "q1")).toBeNull();
  });

  it("admin list-products and catalog shop-query use the shared helper (no copies)", () => {
    const root = process.cwd();
    const admin = readFileSync(join(root, "lib/admin/list-products.ts"), "utf8");
    const catalog = readFileSync(join(root, "lib/catalog/shop-query.ts"), "utf8");
    expect(admin).toMatch(/encodeBase64UrlJsonCursor|decodeBase64UrlJsonCursor/);
    expect(catalog).toMatch(/encodeBase64UrlJsonCursor|decodeBase64UrlJsonCursor/);
    expect(admin).not.toMatch(/\.toString\("base64url"\)/);
    expect(catalog).not.toMatch(/\.toString\("base64url"\)/);
    expect(admin).not.toMatch(/Buffer\.from\(raw,\s*"base64url"\)/);
    expect(catalog).not.toMatch(/Buffer\.from\(raw,\s*"base64url"\)/);
  });
});
