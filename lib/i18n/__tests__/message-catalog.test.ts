import { describe, expect, it } from "vitest";

import { getEnglishMessages, getFlatMessages, listBundledMessageLocales } from "@/lib/i18n/message-catalog";

describe("message catalog", () => {
  it("bundles bootstrap locales and falls back empty for unknown codes", () => {
    expect(listBundledMessageLocales()).toEqual(
      expect.arrayContaining(["en", "pt", "ru", "de", "fr", "pl"]),
    );
    expect(getFlatMessages("en")["a11y.skip"]).toBeTruthy();
    expect(getFlatMessages("zz")).toEqual({});
    expect(getEnglishMessages()["a11y.skip"]).toBe(getFlatMessages("en")["a11y.skip"]);
  });
});
