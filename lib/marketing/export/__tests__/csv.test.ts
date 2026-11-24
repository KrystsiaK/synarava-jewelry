import { describe, expect, it } from "vitest";

import {
  buildObservationsCsv,
  guardCsvCell,
  quoteCsvField,
  type ObservationCsvRow,
} from "@/lib/marketing/export/csv";

const row = (partial: Partial<ObservationCsvRow> = {}): ObservationCsvRow => ({
  brand: "Aurora",
  domain: "aurorajoalharia.com",
  url: "https://aurorajoalharia.com/products/x",
  fetchedAt: "2026-11-23T12:00:00.000Z",
  kind: "changed",
  price: "22.90",
  currency: "EUR",
  availability: "InStock",
  source: "website",
  name: "Pulseira",
  ...partial,
});

describe("observations CSV", () => {
  it("quotes commas/quotes and preserves Cyrillic with BOM", () => {
    const csv = buildObservationsCsv([
      row({
        brand: "Синарава",
        name: 'Кольцо "тест", большое',
      }),
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Синарава");
    expect(csv).toContain('"Кольцо ""тест"", большое"');
  });

  it("guards formula injection", () => {
    expect(guardCsvCell("=CMD()")).toBe("'=CMD()");
    expect(guardCsvCell("+1+1")).toBe("'+1+1");
    expect(guardCsvCell("@sum")).toBe("'@sum");
    expect(quoteCsvField("=1+1")).toBe("'=1+1");
    const csv = buildObservationsCsv([row({ name: "=HYPERLINK(1)" })]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });

  it("guards TAB/CR/leading-space formula cells; plain negative prices stay bare", () => {
    expect(guardCsvCell("\t=1+1")).toMatch(/^'/);
    expect(guardCsvCell("\r=1+1")).toMatch(/^'/);
    expect(guardCsvCell(" =1+1")).toMatch(/^'/);
    expect(guardCsvCell('=HYPERLINK("http://x")')).toMatch(/^'/);
    expect(guardCsvCell("@SUM(1)")).toMatch(/^'/);
    expect(guardCsvCell("-2+3")).toMatch(/^'/);
    // Plain numeric prices must not be formula-prefixed.
    expect(guardCsvCell("-22.90")).toBe("-22.90");
    expect(guardCsvCell("-1")).toBe("-1");

    const dangerousNames = [
      "\t=1+1",
      "\r=1+1",
      " =1+1",
      '=HYPERLINK("http://evil")',
      "@SUM(1)",
      "-2+3",
    ];
    for (const name of dangerousNames) {
      expect(quoteCsvField(name).replace(/^"/, "")).toMatch(/^'/);
    }

    const csv = buildObservationsCsv([
      ...dangerousNames.map((name) => row({ name })),
      row({ price: "-22.90", name: "ok" }),
    ]);
    // Every dangerous name field is formula-neutral (`'` prefix); price stays bare.
    expect(csv).toContain("'=HYPERLINK(");
    expect(csv).toContain("'@SUM(1)");
    expect(csv).toContain("'-2+3");
    expect(csv).toMatch(/,-22\.90,/);
    expect(csv).not.toMatch(/,'-22\.90,/);
  });
});
