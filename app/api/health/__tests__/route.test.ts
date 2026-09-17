import { beforeEach, describe, expect, it, vi } from "vitest";

const { state } = vi.hoisted(() => ({ state: { unavailable: false } }));
vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: () => {
      if (state.unavailable) throw new Error("connection refused");
      return Promise.resolve([{ "?column?": 1 }]);
    },
  },
}));

import { GET } from "../route";

describe("readiness endpoint", () => {
  beforeEach(() => {
    state.unavailable = false;
  });

  it("reports ready when PostgreSQL responds", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it("returns 503 when PostgreSQL is unavailable", async () => {
    state.unavailable = true;
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ ok: false, reason: "database_unavailable" });
  });
});
