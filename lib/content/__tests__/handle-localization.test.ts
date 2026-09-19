import { describe, expect, it } from "vitest";

import { resolveLocalizedHandle, shouldRedirectLocalizedHandle } from "@/lib/content/handle-localization";

describe("localized handles", () => {
  it("falls back to the English slug when Portuguese handle is blank", () => {
    expect(resolveLocalizedHandle("pt", "lava-ring", "  ")).toBe("lava-ring");
  });

  it("uses the Portuguese handle only for the Portuguese locale", () => {
    expect(resolveLocalizedHandle("pt", "lava-ring", "anel-lava")).toBe("anel-lava");
    expect(resolveLocalizedHandle("en", "lava-ring", "anel-lava")).toBe("lava-ring");
  });

  it("redirects an old/source path only when an active localized handle differs", () => {
    expect(shouldRedirectLocalizedHandle("pt", "lava-ring", "anel-lava")).toBe(true);
    expect(shouldRedirectLocalizedHandle("pt", "anel-lava", "anel-lava")).toBe(false);
    expect(shouldRedirectLocalizedHandle("en", "lava-ring", "anel-lava")).toBe(false);
  });
});
