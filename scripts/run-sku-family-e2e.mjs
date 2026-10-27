#!/usr/bin/env node
/**
 * Ephemeral admin + SKU mock process env for playwright.sku-family.config.ts.
 * Credentials stay in the child process only.
 */
import { spawnSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";

const password = "e2e-SkuFamily-Pass1";
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
const passwordHash = `${salt}:${hash}`;

const env = {
  ...process.env,
  ADMIN_USERNAME: "e2e-admin",
  ADMIN_PASSWORD: password,
  ADMIN_PASSWORD_HASH: passwordHash,
  ADMIN_SESSION_SECRET: "e2e-admin-session-secret-min-32-chars-xx",
  SKU_API_URL: "http://127.0.0.1:4099",
  SKU_API_TOKEN: "e2e-sku-token-min8",
  SKU_API_WORKSPACE: "synarava-shop",
};

const args = process.argv.slice(2);
const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", "-c", "playwright.sku-family.config.ts", ...args],
  { env, stdio: "inherit", shell: false },
);
process.exit(result.status ?? 1);
