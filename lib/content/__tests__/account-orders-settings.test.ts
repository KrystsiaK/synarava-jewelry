import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

describe("account orders settings", () => {
  beforeEach(() => {
    vi.resetModules();
    findUnique.mockReset();
    upsert.mockReset();
  });

  it("returns freeze defaults when nothing is stored", async () => {
    findUnique.mockResolvedValue(null);
    const { getAccountOrdersSettings } = await import("../account-orders-settings");
    await expect(getAccountOrdersSettings()).resolves.toEqual({
      buyAgainOnOrdersEnabled: false,
      headlessReturnEnabled: false,
    });
  });

  it("persists boolean toggles without inventing an Order store", async () => {
    findUnique.mockResolvedValue({ key: "account-orders-settings-v1", value: {} });
    upsert.mockResolvedValue({});
    const { setAccountOrdersSettings } = await import("../account-orders-settings");
    await expect(
      setAccountOrdersSettings({ buyAgainOnOrdersEnabled: true, headlessReturnEnabled: true }),
    ).resolves.toEqual({
      buyAgainOnOrdersEnabled: true,
      headlessReturnEnabled: true,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "account-orders-settings-v1" },
        create: {
          key: "account-orders-settings-v1",
          value: { buyAgainOnOrdersEnabled: true, headlessReturnEnabled: true },
        },
      }),
    );
  });
});
