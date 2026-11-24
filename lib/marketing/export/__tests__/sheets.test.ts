import { generateKeyPairSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearGoogleTokenCacheForTests } from "@/lib/marketing/google/service-account-auth";
import {
  buildSheetsValues,
  isGoogleSheetsExportEnabled,
  overwriteCompetitorGoogleSheet,
} from "@/lib/marketing/export/sheets";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const SA_JSON = JSON.stringify({
  client_email: "bot@example.iam.gserviceaccount.com",
  private_key: privateKey,
});

describe("Google Sheets export", () => {
  beforeEach(() => {
    clearGoogleTokenCacheForTests();
  });

  it("hides feature when env missing", () => {
    expect(isGoogleSheetsExportEnabled({})).toBe(false);
    expect(
      isGoogleSheetsExportEnabled({
        GOOGLE_SHEETS_ID: "sheet",
        GOOGLE_SERVICE_ACCOUNT_JSON: SA_JSON,
      }),
    ).toBe(true);
  });

  it("builds two-tab value payload", () => {
    const values = buildSheetsValues({
      observations: [
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/1",
          fetchedAt: "2026-11-23T12:00:00.000Z",
          kind: "changed",
          price: "10",
          currency: "EUR",
          availability: "InStock",
          source: "website",
          name: "X",
        },
      ],
      summaryRows: [
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          productsSeen: 1,
          minPrice: 10,
          medianPrice: 10,
          maxPrice: 10,
          changedLast30: 1,
          removedLast30: 0,
          lastFetchedAt: "2026-11-23T12:00:00.000Z",
        },
      ],
    });
    expect(values.observations[0]?.[0]).toBe("brand");
    expect(values.summary[0]?.[0]).toBe("brand");
    expect(values.observations).toHaveLength(2);
  });

  it("issues batchClear + batchUpdate; no calls when env missing", async () => {
    const noop = vi.fn();
    const disabled = await overwriteCompetitorGoogleSheet({
      observations: [],
      summarySource: [],
      env: {},
      fetchFn: noop as unknown as typeof fetch,
    });
    expect(disabled.ok).toBe(false);
    expect(noop).not.toHaveBeenCalled();

    const methods: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      methods.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      if (url.includes(":batchUpdate") && !url.includes("/values")) {
        return Response.json({});
      }
      if (url.includes("values:batchClear")) {
        return Response.json({});
      }
      if (url.includes("values:batchUpdate")) {
        return Response.json({});
      }
      return new Response("no", { status: 404 });
    });

    const result = await overwriteCompetitorGoogleSheet({
      observations: [
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/1",
          fetchedAt: "2026-11-23T12:00:00.000Z",
          kind: "changed",
          price: "10",
          currency: "EUR",
          availability: null,
          source: "website",
          name: "X",
        },
      ],
      summarySource: [
        {
          brand: "Aurora",
          domain: "aurorajoalharia.com",
          url: "https://a/1",
          kind: "changed",
          price: 10,
          fetchedAt: "2026-11-23T12:00:00.000Z",
        },
      ],
      env: {
        GOOGLE_SHEETS_ID: "sheet-1",
        GOOGLE_SERVICE_ACCOUNT_JSON: SA_JSON,
      },
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({
      ok: true,
      observationRows: 1,
      summaryRows: 1,
    });
    expect(methods.some((m) => m.includes("values:batchClear"))).toBe(true);
    expect(methods.some((m) => m.includes("values:batchUpdate"))).toBe(true);
    expect(methods.every((m) => !m.includes("BEGIN PRIVATE"))).toBe(true);
  });
});
