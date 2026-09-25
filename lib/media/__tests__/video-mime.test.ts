import { describe, expect, it } from "vitest";

import { resolveSiteVideoMimeType } from "@/lib/media/video-mime";

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
