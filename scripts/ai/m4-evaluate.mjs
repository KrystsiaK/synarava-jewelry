#!/usr/bin/env node
/**
 * M4 evaluate launcher — production generateProductContent with dryRun (no AuditLog).
 * Usage: node scripts/ai/m4-evaluate.mjs [productId ...]
 *
 * Requires AI_CONTENT_ENABLED=1 and GEMINI_API_KEY for live calls.
 * Writes docs/ai/m4-results.md (machine metrics + empty owner columns).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "package.json"));

function resolveViteNode() {
  const vitestPkg = require.resolve("vitest/package.json");
  const fromVitest = createRequire(vitestPkg);
  return fromVitest.resolve("vite-node/vite-node.mjs");
}

let viteNodeBin;
try {
  viteNodeBin = resolveViteNode();
} catch (error) {
  console.error(
    "vite-node not found via vitest. Install deps or run: pnpm install",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    viteNodeBin,
    "--config",
    join(root, "vitest.config.ts"),
    join(root, "scripts/ai/m4-evaluate.ts"),
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
