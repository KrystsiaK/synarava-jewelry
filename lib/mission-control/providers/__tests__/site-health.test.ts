import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSiteHealthStatus } from "@/lib/mission-control/providers/site-health";

describe("getSiteHealthStatus", () => {
  const now = new Date("2026-10-19T22:00:00.000Z");

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok when /api/health responds 200 with ok:true", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, service: "synarava-jewelry" }), {
        status: 200,
      }),
    );

    const status = await getSiteHealthStatus({
      baseUrl: "https://shop.example",
      now,
      fetchFn: fetch,
      latencyMsOverride: 42,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://shop.example/api/health",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
    expect(status).toMatchObject({
      nodeKey: "site-health",
      level: "ok",
      href: "/api/health",
      counters: { latencyMs: 42 },
    });
    expect(status.checkedAt).toEqual(now);
    expect(status.updatedAt).toEqual(now);
  });

  it("returns warn when health is ok but latency is high", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    const status = await getSiteHealthStatus({
      baseUrl: "https://shop.example",
      now,
      fetchFn: fetch,
      latencyMsOverride: 2500,
    });

    expect(status.level).toBe("warn");
    expect(status.message).toMatch(/slow/i);
  });

  it("returns down when health reports unavailable", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, reason: "database_unavailable" }),
        { status: 503 },
      ),
    );

    const status = await getSiteHealthStatus({
      baseUrl: "https://shop.example",
      now,
      fetchFn: fetch,
      latencyMsOverride: 10,
    });

    expect(status.level).toBe("down");
    expect(status.message).toMatch(/unavailable|down|503/i);
  });

  it("returns unknown when fetch fails or base URL is missing", async () => {
    const missing = await getSiteHealthStatus({
      baseUrl: "",
      now,
      fetchFn: fetch,
    });
    expect(missing.level).toBe("unknown");

    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    const failed = await getSiteHealthStatus({
      baseUrl: "https://shop.example",
      now,
      fetchFn: fetch,
      latencyMsOverride: 0,
    });
    expect(failed.level).toBe("unknown");
  });
});
