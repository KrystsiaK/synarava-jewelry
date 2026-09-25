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

vi.mock("@/lib/content/storefront-copy", () => ({
  getStorefrontCopy: vi.fn(async () => ({
    en: { "footer.careGuide": "Care EN", "footer.privacyPolicy": "Privacy EN" },
    pt: { "footer.careGuide": "Care PT" },
  })),
}));

import { getFooterLinks, setFooterLinks } from "@/lib/content/footer-links";
import {
  DEFAULT_FOOTER_LEGAL_ITEMS,
  DEFAULT_FOOTER_SERVICE_ITEMS,
  FOOTER_LINKS_KEY,
} from "@/lib/content/footer-links-fields";

describe("footer links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns shipped defaults seeded from legacy copy when nothing is stored", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await getFooterLinks();
    expect(result.service.items).toEqual(DEFAULT_FOOTER_SERVICE_ITEMS);
    expect(result.legal.items).toEqual(DEFAULT_FOOTER_LEGAL_ITEMS);
    expect(result.socials.items).toEqual([]);
    expect(result.service.labels.en?.care).toBe("Care EN");
    expect(result.legal.labels.en?.privacy).toBe("Privacy EN");
    expect(result.service.labels.pt?.care).toBe("Care PT");
  });

  it("returns persisted footer links when present", async () => {
    mocks.findUnique.mockResolvedValue({
      value: {
        service: { items: [{ id: "faq", href: "/faq" }], labels: { en: { faq: "FAQ" } } },
        legal: { items: [{ id: "terms", href: "/terms-and-conditions" }], labels: {} },
        socials: { items: [{ id: "ig", href: "https://instagram.com/x" }], labels: {} },
      },
    });
    await expect(getFooterLinks()).resolves.toEqual({
      service: { items: [{ id: "faq", href: "/faq" }], labels: { en: { faq: "FAQ" } } },
      legal: { items: [{ id: "terms", href: "/terms-and-conditions" }], labels: {} },
      socials: { items: [{ id: "ig", href: "https://instagram.com/x" }], labels: {} },
    });
  });

  it("upserts a cleaned payload", async () => {
    mocks.upsert.mockResolvedValue({});
    const result = await setFooterLinks({
      service: {
        items: [
          { id: "care", href: "/care/" },
          { id: "drop", href: "   " },
        ],
        labels: { en: { care: " Care ", orphan: "nope" } },
      },
      legal: { items: [{ id: "privacy", href: "/privacy" }], labels: {} },
      socials: { items: [], labels: {} },
    });
    expect(result.service.items).toEqual([{ id: "care", href: "/care" }]);
    expect(result.service.labels).toEqual({ en: { care: "Care" } });
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { key: FOOTER_LINKS_KEY },
      update: { value: result },
      create: { key: FOOTER_LINKS_KEY, value: result },
    });
  });
});
