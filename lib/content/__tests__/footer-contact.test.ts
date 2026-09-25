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
  getFooterContactEmails,
  setFooterContactEmail,
  setFooterContactEmails,
} from "@/lib/content/footer-contact";

describe("footer contact email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the shipped default when nothing is stored", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(getFooterContactEmail()).resolves.toBe(DEFAULT_FOOTER_CONTACT_EMAIL);
    await expect(getFooterContactEmails()).resolves.toEqual([DEFAULT_FOOTER_CONTACT_EMAIL]);
  });

  it("returns the persisted legacy single email", async () => {
    mocks.findUnique.mockResolvedValue({ value: { email: "hello@synarava.com" } });
    await expect(getFooterContactEmail()).resolves.toBe("hello@synarava.com");
  });

  it("returns multiple persisted emails", async () => {
    mocks.findUnique.mockResolvedValue({
      value: { emails: ["a@synarava.com", "b@synarava.com"] },
    });
    await expect(getFooterContactEmails()).resolves.toEqual(["a@synarava.com", "b@synarava.com"]);
    await expect(getFooterContactEmail()).resolves.toBe("a@synarava.com");
  });

  it("rejects an invalid address", async () => {
    await expect(setFooterContactEmail("not-an-email")).rejects.toThrow(/valid|email/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("upserts a trimmed email list", async () => {
    mocks.upsert.mockResolvedValue({});
    await expect(setFooterContactEmails(["  ops@synarava.com ", "hello@synarava.com"])).resolves.toEqual({
      emails: ["ops@synarava.com", "hello@synarava.com"],
    });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: FOOTER_CONTACT_KEY },
      update: { value: { emails: ["ops@synarava.com", "hello@synarava.com"] } },
      create: { key: FOOTER_CONTACT_KEY, value: { emails: ["ops@synarava.com", "hello@synarava.com"] } },
    });
  });
});
