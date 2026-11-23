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
    expect(guardCsvCell("-1")).toBe("'-1");
    expect(guardCsvCell("@sum")).toBe("'@sum");
    expect(quoteCsvField("=1+1")).toBe("'=1+1");
    const csv = buildObservationsCsv([row({ name: "=HYPERLINK(1)" })]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
