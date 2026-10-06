import { hasFitFilm, supportsComplianceFilters, supportsTagFilters } from "../taxonomy";

describe("jewelry storefront catalog helpers", () => {
  it("enables fit-on-body film for the single jewelry catalog", () => {
    expect(hasFitFilm()).toBe(true);
  });

  it("hides compliance and tag shop facets (passport / operational noise)", () => {
    expect(supportsComplianceFilters()).toBe(false);
    expect(supportsTagFilters()).toBe(false);
  });
});
