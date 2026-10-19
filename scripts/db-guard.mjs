#!/usr/bin/env node
/**
 * Runs `prisma <args>` only against a local database.
 *
 * `migrate dev` and `db push` can drop schemas or tables, and Prisma always wipes
 * its shadow database. They must never reach production, so every database URL
 * Prisma could use (DATABASE_URL, DIRECT_URL, SHADOW_DATABASE_URL and a
 * --shadow-database-url flag) has to point at localhost. Anything else fails closed.
 *
 * `migrate deploy` is intentionally not wrapped: it only applies existing
 * migrations and runs on Railway pre-deploy.
 *
 * Wrapping package.json scripts does not stop a raw `npx prisma migrate dev`;
 * that path is covered by the agent shell hooks.
 */
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDbUrl(value) {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function findRemoteUrls(args, env) {
  const urls = [env.DATABASE_URL, env.DIRECT_URL, env.SHADOW_DATABASE_URL];
  args.forEach((arg, i) => {
    if (arg.startsWith("--shadow-database-url=")) {
      urls.push(arg.slice("--shadow-database-url=".length));
    } else if (arg === "--shadow-database-url") {
      urls.push(args[i + 1]);
    }
  });
  return urls.filter(Boolean).filter((url) => !isLocalDbUrl(url));
}

function main() {
  // Prisma also loads the default environment file and never overrides variables
  // that are already set, so load it the same way before checking.
  try {
    process.loadEnvFile();
  } catch {
    // no default environment file
  }

  const args = process.argv.slice(2);
  if (!process.env.DATABASE_URL || findRemoteUrls(args, process.env).length > 0) {
    console.error(
      // Only the subcommand is printed: other arguments may carry credentials.
      `db-guard: refusing "prisma ${args.slice(0, 2).join(" ")}". DATABASE_URL must be set and every ` +
        "database URL (DATABASE_URL, DIRECT_URL, SHADOW_DATABASE_URL, --shadow-database-url) " +
        "must point to localhost. Use a local or throwaway database.",
    );
    process.exit(1);
  }

  const result = spawnSync("pnpm", ["exec", "prisma", ...args], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
