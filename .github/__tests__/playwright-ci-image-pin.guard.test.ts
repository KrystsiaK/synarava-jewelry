import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Storefront smoke runs inside the official Playwright Docker
 * image. @playwright/test in package.json must match that image tag exactly
 * (x.y.z), or smoke fails with "required: mcr.microsoft.com/playwright:v…".
 */

const PACKAGE_JSON = join(process.cwd(), "package.json");
const CI_WORKFLOW = join(process.cwd(), ".github/workflows/ci.yml");
const IMAGE_RE = /mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-jammy/g;

function packagePlaywrightVersion(): string {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8")) as {
    devDependencies?: Record<string, string>;
  };
  const raw = pkg.devDependencies?.["@playwright/test"];
  if (typeof raw !== "string") {
    throw new Error("@playwright/test missing from package.json devDependencies");
  }
  const match = raw.match(/\d+\.\d+\.\d+/);
  if (!match) {
    throw new Error(`unparseable @playwright/test version: ${raw}`);
  }
  return match[0];
}

function ciImagePlaywrightVersion(): string {
  const src = readFileSync(CI_WORKFLOW, "utf8");
  const matches = [...src.matchAll(IMAGE_RE)];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one Playwright CI image pin in ci.yml, found ${matches.length}`,
    );
  }
  return matches[0][1];
}

describe("Playwright package ↔ CI image pin", () => {
  it("keeps @playwright/test and mcr playwright image on the same x.y.z", () => {
    expect(ciImagePlaywrightVersion()).toBe(packagePlaywrightVersion());
  });
});
