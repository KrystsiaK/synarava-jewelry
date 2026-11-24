import { describe, expect, it } from "vitest";

import { presentContentIdea } from "@/lib/marketing/ideas/present";

describe("presentContentIdea", () => {
  it("renders old single-locale string rows", () => {
    const presented = presentContentIdea({
      id: "legacy",
      status: "draft",
      productIds: ["p1"],
      signalIds: [],
      hook: "Old EN hook",
      script: "Old script",
      shotList: ["a"],
      caption: "Old caption",
      plannedFor: null,
      locale: "en",
    });
    expect(presented.hook).toEqual({ en: "Old EN hook", pt: "" });
    expect(presented.caption).toEqual({ en: "Old caption", pt: "" });
    expect(presented.whyRu).toBe("");
  });

  it("renders new bilingual JSON rows", () => {
    const presented = presentContentIdea({
      id: "new",
      status: "approved",
      productIds: ["p1"],
      signalIds: [],
      whyRu: "Потому что бусины",
      hook: { en: "Soft", pt: "Suave" },
      script: "Локация: кафе",
      shotList: ["руки"],
      caption: { en: "c", pt: "c2" },
      plannedFor: new Date("2026-12-01T12:00:00.000Z"),
    });
    expect(presented.hook.pt).toBe("Suave");
    expect(presented.whyRu).toContain("бусины");
    expect(presented.plannedFor).toContain("2026-12-01");
  });
});
