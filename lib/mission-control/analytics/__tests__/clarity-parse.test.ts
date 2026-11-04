import { describe, expect, it } from "vitest";
import {
  pickClarityPrimaryCount,
  parseClarityExportBody,
} from "@/lib/mission-control/analytics/clarity-parse";

describe("Clarity primaryCount field names", () => {
  it.each([
    [{ sessionsCount: 12, URL: "/a", Device: "Mobile" }, 12],
    [{ sessionCount: 7, url: "/b", device: "Desktop" }, 7],
    [{ count: 3, URL: "/c", Device: "Tablet" }, 3],
    [{ totalSessionCount: 99, URL: "/d", Device: "Mobile" }, 99],
    [{ deadClickCount: 4, URL: "/e", Device: "Mobile" }, 4],
    [{ "Dead Click Count": 5, URL: "/f", Device: "Mobile" }, 5],
  ])("reads explicit count field %#", (info, expected) => {
    const result = pickClarityPrimaryCount(info);
    expect(result.recognized).toBe(true);
    expect(result.count).toBe(expected);
  });

  it("unrecognized shape is not silent zero", () => {
    const result = pickClarityPrimaryCount({
      URL: "/shop",
      Device: "Mobile",
      mysteryBlob: "yes",
    });
    expect(result.recognized).toBe(false);
    expect(result.count).toBeNull();
  });

  it("parse emits format warning when metric rows lack known count fields", () => {
    const parsed = parseClarityExportBody([
      {
        metricName: "Dead Click Count",
        information: [{ URL: "/x", Device: "Mobile", foo: "bar" }],
      },
    ]);
    expect(parsed.formatUnrecognized).toBe(true);
    expect(parsed.rows).toEqual([]);
  });

  it("parse maps known metric + count field into friction rows", () => {
    const parsed = parseClarityExportBody([
      {
        metricName: "Rage Click Count",
        information: [{ URL: "/shop", Device: "Mobile", sessionsCount: 9 }],
      },
    ]);
    expect(parsed.formatUnrecognized).toBe(false);
    expect(parsed.rows).toEqual([
      expect.objectContaining({
        url: "/shop",
        device: "Mobile",
        rageClickCount: 9,
      }),
    ]);
  });
});
