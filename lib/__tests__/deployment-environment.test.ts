import { describe, expect, it } from "vitest";

import {
  allowNonProductionAnalytics,
  isProductionDeployment,
} from "@/lib/deployment-environment";

describe("deployment environment", () => {
  it("treats Railway production as public production", () => {
    expect(isProductionDeployment({
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT_NAME: "production",
    })).toBe(true);
  });

  it("does not mistake a Railway staging production build for the public shop", () => {
    expect(isProductionDeployment({
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT_NAME: "staging",
    })).toBe(false);
  });

  it("falls back to NODE_ENV outside Railway", () => {
    expect(isProductionDeployment({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionDeployment({ NODE_ENV: "development" })).toBe(false);
  });

  it("requires an explicit override for analytics outside production", () => {
    expect(allowNonProductionAnalytics({
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT_NAME: "staging",
    })).toBe(false);
    expect(allowNonProductionAnalytics({
      NODE_ENV: "production",
      RAILWAY_ENVIRONMENT_NAME: "staging",
      ENABLE_NON_PRODUCTION_ANALYTICS: "true",
    })).toBe(true);
  });
});
