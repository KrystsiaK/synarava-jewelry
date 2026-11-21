#!/usr/bin/env node
/**
 * Launcher for the TypeScript bench runner (imports `@/lib/ai/**` via vite-node).
 * Usage: node scripts/ai/bench/run.mjs [productId ...]
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
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
    join(root, "scripts/ai/bench/run.ts"),
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
