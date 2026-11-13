import de from "@/messages/de.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pl from "@/messages/pl.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import { flattenMessages } from "@/lib/i18n/utils";

const ALL_MESSAGE_FILES = { de, en, fr, pl, pt, ru } as const;

describe("storefront message dictionaries", () => {
  it("includes product.restockNotice in every locale catalog", () => {
    for (const [locale, catalog] of Object.entries(ALL_MESSAGE_FILES)) {
      const flat = flattenMessages(catalog as Record<string, unknown>);
      expect(flat["product.restockNotice"]?.trim().length, locale).toBeGreaterThan(0);
    }
  });

  it("keeps the EN and PT key sets identical", () => {
    const enKeys = Object.keys(flattenMessages(en as Record<string, unknown>)).sort();
    const ptKeys = Object.keys(flattenMessages(pt as Record<string, unknown>)).sort();

    expect(ptKeys).toEqual(enKeys);
  });

  it("does not leave blank translated values", () => {
    const values = Object.values(flattenMessages(pt as Record<string, unknown>));
    expect(values.every((value) => value.trim().length > 0)).toBe(true);
  });

  it("keeps Russian translations nonblank", () => {
    const russian = flattenMessages(ru as Record<string, unknown>);

    expect(Object.keys(russian).length).toBeGreaterThan(0);
    expect(Object.values(russian).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("covers PDP product.specifications chrome in Russian", () => {
    const enKeys = Object.keys(flattenMessages(en as Record<string, unknown>))
      .filter((key) => key.startsWith("product.specifications."))
      .sort();
    const ruKeys = Object.keys(flattenMessages(ru as Record<string, unknown>))
      .filter((key) => key.startsWith("product.specifications."))
      .sort();

    expect(ruKeys).toEqual(enKeys);
  });

  it("covers product.* chrome keys used on the PDP in Russian", () => {
    const enProductKeys = Object.keys(flattenMessages(en as Record<string, unknown>))
      .filter((key) => key.startsWith("product."))
      .sort();
    const russian = flattenMessages(ru as Record<string, unknown>);

    for (const key of enProductKeys) {
      expect(russian[key]?.trim().length, key).toBeGreaterThan(0);
    }
  });
});
