import { describe, expect, it } from "vitest";

import {
  resolveSiteVideoMimeType,
  siteVideoContentTypesMatch,
} from "@/lib/media/video-mime";

describe("resolveSiteVideoMimeType", () => {
  it("keeps a normal video/mp4 type", () => {
    expect(resolveSiteVideoMimeType({ mimeType: "video/mp4", filename: "a.mp4" })).toBe("video/mp4");
  });

  it("maps application/mp4 to video/mp4", () => {
    expect(resolveSiteVideoMimeType({ mimeType: "application/mp4", filename: "a.mp4" })).toBe("video/mp4");
  });

  it("falls back to the .mp4 extension when File.type is empty", () => {
    expect(resolveSiteVideoMimeType({ mimeType: "", filename: "hero-film.mp4" })).toBe("video/mp4");
  });

  it("falls back to the .webm extension when File.type is empty", () => {
    expect(resolveSiteVideoMimeType({ mimeType: undefined, filename: "loop.webm" })).toBe("video/webm");
  });

  it("rejects unsupported types without a known extension", () => {
    expect(resolveSiteVideoMimeType({ mimeType: "video/quicktime", filename: "clip.mov" })).toBeNull();
  });
});

describe("siteVideoContentTypesMatch", () => {
  it("ignores charset parameters from the bucket HEAD response", () => {
    expect(siteVideoContentTypesMatch("video/mp4; charset=binary", "video/mp4")).toBe(true);
  });

  it("treats application/mp4 and video/mp4 as the same asset type", () => {
    expect(siteVideoContentTypesMatch("application/mp4", "video/mp4")).toBe(true);
  });
});
