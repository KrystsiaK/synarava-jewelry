import { afterEach, describe, expect, it, vi } from "vitest";
import { getSkuServiceConfig } from "@/lib/sku/config";

describe("getSkuServiceConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports unconfigured when URL/token missing", () => {
    vi.stubEnv("SKU_API_URL", "");
    vi.stubEnv("SKU_API_TOKEN", "");
    expect(getSkuServiceConfig().configured).toBe(false);
  });

  it("returns client config when set", () => {
    vi.stubEnv("SKU_API_URL", "http://127.0.0.1:8787");
    vi.stubEnv("SKU_API_TOKEN", "service-token-value");
    vi.stubEnv("SKU_API_WORKSPACE", "synarava-shop");
    expect(getSkuServiceConfig()).toEqual({
      configured: true,
      baseUrl: "http://127.0.0.1:8787",
      serviceToken: "service-token-value",
      workspaceKey: "synarava-shop",
    });
  });
});
