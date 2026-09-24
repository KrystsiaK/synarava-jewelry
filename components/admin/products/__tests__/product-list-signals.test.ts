import { describe, expect, it } from "vitest";

import { localeTone } from "@/components/admin/products/product-list-signals";
import type { AdminProductLocaleSignal } from "@/lib/admin/list-products-shared";

function locale(partial: Partial<AdminProductLocaleSignal>): AdminProductLocaleSignal {
  return {
    code: "pt",
    label: "Português",
    percent: 0,
    complete: false,
    reviewed: false,
    syncStatus: "NOT_APPLICABLE",
    missing: ["title"],
    ...partial,
  };
}

describe("localeTone", () => {
  it("never uses danger for incomplete translations", () => {
    expect(localeTone(locale({ percent: 0 }))).toBe("empty");
    expect(localeTone(locale({ percent: 33 }))).toBe("partial");
    expect(localeTone(locale({ percent: 67 }))).toBe("progress");
    expect(localeTone(locale({ percent: 100, complete: true, reviewed: false }))).toBe("warn");
    expect(localeTone(locale({ percent: 100, complete: true, reviewed: true }))).toBe("ok");
  });

  it("reserves conflict amber for sync faults, not incompleteness", () => {
    expect(localeTone(locale({ syncStatus: "FAILED", percent: 0 }))).toBe("conflict");
    expect(localeTone(locale({ syncStatus: "PENDING", percent: 50 }))).toBe("pending");
  });
});
