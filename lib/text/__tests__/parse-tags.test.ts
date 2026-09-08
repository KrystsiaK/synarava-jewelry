import { describe, expect, it } from "vitest";

import { parseTags } from "@/lib/text/parse-tags";

describe("parseTags", () => {
  it("splits, slugifies, and dedupes a comma-separated list", () => {
    expect(parseTags("Oak, oak, Lava Stone")).toEqual(["oak", "lava-stone"]);
  });

  it("drops empty entries", () => {
    expect(parseTags("oak,, lava")).toEqual(["oak", "lava"]);
  });
});
