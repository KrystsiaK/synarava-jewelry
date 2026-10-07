import { describe, expect, it } from "vitest";

import {
  DISPLAY_FIT_MIN_PX,
  displayFitMinScale,
  fitDisplayScale,
} from "@/lib/ui/fit-display-text";

describe("fitDisplayScale", () => {
  it("returns 1 when the longest word fits", () => {
    expect(
      fitDisplayScale({ availableWidth: 200, maxWordWidth: 180, minScale: 0.5 }),
    ).toBe(1);
  });

  it("returns the width ratio when the word overflows", () => {
    expect(
      fitDisplayScale({ availableWidth: 100, maxWordWidth: 200, minScale: 0.25 }),
    ).toBe(0.5);
  });

  it("clamps to minScale when the ratio would go lower", () => {
    expect(
      fitDisplayScale({ availableWidth: 50, maxWordWidth: 200, minScale: 0.4 }),
    ).toBe(0.4);
  });

  it("returns 1 for non-positive or non-finite inputs", () => {
    expect(
      fitDisplayScale({ availableWidth: 0, maxWordWidth: 100, minScale: 0.5 }),
    ).toBe(1);
    expect(
      fitDisplayScale({ availableWidth: 100, maxWordWidth: 0, minScale: 0.5 }),
    ).toBe(1);
    expect(
      fitDisplayScale({
        availableWidth: Number.NaN,
        maxWordWidth: 100,
        minScale: 0.5,
      }),
    ).toBe(1);
  });
});

describe("displayFitMinScale", () => {
  it("is minPx / basePx when base is larger than the floor", () => {
    expect(displayFitMinScale(48, DISPLAY_FIT_MIN_PX)).toBe(DISPLAY_FIT_MIN_PX / 48);
  });

  it("is 1 when base is already at or below the floor", () => {
    expect(displayFitMinScale(24, DISPLAY_FIT_MIN_PX)).toBe(1);
    expect(displayFitMinScale(16, DISPLAY_FIT_MIN_PX)).toBe(1);
  });
});
