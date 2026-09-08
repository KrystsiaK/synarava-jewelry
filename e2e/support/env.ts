import { readFileSync } from "node:fs";

const ENV_FILE_NAMES = [".env.local", ".env"];

let loaded = false;

// Playwright's test process is plain Node -- it does not get the env loading
// Next.js does for local dev/build commands. Parse the same files by hand and
// populate process.env, without overwriting anything already set there
// (matches dotenv's precedence: real env vars win over file contents).
function loadEnvFiles() {
  if (loaded) return;
  loaded = true;

  for (const source of ENV_FILE_NAMES) {
    let contents = "";

    try {
      contents = readFileSync(source, "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

export function readEnvValue(key: string): string {
  loadEnvFiles();
  return process.env[key] ?? "";
}

export type AdminCredentials = { username: string; password: string };

export function adminCredentials(): AdminCredentials | null {
  const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
  const password = readEnvValue("ADMIN_PASSWORD");
  if (!username || !password) return null;
  return { username, password };
}

export function hasShopifySandbox(): boolean {
  const hasClientCredentials = Boolean(
    readEnvValue("SHOPIFY_CLIENT_ID") && readEnvValue("SHOPIFY_CLIENT_SECRET"),
  );
  return Boolean(
    readEnvValue("SHOPIFY_STORE_DOMAIN") &&
      (readEnvValue("SHOPIFY_ADMIN_ACCESS_TOKEN") || hasClientCredentials),
  );
}
