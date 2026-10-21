import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  },
}));

import {
  LANGUAGE_EXPORT_RECEIPT_TTL_MS,
  languageExportReceiptKey,
  recordLanguageExportReceipt,
  verifyLanguageExportReceipt,
} from "@/lib/i18n/language-export-receipt";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({});
  mocks.deleteMany.mockResolvedValue({ count: 1 });
});

describe("language export receipt", () => {
  it("records checksum + timestamp under a SiteSetting key", async () => {
    const exportedAt = new Date("2026-10-20T12:00:00.000Z");
    await recordLanguageExportReceipt("PT", "abc123", exportedAt);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: languageExportReceiptKey("pt") },
      update: {
        value: { checksum: "abc123", exportedAt: "2026-10-20T12:00:00.000Z" },
      },
      create: {
        key: "language-export-receipt:pt",
        value: { checksum: "abc123", exportedAt: "2026-10-20T12:00:00.000Z" },
      },
    });
  });

  it("refuses when no SiteSetting record exists", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(verifyLanguageExportReceipt("pt", "abc123")).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/No recent server-side export receipt/i),
    });
  });

  it("refuses when checksum does not match the receipt", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { checksum: "server-checksum", exportedAt: new Date().toISOString() },
    });
    await expect(verifyLanguageExportReceipt("pt", "client-other")).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/does not match/i),
    });
  });

  it("refuses when the receipt is older than 60 minutes", async () => {
    const now = new Date("2026-10-20T13:00:00.000Z");
    const exportedAt = new Date(now.getTime() - LANGUAGE_EXPORT_RECEIPT_TTL_MS - 1);
    mocks.findUnique.mockResolvedValue({
      value: { checksum: "abc123", exportedAt: exportedAt.toISOString() },
    });
    await expect(verifyLanguageExportReceipt("pt", "abc123", now)).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/expired/i),
    });
  });

  it("accepts a matching checksum within the TTL window", async () => {
    const now = new Date("2026-10-20T13:00:00.000Z");
    const exportedAt = new Date(now.getTime() - LANGUAGE_EXPORT_RECEIPT_TTL_MS + 60_000);
    mocks.findUnique.mockResolvedValue({
      value: { checksum: "abc123", exportedAt: exportedAt.toISOString() },
    });
    await expect(verifyLanguageExportReceipt("pt", "abc123", now)).resolves.toEqual({ ok: true });
  });
});
