#!/usr/bin/env node
/**
 * Generate a salted scrypt credential entry for SKU_API_CREDENTIALS and print
 * the plaintext token separately for SKU_API_TOKEN (Synarava web).
 *
 * Usage:
 *   node services/sku-api/scripts/generate-credentials.mjs synarava-shop
 *
 * Never commit the plaintext token. Store hash in SKU_API_CREDENTIALS only.
 */
import { randomBytes, scryptSync } from "node:crypto";

const workspaceKey =
  process.argv.slice(2).find((arg) => arg !== "--") ?? "synarava-shop";
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(workspaceKey)) {
  console.error(`Invalid workspace key: ${workspaceKey}`);
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const salt = randomBytes(16);
const hash = scryptSync(token, salt, 32).toString("hex");
const saltHex = salt.toString("hex");
const credentialsEntry = `${workspaceKey}:${saltHex}:${hash}`;

console.log("--- SKU_API_CREDENTIALS (sku-api Railway service; hashed) ---");
console.log(credentialsEntry);
console.log("");
console.log("--- SKU_API_TOKEN (synarava-web only; plaintext — copy once) ---");
console.log(token);
console.log("");
console.log("--- also set on synarava-web ---");
console.log(`SKU_API_WORKSPACE=${workspaceKey}`);
console.log("SKU_API_URL=<private Railway URL of sku-api, no trailing slash>");
console.log("");
console.log(
  "Do not put the plaintext token into SKU_API_CREDENTIALS or commit it to git.",
);
