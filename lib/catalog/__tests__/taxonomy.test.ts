import { hasFitFilm, supportsComplianceFilters } from "../taxonomy";

describe("jewelry storefront catalog helpers", () => {
  it("enables fit-on-body film for the single jewelry catalog", () => {
    expect(hasFitFilm()).toBe(true);
  });

  it("enables compliance filters for finished jewelry", () => {
    expect(supportsComplianceFilters()).toBe(true);
  });
});
