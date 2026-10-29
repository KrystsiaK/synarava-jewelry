/**
 * Guard: footer decorative wordmark must stay near-invisible (~0.05 light / ~0.04 dark).
 * Processes CSS through PostCSS + Tailwind + LightningCSS minify (same toolchain as builds).
 * No network, no secrets.
 */
import { realpathSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const GLOBALS = join(ROOT, "app/globals.css");

function toolchainRequire() {
  const twPostcssRoot = realpathSync(join(ROOT, "node_modules/@tailwindcss/postcss"));
  return createRequire(join(twPostcssRoot, "package.json"));
}

function alphaFromColor(value: string): number | null {
  const v = value.trim().toLowerCase();
  const rgba = v.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgba) return rgba[4] === undefined ? 1 : Number(rgba[4]);

  const hex = v.match(/^#([0-9a-f]{8})$/i);
  if (hex) return Number.parseInt(hex[1].slice(6, 8), 16) / 255;

  const hex6 = v.match(/^#([0-9a-f]{6})$/i);
  if (hex6) return 1;

  const hex4 = v.match(/^#([0-9a-f]{4})$/i);
  if (hex4) {
    const a = hex4[1][3];
    return Number.parseInt(a + a, 16) / 255;
  }

  return null;
}

function firstDecl(css: string, selector: string, prop: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  if (!block) return null;
  const m = block[1].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"));
  return m?.[1]?.trim() ?? null;
}

function resolveColor(css: string, colorValue: string, theme: "light" | "dark"): string {
  const varMatch = colorValue.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  if (!varMatch) return colorValue;

  const name = varMatch[1];
  const darkChunks = css.split(/html\[data-theme=["']?dark["']?\]\s*\{/);
  if (theme === "dark") {
    for (const chunk of darkChunks.slice(1)) {
      const body = chunk.split("}")[0] ?? "";
      const darkDecl = body.match(new RegExp(`${name}\\s*:\\s*([^;]+)`));
      if (darkDecl) return darkDecl[1].trim();
    }
  }

  const lightCss = darkChunks[0] ?? css;
  const decls = [...lightCss.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, "g"))].map(
    (m) => m[1].trim(),
  );
  expect(decls.length).toBeGreaterThan(0);
  return decls[decls.length - 1]!;
}

async function processGlobalsCss(): Promise<string> {
  const req = toolchainRequire();
  const postcss = req("postcss") as typeof import("postcss");
  const tailwindMod = await import(
    pathToFileURL(req.resolve("@tailwindcss/postcss")).href
  );
  const tailwind = (tailwindMod.default ?? tailwindMod) as import("postcss").AcceptedPlugin;
  const { transform } = req("lightningcss") as typeof import("lightningcss");

  const input = readFileSync(GLOBALS, "utf8");
  const result = await postcss.default([tailwind]).process(input, { from: GLOBALS });
  const min = transform({
    filename: "globals.css",
    code: Buffer.from(result.css),
    minify: true,
  });
  return min.code.toString();
}

describe("footer wordmark fade guard", () => {
  it("footer wordmark color resolves to ~0.05 light and ~0.04 dark after CSS build", async () => {
    const css = await processGlobalsCss();

    const colorDecl = firstDecl(css, ".artifact-footer__wordmark", "color");
    expect(colorDecl).toBeTruthy();
    expect(colorDecl).not.toMatch(
      /#19151280|#fff6\b|rgba\(\s*25\s*,\s*21\s*,\s*18\s*,\s*0\.5\s*\)/i,
    );

    const lightResolved = resolveColor(css, colorDecl!, "light");
    const lightAlpha = alphaFromColor(lightResolved);
    expect(lightAlpha).not.toBeNull();
    expect(Math.abs(lightAlpha! - 0.05), `light color=${lightResolved}`).toBeLessThan(0.02);
    expect(lightAlpha!).toBeLessThan(0.12);

    const darkOverride =
      firstDecl(css, "html[data-theme=dark] .artifact-footer__wordmark", "color") ??
      firstDecl(css, 'html[data-theme="dark"] .artifact-footer__wordmark', "color");

    const darkResolved = darkOverride
      ? resolveColor(css, darkOverride, "dark")
      : resolveColor(css, colorDecl!, "dark");
    const darkAlpha = alphaFromColor(darkResolved);
    expect(darkAlpha).not.toBeNull();
    expect(Math.abs(darkAlpha! - 0.04), `dark color=${darkResolved}`).toBeLessThan(0.02);
    expect(darkAlpha!).toBeLessThan(0.12);
  }, 60_000);
});
