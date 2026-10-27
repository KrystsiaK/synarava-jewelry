import { describe, expect, it, vi } from "vitest";
import {
  PRODUCT_ARCHIVE,
  COLLECTION_ARCHIVE,
  assertArchivesPresent,
  evaluateArchiveCoverage,
  pathOnlySamples,
  compareCanonicalWindows,
  runVerification,
} from "../db/verify-derived-window.mjs";

describe("assertArchivesPresent", () => {
  it("fails when either archive is missing (default)", () => {
    expect(assertArchivesPresent(false, false)).toMatchObject({
      ok: false,
      code: "MISSING_ARCHIVE",
      missing: [PRODUCT_ARCHIVE, COLLECTION_ARCHIVE],
    });
    expect(assertArchivesPresent(true, false)).toMatchObject({
      ok: false,
      code: "MISSING_ARCHIVE",
      missing: [COLLECTION_ARCHIVE],
    });
    expect(assertArchivesPresent(false, true)).toMatchObject({
      ok: false,
      code: "MISSING_ARCHIVE",
      missing: [PRODUCT_ARCHIVE],
    });
  });

  it("passes when both archives exist", () => {
    expect(assertArchivesPresent(true, true)).toEqual({ ok: true });
  });

  it("allowMissingBoth only when both absent", () => {
    expect(assertArchivesPresent(false, false, { allowMissingBoth: true })).toMatchObject({
      ok: false,
      code: "MISSING_BOTH_SKIPPED",
    });
    expect(assertArchivesPresent(true, false, { allowMissingBoth: true })).toMatchObject({
      ok: false,
      code: "MISSING_ARCHIVE",
    });
  });
});

describe("evaluateArchiveCoverage", () => {
  it("fails on partial archive (live row without archive)", () => {
    const result = evaluateArchiveCoverage({
      liveIds: ["a", "b"],
      archiveRows: [{ id: "a", workingSnapshot: { title: "A" } }],
    });
    expect(result.ok).toBe(false);
    expect(result.missingArchiveIds).toEqual(["b"]);
    expect(result.liveCount).toBe(2);
    expect(result.archiveCount).toBe(1);
  });

  it("fails on null workingSnapshot", () => {
    const result = evaluateArchiveCoverage({
      liveIds: ["a"],
      archiveRows: [{ id: "a", workingSnapshot: null }],
    });
    expect(result.ok).toBe(false);
    expect(result.nullSnapshotIds).toEqual(["a"]);
  });

  it("fails on count mismatch (extra archive rows)", () => {
    const result = evaluateArchiveCoverage({
      liveIds: ["a"],
      archiveRows: [
        { id: "a", workingSnapshot: {} },
        { id: "orphan", workingSnapshot: {} },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.liveCount).toBe(1);
    expect(result.archiveCount).toBe(2);
  });

  it("passes when counts match and snapshots non-null", () => {
    const result = evaluateArchiveCoverage({
      liveIds: ["a", "b"],
      archiveRows: [
        { id: "a", workingSnapshot: { title: "A" } },
        { id: "b", workingSnapshot: { title: "B" } },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.missingArchiveIds).toEqual([]);
    expect(result.nullSnapshotIds).toEqual([]);
  });
});

describe("pathOnlySamples / compareCanonicalWindows", () => {
  it("never includes field values — paths only", () => {
    const samples = pathOnlySamples([
      { path: "title", field: "Name", local: "SECRET", shopify: "LEAK" },
      { path: "variants[0].price", field: "Price", local: "1", shopify: "2" },
    ]);
    expect(samples).toEqual(["title", "variants[0].price"]);
    expect(JSON.stringify(samples)).not.toMatch(/SECRET|LEAK/);
  });

  it("reports mismatch paths without values", () => {
    const diff = () => [
      { path: "vendor", field: "Vendor", local: "Us", shopify: "Them" },
    ];
    const result = compareCanonicalWindows({ a: 1 }, { a: 2 }, diff);
    expect(result.identical).toBe(false);
    expect(result.paths).toEqual(["vendor"]);
    expect(JSON.stringify(result)).not.toMatch(/Us|Them/);
  });

  it("clean pass when diff is empty", () => {
    const result = compareCanonicalWindows({}, {}, () => []);
    expect(result).toEqual({ identical: true, paths: [] });
  });
});

describe("runVerification integration (mocked db)", () => {
  function mockDb({
    hasProduct = true,
    hasCollection = true,
    products = [],
    productArchives = [],
    collections = [],
    collectionArchives = [],
  }) {
    return {
      $queryRawUnsafe: vi.fn(async (sql, tableName) => {
        if (sql.includes("information_schema.tables")) {
          if (tableName === PRODUCT_ARCHIVE) return [{ present: hasProduct }];
          if (tableName === COLLECTION_ARCHIVE) return [{ present: hasCollection }];
          return [{ present: false }];
        }
        if (sql.includes(PRODUCT_ARCHIVE)) return productArchives;
        if (sql.includes(COLLECTION_ARCHIVE)) return collectionArchives;
        return [];
      }),
      product: {
        findMany: vi.fn(async () => products),
      },
      collection: {
        findMany: vi.fn(async () => collections),
      },
      $disconnect: vi.fn(),
    };
  }

  const logs = () => {
    const lines = [];
    return {
      log: (...args) => lines.push(["log", ...args]),
      error: (...args) => lines.push(["error", ...args]),
      lines,
    };
  };

  it("missing archive → exit 1", async () => {
    const log = logs();
    const { exitCode, report } = await runVerification({
      db: mockDb({ hasProduct: false, hasCollection: true }),
      ourProductWindowFromRow: () => ({}),
      ourCollectionWindowFromRow: () => ({}),
      diffShopifyProjections: () => [],
      log,
    });
    expect(exitCode).toBe(1);
    expect(report.missing).toContain(PRODUCT_ARCHIVE);
  });

  it("partial archive → exit 1", async () => {
    const log = logs();
    const product = {
      id: "p1",
      name: "Ring",
      slug: "ring",
      status: "ACTIVE",
      variants: [],
      tags: [],
      collections: [],
    };
    const { exitCode, report } = await runVerification({
      db: mockDb({
        products: [product, { ...product, id: "p2", slug: "two" }],
        productArchives: [{ id: "p1", workingSnapshot: { title: "Ring" } }],
        collections: [],
        collectionArchives: [],
      }),
      ourProductWindowFromRow: () => ({ title: "Ring" }),
      ourCollectionWindowFromRow: () => ({}),
      diffShopifyProjections: () => [],
      log,
    });
    expect(exitCode).toBe(1);
    expect(report.coverage.product.missingArchiveIds).toEqual(["p2"]);
  });

  it("mismatch → exit 1 with paths only", async () => {
    const log = logs();
    const product = {
      id: "p1",
      name: "Ring",
      slug: "ring",
      status: "ACTIVE",
      variants: [],
      tags: [],
      collections: [],
    };
    const { exitCode, report } = await runVerification({
      db: mockDb({
        products: [product],
        productArchives: [{ id: "p1", workingSnapshot: { title: "Other" } }],
        collections: [],
        collectionArchives: [],
      }),
      ourProductWindowFromRow: () => ({ title: "Ring" }),
      ourCollectionWindowFromRow: () => ({}),
      diffShopifyProjections: () => [
        { path: "title", field: "Name", local: "Ring-VALUE", shopify: "Other-VALUE" },
      ],
      log,
    });
    expect(exitCode).toBe(1);
    expect(report.differing).toBe(1);
    expect(report.samples[0].paths).toEqual(["title"]);
    const dumped = JSON.stringify(report);
    expect(dumped).not.toMatch(/Ring-VALUE|Other-VALUE/);
  });

  it("clean pass → exit 0", async () => {
    const log = logs();
    const product = {
      id: "p1",
      name: "Ring",
      slug: "ring",
      status: "ACTIVE",
      variants: [],
      tags: [],
      collections: [],
    };
    const collection = {
      id: "c1",
      name: "All",
      slug: "all",
    };
    const { exitCode, report } = await runVerification({
      db: mockDb({
        products: [product],
        productArchives: [{ id: "p1", workingSnapshot: { title: "Ring" } }],
        collections: [collection],
        collectionArchives: [{ id: "c1", workingSnapshot: { title: "All" } }],
      }),
      ourProductWindowFromRow: () => ({ title: "Ring" }),
      ourCollectionWindowFromRow: () => ({ title: "All" }),
      diffShopifyProjections: () => [],
      log,
    });
    expect(exitCode).toBe(0);
    expect(report.status).toBe("ok");
    expect(report.identical).toBe(2);
    expect(report.differing).toBe(0);
  });
});
