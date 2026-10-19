import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Gallery Frame product media: neutral bottom scrim, pearl edge token,
 * no burgundy wash / grayscale / bottom sweep.
 */
describe("Product media Gallery Frame", () => {
  const cardSource = readFileSync(
    join(process.cwd(), "components/ui/product-card.tsx"),
    "utf8",
  );
  const gallerySource = readFileSync(
    join(process.cwd(), "components/ui/product-gallery-media.tsx"),
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

  it("routes ProductCard through ProductGalleryMedia", () => {
    expect(cardSource).toContain("ProductGalleryMedia");
    expect(cardSource).toContain("product-media-scrim__title");
    expect(cardSource).toContain("product-media-scrim__meta");
    expect(cardSource).not.toMatch(/grayscale/);
    expect(cardSource).not.toMatch(/Bottom sweep|bg-couture-red.*width/);
    expect(cardSource).not.toMatch(/group-hover:text-couture-red/);
    expect(cardSource).not.toMatch(/bg-gradient-to-t from-black/);
  });

  it("keeps gallery chrome in one shared primitive", () => {
    expect(gallerySource).toContain("product-gallery-media__edge");
    expect(gallerySource).toContain("product-gallery-media__image-wrap");
    expect(gallerySource).toContain("product-media-scrim");
    expect(discoverySource).toContain("ProductGalleryMedia");
    expect(detailSource).toContain("ProductGalleryMedia");
    const discoveryCard = discoverySource.match(
      /function DiscoveryProductCard[\s\S]*?\n\}\n\nexport function ShopDiscovery/,
    )?.[0];
    expect(typeof discoveryCard).toBe("string");
    expect(discoveryCard).toContain("ProductGalleryMedia");
    expect(discoveryCard).not.toMatch(/group-hover:scale/);
    expect(discoveryCard).not.toMatch(/grayscale/);
  });

  it("defines neutral scrim + theme edge token (no burgundy mist)", () => {
    expect(cssSource).toMatch(/--product-card-edge:\s*rgb\(92\s+78\s+67\s*\/\s*18%\)/);
    expect(cssSource).toMatch(/--product-card-edge:\s*rgb\(255\s+248\s+238\s*\/\s*20%\)/);
    expect(cssSource).toMatch(/\.product-gallery-media__edge/);
    expect(cssSource).toMatch(/scale\(1\.028\)/);

    const lightBlock = cssSource.match(
      /html\[data-theme="light"\]\s*\.product-media-scrim\s*\{[^}]*\}/s,
    )?.[0];
    expect(typeof lightBlock).toBe("string");
    expect(lightBlock).toMatch(/42\s+38\s+36/);
    expect(lightBlock).not.toMatch(/166\s+25\s+46/);
    expect(lightBlock).not.toMatch(/92\s+28\s+38/);

    const galleryCss = cssSource.match(
      /Product Gallery Frame[\s\S]*?@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\n\}/s,
    )?.[0];
    expect(typeof galleryCss).toBe("string");
    expect(galleryCss).not.toMatch(/filter:\s*grayscale/);
    expect(galleryCss).not.toMatch(/166\s+25\s+46/);
  });

  it("gates hover chrome on real hover capability and reduced motion", () => {
    expect(cssSource).toMatch(/@media \(hover:\s*hover\) and \(pointer:\s*fine\)/);
    expect(cssSource).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(cssSource).toMatch(/@media \(hover:\s*none\)/);
  });
});
