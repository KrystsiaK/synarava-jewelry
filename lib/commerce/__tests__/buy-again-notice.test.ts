import { describe, expect, it } from "vitest";

import {
  decodeBuyAgainNotice,
  encodeBuyAgainNotice,
  hashBuyAgainReplay,
} from "@/lib/commerce/buy-again-notice";

describe("buy-again notice codec", () => {
  it("round-trips a complete notice", () => {
    const encoded = encodeBuyAgainNotice({
      outcome: "partial",
      added: 2,
      skipped: 1,
    });
    expect(decodeBuyAgainNotice(encoded)).toEqual({
      outcome: "partial",
      added: 2,
      skipped: 1,
    });
  });

  it("preserves reject codes and rejects garbage", () => {
    expect(
      decodeBuyAgainNotice(
        encodeBuyAgainNotice({
          outcome: "rejected",
          added: 0,
          skipped: 0,
          rejectCode: "invalid_syntax",
        }),
      ),
    ).toEqual({
      outcome: "rejected",
      added: 0,
      skipped: 0,
      rejectCode: "invalid_syntax",
    });
    expect(decodeBuyAgainNotice("nope|1|2")).toBeNull();
  });

  it("hashes locale + canonical permalink deterministically", () => {
    expect(hashBuyAgainReplay("en", "1:1,2:2")).toBe(hashBuyAgainReplay("en", "1:1,2:2"));
    expect(hashBuyAgainReplay("en", "1:1")).not.toBe(hashBuyAgainReplay("pt", "1:1"));
  });
});
