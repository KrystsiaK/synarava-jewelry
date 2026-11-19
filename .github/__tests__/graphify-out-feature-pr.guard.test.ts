import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Feature PRs must not change graphify-out/.
 * AGENTS.md is canonical; CI job enforces with title + staging→main exceptions.
 */

const ROOT = process.cwd();
const AGENTS = join(ROOT, "AGENTS.md");
const CI_WORKFLOW = join(ROOT, ".github/workflows/ci.yml");

describe("forbid graphify-out in feature PRs", () => {
  const agents = readFileSync(AGENTS, "utf8");
  const ci = readFileSync(CI_WORKFLOW, "utf8");

  it("documents restore/unstage and maintainer refresh in AGENTS.md", () => {
    expect(agents).toContain("You MAY run `graphify update .` locally for queries.");
    expect(agents).toContain(
      "git restore --staged --worktree graphify-out",
    );
    expect(agents).toContain("git add -A -- . ':!graphify-out'");
    expect(agents).toContain("chore: refresh graphify");
    expect(agents).not.toMatch(
      /After modifying code,\s*run `graphify update \.`/,
    );
  });

  it("defines graphify-out-guard job with both exemptions", () => {
    expect(ci).toMatch(/^\s*graphify-out-guard:\s*$/m);
    expect(ci).toContain("Forbid graphify-out in feature PRs");
    expect(ci).toContain('"chore: refresh graphify"*');
    expect(ci).toContain('HEAD_REF" = "staging"');
    expect(ci).toContain('BASE_REF" = "main"');
    expect(ci).toContain("git diff --name-only");
    expect(ci).toContain("git restore --staged --worktree graphify-out");
  });
});
