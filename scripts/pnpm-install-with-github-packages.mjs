#!/usr/bin/env node
/**
 * Auth for @synarava GitHub Packages, then `pnpm install`.
 * Intended as Railway RAILPACK_INSTALL_CMD / CI helper.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const authScript = join(root, "scripts/ensure-github-packages-auth.mjs");

const auth = spawnSync(process.execPath, [authScript], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (auth.status !== 0) {
  process.exit(auth.status ?? 1);
}

const installArgs = process.argv.slice(2);
const args = installArgs.length > 0 ? installArgs : ["install", "--frozen-lockfile"];
const install = spawnSync("pnpm", args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  shell: false,
});
process.exit(install.status ?? 1);
