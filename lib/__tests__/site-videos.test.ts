import { describe, expect, it } from "vitest";

import { releasedSiteVideoKeys, siteVideoObjectKey } from "@/lib/site-videos";

const beads = "/media/uploads/videos/homeBeads/beads-film.mp4";
const beadsKey = "uploads/videos/homeBeads/beads-film.mp4";

describe("siteVideoObjectKey", () => {
  it("reads a proxied site-video URL", () => {
    expect(siteVideoObjectKey(beads)).toBe(beadsKey);
  });

  it("reads a public and a path-style bucket URL", () => {
    expect(siteVideoObjectKey("https://cdn.example.com/uploads/videos/homeModel/model.webm?v=1")).toBe(
      "uploads/videos/homeModel/model.webm",
    );
    expect(siteVideoObjectKey("http://127.0.0.1:59000/synarava-media/uploads/videos/braceletFilm/fit.mp4")).toBe(
      "uploads/videos/braceletFilm/fit.mp4",
    );
  });

  it("rejects keys outside the site-video prefix", () => {
    expect(siteVideoObjectKey("/media/uploads/products/ring.jpg")).toBeNull();
    expect(siteVideoObjectKey("/media/uploads/videos/homeBeads/../products/ring.mp4")).toBeNull();
    expect(siteVideoObjectKey("https://cdn.example.com/other/clip.mp4")).toBeNull();
  });
});

describe("releasedSiteVideoKeys", () => {
  it("releases a cleared slot", () => {
    expect(releasedSiteVideoKeys({ homeBeads: beads }, { homeBeads: "" })).toEqual([beadsKey]);
  });

  it("keeps a key that another slot still uses", () => {
    expect(releasedSiteVideoKeys(
      { homeBeads: beads, homeModel: beads },
      { homeBeads: "", homeModel: beads },
    )).toEqual([]);
  });

  it("releases the previous file when a slot is replaced", () => {
    expect(releasedSiteVideoKeys(
      { homeBeads: beads },
      { homeBeads: "/media/uploads/videos/homeBeads/beads-next.mp4" },
    )).toEqual([beadsKey]);
  });
});
