import type { FilterOption } from "./types";

export function shopComplianceOptions(label: (key: string) => string): FilterOption[] {
  return [
    { value: "reach_certified", label: label("shop.filters.reach") },
    { value: "lead_free", label: label("shop.filters.leadFree") },
    { value: "cadmium_free", label: label("shop.filters.cadmiumFree") },
    { value: "nickel_free", label: label("shop.filters.nickelFree") },
  ];
}
