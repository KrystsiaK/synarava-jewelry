import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import pt from "@/messages/pt.json";
import ru from "@/messages/ru.json";
import {
  formatSharedLegalDate,
  resolveLegalLastUpdatedLabel,
  resolveSharedLegalDate,
} from "@/lib/content/legal-date";
import { flattenMessages } from "@/lib/i18n/utils";

const dictionaries = {
  en: flattenMessages(en as Record<string, unknown>),
  pt: flattenMessages(pt as Record<string, unknown>),
  ru: flattenMessages(ru as Record<string, unknown>),
};

function translate(locale: keyof typeof dictionaries) {
  const messages = dictionaries[locale];
  const fallback = dictionaries.en;
  return (key: string) => messages[key] ?? fallback[key] ?? key;
}

const LEGAL_PAGES = [
  "app/[locale]/privacy/page.tsx",
  "app/[locale]/terms-and-conditions/page.tsx",
  "app/[locale]/offer/page.tsx",
] as const;

describe("shared legal date", () => {
  it("formats one English date with ru, pt, and en month names", () => {
    expect(formatSharedLegalDate("5 September 2026", translate("ru"))).toBe("5 сентября 2026");
    expect(formatSharedLegalDate("5 September 2026", translate("pt"))).toBe("5 de setembro de 2026");
    expect(formatSharedLegalDate("5 September 2026", translate("en"))).toBe("5 September 2026");
    expect(formatSharedLegalDate("1 June 2025", translate("ru"))).toBe("1 июня 2025");
  });

  it("leaves the source language when month names are missing", () => {
    const missing = (key: string) => key;
    expect(formatSharedLegalDate("5 September 2026", missing)).toBe("5 September 2026");
    expect(formatSharedLegalDate("Updated 2026", translate("ru"))).toBe("Updated 2026");
  });

  it("uses the same shared date for every locale", () => {
    const date = "21 September 2026";
    expect(resolveSharedLegalDate({
      date,
      saved: true,
      fallbackDate: "1 June 2025",
      translate: translate("en"),
    })).toBe("21 September 2026");
    expect(resolveSharedLegalDate({
      date,
      saved: true,
      fallbackDate: "1 June 2025",
      translate: translate("pt"),
    })).toBe("21 de setembro de 2026");
    expect(resolveSharedLegalDate({
      date,
      saved: true,
      fallbackDate: "1 June 2025",
      translate: translate("ru"),
    })).toBe("21 сентября 2026");
  });
});

describe("last updated label", () => {
  it("prefers the admin field and falls back to the dictionary when empty", () => {
    expect(resolveLegalLastUpdatedLabel("Обновлено", translate("ru")("legal.common.lastUpdated"))).toBe("Обновлено");
    expect(resolveLegalLastUpdatedLabel("  ", translate("ru")("legal.common.lastUpdated"))).toBe("Последнее обновление");
    expect(resolveLegalLastUpdatedLabel(undefined, translate("pt")("legal.common.lastUpdated"))).toBe("Última atualização");
    expect(resolveLegalLastUpdatedLabel(undefined, translate("en")("legal.common.lastUpdated"))).toBe("Last updated");
  });
});

describe("legal page chrome", () => {
  it("does not hardcode the English last-updated label or Legal eyebrow", () => {
    for (const file of LEGAL_PAGES) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toContain('lastUpdatedLabel="Last updated"');
      expect(source, file).not.toContain('eyebrowLabel="Legal"');
      expect(source, file).not.toContain('contentsLabel="Contents"');
      expect(source, file).toContain("resolveLegalLastUpdatedLabel");
      expect(source, file).toContain("resolveSharedLegalDate");
    }
  });
});
