#!/usr/bin/env node
/**
 * Install repo-managed hooks into the git hooks directory without changing git config.
 * Invoked from package.json `prepare` after pnpm install.
 *
 * Uses `git rev-parse --git-path hooks` so worktrees work (.git is a file there).
 * @see https://git-scm.com/docs/git-rev-parse#Documentation/git-rev-parse.txt---git-pathltpathgt
 */
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hooksSrc = join(root, ".githooks");

function resolveHooksDir(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd,
      stdio: "ignore",
    });
  } catch {
    return null;
  }

  const raw = execFileSync("git", ["rev-parse", "--git-path", "hooks"], {
    cwd,
    encoding: "utf8",
  }).trim();

  if (!raw) return null;
  return isAbsolute(raw) ? raw : join(cwd, raw);
}

const hooksDst = resolveHooksDir(root);
if (!hooksDst) {
  process.exit(0);
}

mkdirSync(hooksDst, { recursive: true });

for (const name of ["pre-push"]) {
  const from = join(hooksSrc, name);
  const to = join(hooksDst, name);
  if (!existsSync(from)) continue;
  copyFileSync(from, to);
  chmodSync(to, 0o755);
  console.log(`installed git hook: ${name}`);
}
