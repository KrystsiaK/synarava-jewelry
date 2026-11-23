import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditLogFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: { findFirst: mocks.auditLogFindFirst },
  },
}));

import { getLastCompetitorScanSummary } from "@/lib/marketing/queries";

describe("getLastCompetitorScanSummary", () => {
  beforeEach(() => {
    mocks.auditLogFindFirst.mockReset();
  });

  it("maps AuditLog after payload into domain summaries with first error", async () => {
    mocks.auditLogFindFirst.mockResolvedValue({
      createdAt: new Date("2026-11-23T12:00:00.000Z"),
      after: {
        writtenTotal: 2,
        unparsedTotal: 1,
        durationMs: 1200,
        truncated: false,
        domains: [
          {
            domain: "parfois.com",
            fetched: 0,
            written: 0,
            unparsed: 0,
            skippedRobots: 0,
            sitemapComplete: false,
            errors: ["HTTP 403 blocked: https://www.parfois.com/x", "other"],
          },
          {
            domain: "aurorajoalharia.com",
            fetched: 3,
            written: 2,
            unparsed: 1,
            skippedRobots: 0,
            sitemapComplete: true,
            errors: [],
          },
        ],
      },
    });

    const summary = await getLastCompetitorScanSummary();
    expect(mocks.auditLogFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { action: "marketing.competitors.scan" },
      }),
    );
    expect(summary).toMatchObject({
      createdAt: "2026-11-23T12:00:00.000Z",
      writtenTotal: 2,
      domains: [
        {
          domain: "parfois.com",
          firstError: "HTTP 403 blocked: https://www.parfois.com/x",
          sitemapComplete: false,
        },
        {
          domain: "aurorajoalharia.com",
          fetched: 3,
          written: 2,
          firstError: null,
          sitemapComplete: true,
        },
      ],
    });
  });

  it("returns null when no scan audit exists", async () => {
    mocks.auditLogFindFirst.mockResolvedValue(null);
    await expect(getLastCompetitorScanSummary()).resolves.toBeNull();
  });
});
