import { describe, expect, it } from "vitest";

import {
  resolveAnnouncementMarqueeMount,
  shouldMountLayoutAnnouncementMarquee,
  STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS,
} from "@/lib/content/announcement-marquee-placement";

describe("resolveAnnouncementMarqueeMount", () => {
  it("mounts from layout on home", () => {
    expect(resolveAnnouncementMarqueeMount("/en")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/pt")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/")).toBe("layout");
  });

  it("mounts from layout on normal storefront routes", () => {
    expect(resolveAnnouncementMarqueeMount("/en/shop")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/products/ring")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/pt/artifacts/abc")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/collections")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/collections/archive")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/cart")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/privacy")).toBe("layout");
    expect(resolveAnnouncementMarqueeMount("/en/terms-and-conditions")).toBe("layout");
  });

  it("hides on about", () => {
    expect(resolveAnnouncementMarqueeMount("/en/about")).toBe("none");
    expect(resolveAnnouncementMarqueeMount("/pt/about")).toBe("none");
    expect(resolveAnnouncementMarqueeMount("/en/about/manifesto")).toBe("none");
  });

  it("hides on admin", () => {
    expect(resolveAnnouncementMarqueeMount("/admin")).toBe("none");
    expect(resolveAnnouncementMarqueeMount("/admin/settings")).toBe("none");
  });

  it("hides on unknown / soft-404 style paths (no allowlist hit)", () => {
    expect(resolveAnnouncementMarqueeMount("/en/this-page-does-not-exist")).toBe("none");
    expect(resolveAnnouncementMarqueeMount("/en/login")).toBe("none");
    expect(resolveAnnouncementMarqueeMount(null)).toBe("none");
  });

  it("exposes a stable allowlist used by the layout policy", () => {
    expect(STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS).toContain("/shop");
    expect(STOREFRONT_ANNOUNCEMENT_LAYOUT_PATHS).not.toContain("/about");
    expect(shouldMountLayoutAnnouncementMarquee("/en/shop")).toBe(true);
    expect(shouldMountLayoutAnnouncementMarquee("/en")).toBe(true);
    expect(shouldMountLayoutAnnouncementMarquee("/en/about")).toBe(false);
  });
});
