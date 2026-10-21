#!/usr/bin/env node
/**
 * Draft a messages/<code>.json from English for a new storefront language.
 * Marks the file unreviewed — does not call any translation service.
 *
 * Usage: node scripts/generate-messages-locale.mjs <code>
 * Example: node scripts/generate-messages-locale.mjs de
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const code = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[a-z]{2}(-[a-z0-9]+)?$/i.test(code)) {
  console.error("Usage: node scripts/generate-messages-locale.mjs <locale-code>");
  process.exit(1);
}
if (code === "en") {
  console.error("Refusing to overwrite the English source dictionary.");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enPath = join(root, "messages", "en.json");
const outPath = join(root, "messages", `${code}.json`);

if (existsSync(outPath)) {
  console.error(`messages/${code}.json already exists — delete it first if you want a fresh draft.`);
  process.exit(1);
}

const en = JSON.parse(readFileSync(enPath, "utf8"));
const draft = {
  _synarava: {
    unreviewed: true,
    source: "en",
    generatedAt: new Date().toISOString(),
    note: "English draft. Review before publishing this language.",
  },
  ...en,
};

writeFileSync(outPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
console.log(`Wrote messages/${code}.json (unreviewed English draft).`);
console.log(
  "Register a static import in lib/i18n/message-catalog.ts so the client bundle includes it.",
);
