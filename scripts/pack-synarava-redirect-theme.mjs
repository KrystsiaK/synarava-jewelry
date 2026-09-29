#!/usr/bin/env node
/**
 * Build an uploadable ZIP for Online Store → Themes → Add theme → Upload zip.
 * Usage: node scripts/pack-synarava-redirect-theme.mjs
 */
import { mkdirSync, rmSync, createWriteStream, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const themeDir = join(root, "shopify/themes/synarava-redirect");
const distDir = join(themeDir, "dist");
const zipPath = join(distDir, "synarava-redirect-theme.zip");

if (!existsSync(themeDir)) {
  console.error("Theme directory missing:", themeDir);
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
rmSync(zipPath, { force: true });

const zip = spawnSync(
  "zip",
  [
    "-r",
    zipPath,
    ".",
    "-x",
    "dist/*",
    "-x",
    "node_modules/*",
    "-x",
    ".git/*",
    "-x",
    "*.md",
    "-x",
    "UPSTREAM_SHA.txt",
    "-x",
    "package.json",
  ],
  { cwd: themeDir, encoding: "utf8" },
);

if (zip.status !== 0) {
  console.error(zip.stderr || zip.stdout || "zip failed");
  process.exit(zip.status ?? 1);
}

console.log("Wrote", zipPath);
console.log("Upload in Shopify Admin → Online Store → Themes → Add theme → Upload zip file.");
console.log("Keep as unpublished draft until production Buy again validation passes.");
