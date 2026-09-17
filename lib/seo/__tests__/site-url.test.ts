import { afterEach, describe, expect, it } from "vitest";
import { getPublicSiteUrl } from "../site-url";

const originalAppUrl = process.env.APP_URL;
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  process.env.NODE_ENV = originalNodeEnv;
});

describe("public site URL", () => {
  it("uses APP_URL as the shared SEO origin", () => {
    process.env.APP_URL = "https://synarava.com/path/";
    process.env.NEXT_PUBLIC_SITE_URL = "https://old.example";
    expect(getPublicSiteUrl()).toBe("https://synarava.com");
  });

  it("refuses a localhost fallback in production", () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "production";
    expect(() => getPublicSiteUrl()).toThrow("APP_URL must be set");
  });
});
