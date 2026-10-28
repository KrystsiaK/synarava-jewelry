/**
 * A11Y-ADV-001 / SEO-ADV-001 / SEO-ADV-002 — footer contrast + home meta.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

describe("storefront a11y/seo audit locks (A11Y/SEO-ADV)", () => {
  it("footer wordmark uses stronger contrast than global wordmark-fade (A11Y-ADV-001)", () => {
    const css = read("app/globals.css");
    const block = css.match(
      /\.artifact-footer__wordmark\s*\{[^}]+\}/,
    )?.[0];
    expect(block).toBeTruthy();
    expect(block!).not.toMatch(/color:\s*var\(--color-wordmark-fade\)/);
    expect(block!).toMatch(/rgba\(\s*25\s*,\s*21\s*,\s*18\s*,\s*0\.5\s*\)/);
    expect(css).toMatch(
      /html\[data-theme="dark"\]\s*\.artifact-footer__wordmark\s*\{[^}]*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0\.4\s*\)/s,
    );
  });

  it("home metadata falls back to site SEO description (SEO-ADV-001)", () => {
    const src = read("app/[locale]/page.tsx");
    expect(src).toMatch(/fallbackDescription:\s*siteSeo\.description/);
    expect(src).not.toMatch(/fallbackDescription:\s*""/);
  });

  it("home page localization does not inherit EN seoTitle for other locales (SEO-ADV-002)", () => {
    const src = read("lib/pages/localization.ts");
    expect(src).toMatch(/pageSlug !== "home"|pageSlug === "home"/);
    expect(src).toMatch(/inheritEnSeo|SEO-ADV-002/);
  });
});
