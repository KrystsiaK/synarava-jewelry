#!/usr/bin/env node
/**
 * Install repo-managed hooks into .git/hooks without changing git config.
 * Invoked from package.json `prepare` after pnpm install.
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gitDir = join(root, ".git");
const hooksSrc = join(root, ".githooks");
const hooksDst = join(gitDir, "hooks");

if (!existsSync(gitDir)) {
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
