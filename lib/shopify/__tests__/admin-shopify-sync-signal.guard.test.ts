import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AdminShopifySyncSignal source guard", () => {
  it("checks requestError before the !run branch and resets run on poll catch", () => {
    const source = readFileSync(
      path.join(process.cwd(), "components/admin/translations/admin-shopify-sync-signal.tsx"),
      "utf8",
    );
    const errorIdx = source.indexOf("if (requestError");
    const runIdx = source.indexOf("if (!run || isActiveRunStatus");
    expect(errorIdx).toBeGreaterThan(-1);
    expect(runIdx).toBeGreaterThan(-1);
    expect(errorIdx).toBeLessThan(runIdx);
    expect(source).toContain("setRun(null)");
    expect(source).toMatch(/poll failure/i);
  });
});
