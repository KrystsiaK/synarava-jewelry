import { describe, expect, it } from "vitest";

import {
  LEGAL_STICKY_OFFSET_REM,
  activeLegalSectionId,
  legalReadingLinePx,
  legalSpyRootMargin,
  sectionPassedReadingLine,
} from "@/components/legal/legal-section-spy";

describe("legal section spy", () => {
  it("uses the section scroll margin, then a 7rem fallback", () => {
    expect(legalReadingLinePx(16, 128)).toBe(128);
    expect(legalReadingLinePx(16, 0)).toBe(LEGAL_STICKY_OFFSET_REM * 16);
    expect(legalReadingLinePx(20, null)).toBe(140);
    expect(legalReadingLinePx(Number.NaN, null)).toBe(112);
  });

  it("builds a 1px observation band at the reading line", () => {
    expect(legalSpyRootMargin(112, 800)).toBe("-112px 0px -687px 0px");
    expect(legalSpyRootMargin(900, 400)).toBe("-399px 0px -0px 0px");
    expect(legalSpyRootMargin(112, 0)).toBe("-112px 0px -0px 0px");
  });

  it("treats the section on the line, and any section already above it, as passed", () => {
    expect(sectionPassedReadingLine({
      isIntersecting: true,
      boundingClientRect: { top: 112 },
      rootBounds: { bottom: 113 },
    }, 112)).toBe(true);

    expect(sectionPassedReadingLine({
      isIntersecting: false,
      boundingClientRect: { top: -640 },
      rootBounds: { bottom: 113 },
    }, 112)).toBe(true);

    expect(sectionPassedReadingLine({
      isIntersecting: false,
      boundingClientRect: { top: 480 },
      rootBounds: { bottom: 113 },
    }, 112)).toBe(false);

    expect(sectionPassedReadingLine({
      isIntersecting: false,
      boundingClientRect: { top: 40 },
      rootBounds: null,
    }, 112)).toBe(true);
  });

  it("picks the last passed section and stays quiet for empty or not-yet-reached documents", () => {
    const order = ["data-controller", "data-we-collect", "contact"];
    expect(activeLegalSectionId(order, new Set())).toBeNull();
    expect(activeLegalSectionId([], new Set(["data-controller"]))).toBeNull();
    expect(activeLegalSectionId(["only"], new Set())).toBeNull();
    expect(activeLegalSectionId(["only"], new Set(["only"]))).toBe("only");
    expect(activeLegalSectionId(order, new Set(["data-controller"]))).toBe("data-controller");
    expect(activeLegalSectionId(order, new Set(["data-controller", "data-we-collect"]))).toBe("data-we-collect");
    expect(activeLegalSectionId(order, new Set(order))).toBe("contact");
  });
});
