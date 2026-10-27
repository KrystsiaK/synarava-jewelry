import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Automerge to staging must not auto-merge Dependabot production
 * deps or majors — only the development-dependencies group (patch/minor).
 */

const WORKFLOW = join(process.cwd(), ".github/workflows/automerge-staging.yml");

describe("automerge-staging Dependabot gate", () => {
  const src = readFileSync(WORKFLOW, "utf8");

  it("gates Dependabot to development-dependencies and lists required checks", () => {
    expect(src).toContain("dependabot[bot]");
    expect(src).toContain("development-dependencies");
    expect(src).toContain("production-dependencies");
    expect(src).toContain("Refuse Dependabot automerge for production dependencies");
    expect(src).toContain("Quality Gates");
    expect(src).toContain("Storefront smoke (desktop and mobile)");
    expect(src).toContain("Path filter");
    expect(src).toContain("SKU Quality Gates");
    expect(src).toContain("gh pr merge");
    expect(src).toContain("--auto");
  });
});
