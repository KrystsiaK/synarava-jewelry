import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import { flattenMessages } from "@/lib/i18n/utils";

describe("storefront message dictionaries", () => {
  it("keeps the EN and PT key sets identical", () => {
    const enKeys = Object.keys(flattenMessages(en as Record<string, unknown>)).sort();
    const ptKeys = Object.keys(flattenMessages(pt as Record<string, unknown>)).sort();

    expect(ptKeys).toEqual(enKeys);
  });

  it("does not leave blank translated values", () => {
    const values = Object.values(flattenMessages(pt as Record<string, unknown>));
    expect(values.every((value) => value.trim().length > 0)).toBe(true);
  });
});
