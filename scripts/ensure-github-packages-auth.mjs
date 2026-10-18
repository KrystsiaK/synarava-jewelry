#!/usr/bin/env node
/**
 * Write GitHub Packages auth into the user-level ~/.npmrc.
 *
 * pnpm refuses to expand ${NODE_AUTH_TOKEN} from a committed project .npmrc
 * (credential leak risk). Call this before `pnpm install` whenever NODE_AUTH_TOKEN
 * is available (local, CI, Railway, Cloud Agent).
 *
 * @see https://pnpm.io/npmrc
 * @see docs/runbooks/deploy.md
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const AUTH_LINE = "//npm.pkg.github.com/:_authToken=";
const token = process.env.NODE_AUTH_TOKEN?.trim();

if (!token) {
  console.error(
    "ensure-github-packages-auth: NODE_AUTH_TOKEN is missing. " +
      "@synarava/* installs from GitHub Packages will 401.",
  );
  process.exit(1);
}

const npmrcPath = join(homedir(), ".npmrc");
const existing = existsSync(npmrcPath) ? readFileSync(npmrcPath, "utf8") : "";
const nextLine = `${AUTH_LINE}${token}`;

const lines = existing
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith(AUTH_LINE));
lines.push(nextLine);

writeFileSync(npmrcPath, `${lines.join("\n")}\n`, { mode: 0o600 });
console.log("ensure-github-packages-auth: wrote GitHub Packages auth to ~/.npmrc");
