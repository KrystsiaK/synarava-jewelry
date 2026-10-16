import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Light-theme product media overlays must not use a muddy black veil.
 * Dark keeps the cinematic charcoal lift; light uses porcelain/champagne mist + ink text.
 */
describe("Product media scrim", () => {
  const cardSource = readFileSync(
    join(process.cwd(), "components/ui/product-card.tsx"),
    "utf8",
  );
  const discoverySource = readFileSync(
    join(process.cwd(), "components/shop/shop-discovery.tsx"),
    "utf8",
  );
  const detailSource = readFileSync(
    join(process.cwd(), "components/artifacts/product-detail.tsx"),
    "utf8",
  );
  const cssSource = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

  it("wires the themed scrim on ProductCard instead of Tailwind black gradients", () => {
    expect(cardSource).toContain('className="product-media-scrim absolute inset-0');
    expect(cardSource).toContain("product-media-scrim__title");
    expect(cardSource).toContain("product-media-scrim__meta");
    expect(cardSource).not.toMatch(/bg-gradient-to-t from-black/);
    expect(cardSource).not.toMatch(/text-white\/75/);
  });

  it("wires the rail scrim on discovery and related product cards", () => {
    expect(discoverySource).toContain("product-media-scrim product-media-scrim--rail");
    expect(detailSource).toContain("product-media-scrim product-media-scrim--rail");
    const discoveryCard = discoverySource.match(
      /function DiscoveryProductCard[\s\S]*?\n\}/,
    )?.[0];
    expect(typeof discoveryCard).toBe("string");
    expect(discoveryCard).not.toMatch(/bg-gradient-to-t from-black/);
    expect(detailSource).not.toMatch(
      /function RelatedProductCard[\s\S]*?bg-gradient-to-t from-black/,
    );
  });

  it("defines light champagne-depth mist and dark charcoal materials", () => {
    expect(cssSource).toMatch(
      /\.product-media-scrim\s*\{\s*background-image:\s*linear-gradient/,
    );
    expect(cssSource).toMatch(
      /html\[data-theme="light"\]\s*\.product-media-scrim\s*\{/,
    );
    const lightBlock = cssSource.match(
      /html\[data-theme="light"\]\s*\.product-media-scrim\s*\{[^}]*\}/s,
    )?.[0];
    expect(typeof lightBlock).toBe("string");
    // Warm champagne parchment in the type band (not cool porcelain white).
    expect(lightBlock).toMatch(/244\s+232\s+216\s*\/\s*0\.94/);
    expect(lightBlock).toMatch(/236\s+216\s+188\s*\/\s*0\.52/);
    expect(lightBlock).not.toMatch(/252\s+250\s+247/);
    expect(lightBlock).not.toMatch(/0\s+0\s+0\s*\/\s*0\.[6-9]/);
    expect(cssSource).toMatch(
      /html\[data-theme="light"\]\s*\.product-media-scrim__title\s*\{\s*color:\s*var\(--color-foreground\)/,
    );
  });
});
