import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
    },
  },
}));

import {
  DEFAULT_FOOTER_CONTACT_EMAIL,
  FOOTER_CONTACT_KEY,
  getFooterContactEmail,
  setFooterContactEmail,
} from "@/lib/content/footer-contact";

describe("footer contact email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the shipped default when nothing is stored", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getFooterContactEmail()).resolves.toBe(DEFAULT_FOOTER_CONTACT_EMAIL);
  });

  it("returns the persisted email", async () => {
    mocks.findUnique.mockResolvedValue({ value: { email: "hello@synarava.com" } });
    await expect(getFooterContactEmail()).resolves.toBe("hello@synarava.com");
  });

  it("rejects an invalid address", async () => {
    await expect(setFooterContactEmail("not-an-email")).rejects.toThrow(/valid address/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts a trimmed email", async () => {
    mocks.upsert.mockResolvedValue({});
    await expect(setFooterContactEmail("  ops@synarava.com ")).resolves.toBe("ops@synarava.com");
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: FOOTER_CONTACT_KEY },
      update: { value: { email: "ops@synarava.com" } },
      create: { key: FOOTER_CONTACT_KEY, value: { email: "ops@synarava.com" } },
    });
  });
});
