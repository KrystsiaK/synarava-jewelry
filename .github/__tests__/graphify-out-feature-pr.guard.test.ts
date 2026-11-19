import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Feature PRs must not change graphify-out/.
 * AGENTS.md is canonical; CI job enforces with title + staging→main exceptions.
 * Three-dot diff ignores graphify-out commits that landed on base after the branch point.
 */

const ROOT = process.cwd();
const AGENTS = join(ROOT, "AGENTS.md");
const CI_WORKFLOW = join(ROOT, ".github/workflows/ci.yml");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "graphify-guard",
      GIT_AUTHOR_EMAIL: "graphify-guard@example.com",
      GIT_COMMITTER_NAME: "graphify-guard",
      GIT_COMMITTER_EMAIL: "graphify-guard@example.com",
    },
  }).trim();
}

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

  it("defines graphify-out-guard job with both exemptions and three-dot diff", () => {
    expect(ci).toMatch(/^\s*graphify-out-guard:\s*$/m);
    expect(ci).toContain("Forbid graphify-out in feature PRs");
    expect(ci).toContain('"chore: refresh graphify"*');
    expect(ci).toContain('HEAD_REF" = "staging"');
    expect(ci).toContain('BASE_REF" = "main"');
    expect(ci).toMatch(
      /git diff --name-only "\$BASE_SHA\.\.\.\$HEAD_SHA" -- 'graphify-out\/'/,
    );
    expect(ci).not.toMatch(
      /git diff --name-only "\$BASE_SHA" "\$HEAD_SHA" -- 'graphify-out\/'/,
    );
    expect(ci).toContain("git restore --staged --worktree graphify-out");
  });

  it("three-dot diff stays empty when only base advanced graphify-out", () => {
    const dir = mkdtempSync(join(tmpdir(), "graphify-out-guard-"));
    try {
      git(dir, "init");
      git(dir, "checkout", "-b", "main");
      writeFileSync(join(dir, "app.txt"), "v1\n");
      mkdirSync(join(dir, "graphify-out"), { recursive: true });
      writeFileSync(join(dir, "graphify-out", "graph.json"), "{}\n");
      git(dir, "add", ".");
      git(dir, "commit", "-m", "init");

      git(dir, "checkout", "-b", "feature");
      writeFileSync(join(dir, "app.txt"), "v2-feature\n");
      git(dir, "add", "app.txt");
      git(dir, "commit", "-m", "feature change without graphify-out");
      const headSha = git(dir, "rev-parse", "HEAD");

      git(dir, "checkout", "main");
      writeFileSync(join(dir, "graphify-out", "graph.json"), '{"refreshed":true}\n');
      git(dir, "add", "graphify-out/graph.json");
      git(dir, "commit", "-m", "chore: refresh graphify");
      const baseSha = git(dir, "rev-parse", "HEAD");

      const twoDot = git(
        dir,
        "diff",
        "--name-only",
        baseSha,
        headSha,
        "--",
        "graphify-out/",
      );
      const threeDot = git(
        dir,
        "diff",
        "--name-only",
        `${baseSha}...${headSha}`,
        "--",
        "graphify-out/",
      );

      expect(twoDot).toContain("graphify-out/graph.json");
      expect(threeDot).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
