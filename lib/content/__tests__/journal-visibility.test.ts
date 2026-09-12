import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { siteSetting: { findUnique: mocks.findUnique, upsert: mocks.upsert } },
}));

import { isJournalNavVisible, setJournalNavVisible } from "@/lib/content/journal-visibility";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("journal nav visibility", () => {
  it("defaults to hidden when no setting has been saved yet", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(isJournalNavVisible()).resolves.toBe(false);
  });

  it("stays hidden for a malformed or unrelated setting value", async () => {
    mocks.findUnique.mockResolvedValue({ value: { somethingElse: true } });
    await expect(isJournalNavVisible()).resolves.toBe(false);
  });

  it("reports visible once explicitly turned on", async () => {
    mocks.findUnique.mockResolvedValue({ value: { visible: true } });
    await expect(isJournalNavVisible()).resolves.toBe(true);
  });

  it("persists the flag under a stable key", async () => {
    await setJournalNavVisible(true);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: "nav.journal_visible" },
      update: { value: { visible: true } },
      create: { key: "nav.journal_visible", value: { visible: true } },
    });
  });
});
