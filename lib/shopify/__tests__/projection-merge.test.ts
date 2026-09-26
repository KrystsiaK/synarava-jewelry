import { describe, expect, it } from "vitest";

import {
  classifyProjectionMerge,
  statusAtPath,
} from "@/lib/shopify/projection-merge";

describe("statusAtPath", () => {
  it("synced when L = R", () => {
    expect(statusAtPath(1, 2, 2)).toBe("synced");
    expect(statusAtPath(2, 2, 2)).toBe("synced");
  });

  it("remote (fast-forward candidate) when only R changed", () => {
    expect(statusAtPath(1, 1, 2)).toBe("remote");
  });

  it("ahead when only L changed", () => {
    expect(statusAtPath(1, 2, 1)).toBe("ahead");
  });

  it("conflict when both sides diverged", () => {
    expect(statusAtPath(1, 2, 3)).toBe("conflict");
  });
});

describe("classifyProjectionMerge", () => {
  const base = {
    title: "Ring",
    vendor: "Synarava",
    variants: [{ id: "v1", price: "10.00", taxable: true }],
  };

  it("SYNCED when L and R match", () => {
    const result = classifyProjectionMerge({
      base,
      local: base,
      remote: { ...base, updatedAt: "noise" },
    });
    expect(result.state).toBe("SYNCED");
    expect(result.differences).toEqual([]);
  });

  it("REMOTE_CHANGES when only Shopify changed (L = B)", () => {
    const result = classifyProjectionMerge({
      base,
      local: base,
      remote: { ...base, vendor: "Other" },
    });
    expect(result.state).toBe("REMOTE_CHANGES");
    expect(result.differences).toEqual([
      expect.objectContaining({
        path: "vendor",
        field: "Vendor",
        local: "Synarava",
        shopify: "Other",
        kind: "remote",
      }),
    ]);
  });

  it("LOCAL_CHANGES (ahead) when only local changed (R = B)", () => {
    const result = classifyProjectionMerge({
      base,
      local: { ...base, vendor: "Local Co" },
      remote: base,
    });
    expect(result.state).toBe("LOCAL_CHANGES");
    expect(result.differences).toEqual([
      expect.objectContaining({
        path: "vendor",
        kind: "ahead",
        local: "Local Co",
        shopify: "Synarava",
      }),
    ]);
  });

  it("CONFLICT when both sides changed the same path differently", () => {
    const result = classifyProjectionMerge({
      base,
      local: { ...base, vendor: "Local Co" },
      remote: { ...base, vendor: "Shopify Co" },
    });
    expect(result.state).toBe("CONFLICT");
    expect(result.differences).toEqual([
      expect.objectContaining({
        path: "vendor",
        kind: "conflict",
        local: "Local Co",
        shopify: "Shopify Co",
      }),
    ]);
  });

  it("without base and not dirty: invents B:=L so remote-only is not conflict", () => {
    const result = classifyProjectionMerge({
      base: null,
      local: base,
      remote: { ...base, vendor: "Other" },
      dirtyWithoutBase: false,
    });
    expect(result.state).toBe("REMOTE_CHANGES");
    expect(result.shouldPersistBase).toBe(true);
    expect(result.differences[0]?.kind).toBe("remote");
  });

  it("without base and dirty: L≠R is conservative conflict", () => {
    const result = classifyProjectionMerge({
      base: null,
      local: { ...base, vendor: "Local" },
      remote: { ...base, vendor: "Remote" },
      dirtyWithoutBase: true,
    });
    expect(result.state).toBe("CONFLICT");
    expect(result.shouldPersistBase).toBe(false);
    expect(result.differences[0]?.kind).toBe("conflict");
  });

  it("mix: ahead on one path and remote on another → CONFLICT aggregate", () => {
    const result = classifyProjectionMerge({
      base,
      local: { ...base, title: "Local Title" },
      remote: { ...base, vendor: "Remote Vendor" },
    });
    expect(result.state).toBe("CONFLICT");
    expect(result.differences.map((d) => d.kind).toSorted()).toEqual(["ahead", "remote"]);
  });
});
