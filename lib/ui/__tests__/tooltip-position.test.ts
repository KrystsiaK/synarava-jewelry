import { describe, expect, it } from "vitest";

import { computeTooltipPosition } from "@/lib/ui/tooltip-position";

describe("computeTooltipPosition", () => {
  it("flips below a trigger when there is not enough room above", () => {
    const result = computeTooltipPosition({
      reference: { left: 120, right: 160, top: 4, bottom: 44, width: 40, height: 40 },
      floating: { width: 220, height: 80 },
      viewport: { width: 360, height: 640 },
      preferredSide: "top",
    });

    expect(result.side).toBe("bottom");
    expect(result.top).toBeGreaterThanOrEqual(44);
  });

  it("shifts a wide tooltip inside the viewport instead of clipping it", () => {
    const result = computeTooltipPosition({
      reference: { left: 2, right: 34, top: 300, bottom: 332, width: 32, height: 32 },
      floating: { width: 320, height: 96 },
      viewport: { width: 360, height: 640 },
      preferredSide: "top",
      viewportPadding: 8,
    });

    expect(result.left).toBe(8);
    expect(result.left + 320).toBeLessThanOrEqual(352);
    expect(result.arrowX).toBeGreaterThanOrEqual(8);
  });

  it("chooses the side with the most room in automatic mode", () => {
    const result = computeTooltipPosition({
      reference: { left: 20, right: 60, top: 280, bottom: 320, width: 40, height: 40 },
      floating: { width: 120, height: 80 },
      viewport: { width: 900, height: 600 },
      preferredSide: "auto",
    });

    expect(result.side).toBe("right");
  });
});
