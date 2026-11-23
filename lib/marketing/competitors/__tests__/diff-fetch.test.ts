import { describe, expect, it } from "vitest";

import { decideObservationDiff } from "@/lib/marketing/competitors/diff";
import {
  assertSafeTargetUrl,
  isBlockedResolvedIp,
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

  it("blocks private / metadata resolved IPs", () => {
    expect(isBlockedResolvedIp("127.0.0.1")).toBe(true);
    expect(isBlockedResolvedIp("10.0.0.1")).toBe(true);
    expect(isBlockedResolvedIp("172.16.5.1")).toBe(true);
    expect(isBlockedResolvedIp("192.168.1.1")).toBe(true);
    expect(isBlockedResolvedIp("169.254.169.254")).toBe(true);
    expect(isBlockedResolvedIp("8.8.8.8")).toBe(false);
    expect(isBlockedResolvedIp("::1")).toBe(true);
  });
});
