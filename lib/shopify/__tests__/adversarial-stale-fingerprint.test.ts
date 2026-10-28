/**
 * Phase 1 — stale fingerprint rejection (pure helper + whole-record gate shape).
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { describe, expect, it } from "vitest";

import { leafMatchesExpectedFingerprints } from "@/lib/sync/recheck-entity-leaves";
import type { SyncLeaf } from "@/lib/sync/types";

function leaf(overrides: Partial<SyncLeaf> = {}): SyncLeaf {
  return {
    id: "1",
    resourceType: "PRODUCT",
    resourceId: "p1",
    kind: "commerce",
    locale: null,
    fieldKey: "commerce:whole-item",
    label: "Product data (2 fields)",
    synaravaValue: "a",
    shopifyValue: "b",
    allowedDirections: [],
    blockedReason: null,
    sourceId: null,
    path: null,
    contractKey: "commerce:whole-item",
    section: "shopify",
    localFingerprint: "local-fp",
    shopifyFingerprint: "shop-fp",
    node: "base",
    ...overrides,
  };
}

describe("adversarial: stale fingerprint rejection", () => {
  it("rejects when local fingerprint drifted", () => {
    expect(
      leafMatchesExpectedFingerprints(leaf(), {
        localFingerprint: "stale-local",
        shopifyFingerprint: "shop-fp",
      }),
    ).toBe(false);
  });

  it("rejects when shopify fingerprint drifted", () => {
    expect(
      leafMatchesExpectedFingerprints(leaf(), {
        localFingerprint: "local-fp",
        shopifyFingerprint: "stale-shop",
      }),
    ).toBe(false);
  });

  it("accepts exact local+shopify match", () => {
    expect(
      leafMatchesExpectedFingerprints(leaf(), {
        localFingerprint: "local-fp",
        shopifyFingerprint: "shop-fp",
      }),
    ).toBe(true);
  });
});
