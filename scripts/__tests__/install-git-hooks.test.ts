import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it, afterEach } from "vitest";

const ROOT = process.cwd();
const INSTALL_SCRIPT = join(ROOT, "scripts/install-git-hooks.mjs");
const PRE_PUSH_SRC = join(ROOT, ".githooks/pre-push");

const temps: string[] = [];

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "synarava-hooks-"));
  temps.push(dir);
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  mkdirSync(join(dir, ".githooks"), { recursive: true });
  writeFileSync(join(dir, ".githooks/pre-push"), readFileSync(PRE_PUSH_SRC));
  writeFileSync(join(dir, "scripts/install-git-hooks.mjs"), readFileSync(INSTALL_SCRIPT));
  return dir;
}

describe("install-git-hooks.mjs", () => {
  it("installs pre-push into a normal .git/hooks directory", () => {
    const dir = makeTempRepo();
    execFileSync(process.execPath, ["scripts/install-git-hooks.mjs"], {
      cwd: dir,
      stdio: "ignore",
    });
    const hooksDir = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
      cwd: dir,
      encoding: "utf8",
    }).trim();
    const absoluteHooks = hooksDir.startsWith("/") ? hooksDir : join(dir, hooksDir);
    expect(existsSync(join(absoluteHooks, "pre-push"))).toBe(true);
  });

  it("installs pre-push when .git is a worktree gitfile", () => {
    const main = makeTempRepo();
    execFileSync("git", ["commit", "--allow-empty", "-m", "init"], {
      cwd: main,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@example.com",
      },
    });

    const worktree = join(main, "linked-worktree");
    execFileSync("git", ["worktree", "add", "--detach", worktree], {
      cwd: main,
      stdio: "ignore",
    });

    mkdirSync(join(worktree, ".githooks"), { recursive: true });
    mkdirSync(join(worktree, "scripts"), { recursive: true });
    writeFileSync(join(worktree, ".githooks/pre-push"), readFileSync(PRE_PUSH_SRC));
    writeFileSync(join(worktree, "scripts/install-git-hooks.mjs"), readFileSync(INSTALL_SCRIPT));

    // Worktree: .git is a file, not a directory — old path join(root, ".git/hooks") breaks.
    expect(existsSync(join(worktree, ".git"))).toBe(true);
    const gitStat = readFileSync(join(worktree, ".git"), "utf8");
    expect(gitStat.startsWith("gitdir:")).toBe(true);

    execFileSync(process.execPath, ["scripts/install-git-hooks.mjs"], {
      cwd: worktree,
      stdio: "ignore",
    });

    const hooksDir = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
      cwd: worktree,
      encoding: "utf8",
    }).trim();
    const absoluteHooks = hooksDir.startsWith("/") ? hooksDir : join(worktree, hooksDir);
    expect(existsSync(join(absoluteHooks, "pre-push"))).toBe(true);
  });
});
