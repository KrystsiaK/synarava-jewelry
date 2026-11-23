import { describe, expect, it } from "vitest";

import { decideObservationDiff } from "@/lib/marketing/competitors/diff";
import {
  assertSafeTargetUrl,
  OffHostRedirectError,
  SsrfGuardError,
} from "@/lib/marketing/competitors/fetch";
import { observationContentHash } from "@/lib/marketing/competitors/hash";
import { isAllowedCompetitorHost } from "@/lib/marketing/competitors/targets";

describe("observation diff", () => {
  it("initial → unchanged (no row) → changed → removed", () => {
    const initial = decideObservationDiff({
      prior: null,
      removed: false,
      name: "A",
      price: 10,
      currency: "EUR",
      availability: "InStock",
    });
    expect(initial.write).toBe(true);
    if (!initial.write) return;
    expect(initial.kind).toBe("initial");

    const sameHash = observationContentHash({
      name: "A",
      price: 10,
      currency: "EUR",
      availability: "InStock",
    });
    const unchanged = decideObservationDiff({
      prior: { id: "1", contentHash: sameHash, kind: "initial" },
      removed: false,
      name: "A",
      price: 10,
      currency: "EUR",
      availability: "InStock",
    });
    expect(unchanged).toEqual({ write: false });

    const changed = decideObservationDiff({
      prior: { id: "1", contentHash: sameHash, kind: "initial" },
      removed: false,
      name: "A",
      price: 12,
      currency: "EUR",
      availability: "InStock",
    });
    expect(changed.write).toBe(true);
    if (!changed.write) return;
    expect(changed.kind).toBe("changed");
    expect(changed.previousId).toBe("1");

    const removed = decideObservationDiff({
      prior: { id: "2", contentHash: changed.contentHash, kind: "changed" },
      removed: true,
    });
    expect(removed.write).toBe(true);
    if (!removed.write) return;
    expect(removed.kind).toBe("removed");
  });
});

describe("SSRF / host allowlist", () => {
  it("rejects hosts not in targets.ts", () => {
    expect(isAllowedCompetitorHost("evil.com")).toBe(false);
    expect(isAllowedCompetitorHost("aurorajoalharia.com")).toBe(true);
    expect(() => assertSafeTargetUrl("https://evil.com/x", "aurorajoalharia.com")).toThrow(
      SsrfGuardError,
    );
    expect(() => assertSafeTargetUrl("http://aurorajoalharia.com/x", "aurorajoalharia.com")).toThrow(
      SsrfGuardError,
    );
  });

  it("OffHostRedirectError is distinct", () => {
    const err = new OffHostRedirectError("left host");
    expect(err.code).toBe("off_host_redirect");
  });
});
