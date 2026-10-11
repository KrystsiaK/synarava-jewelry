import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Light-theme Home archive cards must not exit-dim with opaque black.
 * Scroll presence stays; the material is theme-tokenized (burgundy frost in light).
 */
describe("Home archive record exit dim", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/home/home-page.tsx"),
    "utf8",
  );
  const cssSource = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("wires the themed dim layer instead of a hard-coded black overlay", () => {
    expect(pageSource).toContain('className="archive-record-dim');
    expect(pageSource).not.toMatch(
      /className="pointer-events-none absolute inset-0 z-20 bg-black"/,
    );
  });

  it("keeps scroll-linked opacity presence on the dim layer", () => {
    expect(pageSource).toMatch(/useTransform\(progress,\s*\[0,\s*1\],\s*reduceMotion \? \[0,\s*0\] : \[0,\s*0\.58\]\)/);
    expect(pageSource).toContain('style={{ opacity: dim }}');
  });

  it("defines light burgundy/cream frost and dark charcoal materials", () => {
    expect(cssSource).toMatch(
      /\.archive-record-dim\s*\{\s*background:\s*linear-gradient/,
    );
    expect(cssSource).toMatch(
      /html\[data-theme="dark"\]\s*\.archive-record-dim\s*\{\s*background:\s*#000/,
    );
    const lightBlock = cssSource.match(/\.archive-record-dim\s*\{[^}]*\}/s)?.[0];
    expect(typeof lightBlock).toBe("string");
    expect(lightBlock).toMatch(/rgba\(166,\s*25,\s*46/);
    expect(lightBlock).not.toMatch(/background:\s*#000/);
  });
});


