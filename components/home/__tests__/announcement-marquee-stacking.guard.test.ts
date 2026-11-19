import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Structural guard: the free-shipping marquee must stay above overlapping home
 * sections (ArchivePathway uses relative z-20 + negative margin) so hover/click
 * hit-testing reaches `.announcement-marquee`. Banner stays below sticky nav (50).
 */
describe("announcement marquee stacking guard", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "components/home/home-page.tsx"),
    "utf8",
  );
  const cssSource = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const placementSource = readFileSync(
    join(process.cwd(), "lib/content/announcement-marquee-placement.ts"),
    "utf8",
  );
  const localeLayoutSource = readFileSync(
    join(process.cwd(), "app/[locale]/layout.tsx"),
    "utf8",
  );

  it("keeps marquee z-index above ArchivePathway overlap and below header", () => {
    expect(pageSource).toMatch(
      /data-component="ArchivePathway"[\s\S]*?className="relative z-20 -mt-\[18svh]/,
    );

    const zVar = cssSource.match(/--z-announcement-marquee:\s*(\d+)/);
    expect(zVar?.[1]).toBeTruthy();
    const marqueeZ = Number(zVar![1]);
    expect(marqueeZ).toBeGreaterThan(20);
    expect(marqueeZ).toBeLessThan(50);

    expect(cssSource).toMatch(
      /\.announcement-marquee\s*\{[^}]*z-index:\s*var\(--z-announcement-marquee\)/s,
    );
  });

  it("uses viewport-budget hero height instead of taller-than-viewport min-heights", () => {
    expect(pageSource).toContain(
      "h-[calc(100svh-var(--artifact-nav-height)-var(--announcement-marquee-height))]",
    );
    expect(pageSource).not.toMatch(/min-h-\[108svh\]/);
    expect(pageSource).not.toMatch(/md:min-h-\[112vh\]/);
  });

  it("keeps a single layout exception list and home self-mount", () => {
    expect(placementSource).toContain("STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS");
    expect(placementSource).toContain('return "home"');
    expect(placementSource).toContain("isAdminRequestPath");
    expect(localeLayoutSource).toContain("shouldMountLayoutAnnouncementMarquee");
    expect(localeLayoutSource).toContain("resolveStorefrontAnnouncementMessage");
    expect(pageSource).toContain("<AnnouncementMarquee");
  });
});
