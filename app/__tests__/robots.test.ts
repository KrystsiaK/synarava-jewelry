import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("deployment-aware search metadata", () => {
  it("blocks all crawling and omits sitemap entries on Railway staging", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "staging");
    vi.stubEnv("APP_URL", "https://example-staging.up.railway.app");

    expect(robots()).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    });
    await expect(sitemap()).resolves.toEqual([]);
  });

  it("keeps the public production crawl policy and canonical sitemap", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RAILWAY_ENVIRONMENT_NAME", "production");
    vi.stubEnv("APP_URL", "https://synarava.com");

    expect(robots()).toMatchObject({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://synarava.com/sitemap.xml",
    });
  });
});
