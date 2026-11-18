import { describe, expect, it } from "vitest";

import {
  selectPortugalFreeShippingThreshold,
  type PortugalFreeShippingCandidate,
} from "@/lib/shopify/free-shipping-threshold";

function candidate(
  overrides: Partial<PortugalFreeShippingCandidate> & {
    money: PortugalFreeShippingCandidate["money"];
    zoneName: string;
    isPtOnly: boolean;
  },
): PortugalFreeShippingCandidate {
  return {
    profileGid: overrides.profileGid ?? "gid://shopify/DeliveryProfile/1",
    profileName: overrides.profileName ?? "General",
    zoneGid: overrides.zoneGid ?? `gid://shopify/DeliveryZone/${overrides.zoneName}`,
    zoneCountryCodes: overrides.zoneCountryCodes
      ?? (overrides.isPtOnly ? ["PT"] : ["PT", "ES", "FR"]),
    methodDefinitionGid: overrides.methodDefinitionGid ?? "gid://shopify/DeliveryMethodDefinition/1",
    rateName: overrides.rateName ?? "Free shipping",
    conditionGid: overrides.conditionGid ?? "gid://shopify/DeliveryCondition/1",
    ...overrides,
  };
}

describe("selectPortugalFreeShippingThreshold", () => {
  it("prefers a PT-only zone over a multi-country zone that also includes PT", () => {
    const ptOnly = candidate({
      money: { amount: "49.0", currencyCode: "EUR" },
      zoneName: "Portugal",
      isPtOnly: true,
      rateName: "Domestic free",
    });
    const eu = candidate({
      money: { amount: "69.0", currencyCode: "EUR" },
      zoneName: "European Union",
      isPtOnly: false,
      rateName: "EU free",
    });

    const result = selectPortugalFreeShippingThreshold([eu, ptOnly]);
    expect(result.selected).toMatchObject({
      zoneName: "Portugal",
      money: { amount: "49.0", currencyCode: "EUR" },
      isPtOnly: true,
    });
    expect(result.warning).toMatch(/Multiple Portugal free-shipping thresholds/);
    expect(result.warning).toMatch(/49\.0 EUR/);
    expect(result.warning).toMatch(/Portugal \/ Domestic free/);
  });

  it("takes the minimum amount when several PT-only candidates remain", () => {
    const high = candidate({
      money: { amount: "69.0", currencyCode: "EUR" },
      zoneName: "Portugal A",
      isPtOnly: true,
      rateName: "Free A",
    });
    const low = candidate({
      money: { amount: "45.0", currencyCode: "EUR" },
      zoneName: "Portugal B",
      isPtOnly: true,
      rateName: "Free B",
    });

    const result = selectPortugalFreeShippingThreshold([high, low]);
    expect(result.selected?.money).toEqual({ amount: "45.0", currencyCode: "EUR" });
    expect(result.selected?.zoneName).toBe("Portugal B");
    expect(result.warning).toMatch(/45\.0 EUR/);
    expect(result.distinctAmounts).toHaveLength(2);
  });

  it("takes the minimum among zones that include PT when no PT-only zone exists", () => {
    const eu = candidate({
      money: { amount: "69.0", currencyCode: "EUR" },
      zoneName: "European Union",
      isPtOnly: false,
      rateName: "EU free",
    });
    const iberia = candidate({
      money: { amount: "55.0", currencyCode: "EUR" },
      zoneName: "Iberia",
      isPtOnly: false,
      zoneCountryCodes: ["PT", "ES"],
      rateName: "Iberia free",
    });

    const result = selectPortugalFreeShippingThreshold([eu, iberia]);
    expect(result.selected?.money).toEqual({ amount: "55.0", currencyCode: "EUR" });
    expect(result.selected?.zoneName).toBe("Iberia");
    expect(result.warning).toMatch(/no PT-only zone/);
  });

  it("does not warn when every candidate shares the same amount", () => {
    const a = candidate({
      money: { amount: "69.0", currencyCode: "EUR" },
      zoneName: "Portugal",
      isPtOnly: true,
      rateName: "Free A",
    });
    const b = candidate({
      money: { amount: "69.0", currencyCode: "EUR" },
      zoneName: "European Union",
      isPtOnly: false,
      rateName: "Free B",
    });

    const result = selectPortugalFreeShippingThreshold([a, b]);
    expect(result.selected?.isPtOnly).toBe(true);
    expect(result.warning).toBeNull();
    expect(result.distinctAmounts).toHaveLength(1);
  });

  it("returns null selection with no warning when there are no candidates", () => {
    expect(selectPortugalFreeShippingThreshold([])).toEqual({
      selected: null,
      warning: null,
      distinctAmounts: [],
    });
  });
});
