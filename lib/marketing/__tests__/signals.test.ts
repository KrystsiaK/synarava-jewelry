import { describe, expect, it } from "vitest";

import {
  fromCompetitorObservation,
  fromManualNote,
} from "@/lib/marketing/signals";

describe("MarketSignal mappers", () => {
  it("fromCompetitorObservation prefixes web: id", () => {
    const signal = fromCompetitorObservation(
      {
        id: "cuid1",
        domain: "aurorajoalharia.com",
        url: "https://aurorajoalharia.com/products/x",
        fetchedAt: new Date("2026-11-23T10:00:00.000Z"),
        httpStatus: 200,
        source: "json-ld",
        name: "Colar",
        price: 22.9,
        currency: "EUR",
        availability: "InStock",
        kind: "changed",
      },
      "Aurora Joalharia",
    );
    expect(signal.id).toBe("web:cuid1");
    expect(signal.source).toBe("website");
    expect(signal.change).toBe("changed");
    expect(signal.brand).toBe("Aurora Joalharia");
  });

  it("fromManualNote prefixes manual: id and scrubs text", () => {
    const signal = fromManualNote({
      id: "n1",
      url: "https://www.facebook.com/ads/library/?id=1",
      text: "Nice ad creative about beads",
    });
    expect(signal.id).toBe("manual:n1");
    expect(signal.source).toBe("manual");
    expect(signal.kind).toBe("note");
    expect(signal.summary).toContain("beads");
  });
});
