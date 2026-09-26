import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAdminSession: vi.fn(),
  findSetting: vi.fn(),
  findAsset: vi.fn(),
  deleteAsset: vi.fn(),
  upsertAsset: vi.fn(),
  upsertSetting: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  getCurrentAdminSession: mocks.getCurrentAdminSession,
}));

vi.mock("@/lib/db", () => ({
  db: {
    siteSetting: { findUnique: mocks.findSetting },
    mediaAsset: {
      findUnique: mocks.findAsset,
      deleteMany: mocks.deleteAsset,
    },
    $transaction: async (run: (tx: {
      mediaAsset: { upsert: typeof mocks.upsertAsset };
      siteSetting: { upsert: typeof mocks.upsertSetting };
    }) => Promise<void>) => run({
      mediaAsset: { upsert: mocks.upsertAsset },
      siteSetting: { upsert: mocks.upsertSetting },
    }),
  },
}));

vi.mock("@/lib/s3", () => ({
  getS3: () => ({ send: mocks.send }),
  getS3Bucket: () => "synarava-media",
  getS3PublicUrl: (key: string) => `/media/${key}`,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: vi.fn(),
  revalidateStorefrontTemplate: vi.fn(),
}));

import { POST } from "../route";

const beads = "/media/uploads/videos/homeBeads/beads-film.mp4";
const beadsKey = "uploads/videos/homeBeads/beads-film.mp4";

function request(body: FormData) {
  return { formData: async () => body } as Request;
}

function deletedKey() {
  const command = mocks.send.mock.calls.find(([input]) => input?.input?.Key === beadsKey)?.[0];
  return command?.input?.Key as string | undefined;
}

describe("POST /admin/api/videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAdminSession.mockResolvedValue({ username: "admin" });
    mocks.findSetting.mockResolvedValue({ value: { homeBeads: beads } });
    mocks.findAsset.mockResolvedValue({
      id: "asset-1",
      _count: {
        productPrimaryFor: 0,
        collectionHeroFor: 0,
        collectionCoverFor: 0,
        productMedia: 0,
      },
    });
    mocks.send.mockResolvedValue({});
    mocks.deleteAsset.mockResolvedValue({ count: 1 });
    mocks.upsertSetting.mockResolvedValue({});
    mocks.upsertAsset.mockResolvedValue({});
  });

  it("rejects a request without an admin session", async () => {
    mocks.getCurrentAdminSession.mockResolvedValue(null);
    const body = new FormData();
    body.set("remove_homeBeads", "1");

    const response = await POST(request(body));

    expect(response.status).toBe(401);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("deletes the bucket object when a slot is removed", async () => {
    const body = new FormData();
    body.set("remove_homeBeads", "1");

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(mocks.upsertSetting).toHaveBeenCalledWith(expect.objectContaining({
      update: { value: { homeBeads: "" } },
    }));
    expect(deletedKey()).toBe(beadsKey);
    expect(mocks.deleteAsset).toHaveBeenCalledWith({ where: { id: "asset-1", key: beadsKey } });
  });

  it("leaves the object when another slot still uses it", async () => {
    mocks.findSetting.mockResolvedValue({ value: { homeBeads: beads, homeModel: beads } });
    const body = new FormData();
    body.set("remove_homeBeads", "1");

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.deleteAsset).not.toHaveBeenCalled();
  });

  it("leaves the object when a product or collection still attaches it", async () => {
    mocks.findAsset.mockResolvedValue({
      id: "asset-1",
      _count: {
        productPrimaryFor: 0,
        collectionHeroFor: 0,
        collectionCoverFor: 0,
        productMedia: 1,
      },
    });
    const body = new FormData();
    body.set("remove_homeBeads", "1");

    const response = await POST(request(body));

    expect(response.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reports a bucket failure after the slot is already cleared", async () => {
    mocks.send.mockRejectedValue(new Error("storage down"));
    const body = new FormData();
    body.set("remove_homeBeads", "1");

    const response = await POST(request(body));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("The video was cleared on the site, but the file is still in the bucket.");
    expect(mocks.upsertSetting).toHaveBeenCalled();
  });
});
