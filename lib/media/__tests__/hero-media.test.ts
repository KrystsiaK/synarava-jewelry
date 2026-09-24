import { describe, expect, it } from "vitest";

import { normalizeVideoSources, resolveHeroBackdrop } from "@/lib/media/hero-media";

describe("normalizeVideoSources", () => {
  it("drops empty slots from a rotation list", () => {
    expect(normalizeVideoSources(["", "/media/uploads/videos/a.mp4", ""])).toEqual([
      "/media/uploads/videos/a.mp4",
    ]);
  });

  it("wraps a single string", () => {
    expect(normalizeVideoSources("/media/uploads/videos/a.mp4")).toEqual([
      "/media/uploads/videos/a.mp4",
    ]);
  });
});

describe("resolveHeroBackdrop", () => {
  it("prefers site video over a static hero image", () => {
    expect(
      resolveHeroBackdrop({
        videoSrc: ["/media/uploads/videos/home.mp4"],
        imageSrc: "/media/uploads/pages/hero.webp",
      }),
    ).toEqual({
      mode: "video",
      sources: ["/media/uploads/videos/home.mp4"],
      poster: "/media/uploads/pages/hero.webp",
    });
  });

  it("falls back to the hero image when no video is uploaded", () => {
    expect(
      resolveHeroBackdrop({
        videoSrc: ["", ""],
        imageSrc: "/media/uploads/pages/hero.webp",
      }),
    ).toEqual({ mode: "image", src: "/media/uploads/pages/hero.webp" });
  });

  it("returns none when both are empty", () => {
    expect(resolveHeroBackdrop({})).toEqual({ mode: "none" });
  });
});
