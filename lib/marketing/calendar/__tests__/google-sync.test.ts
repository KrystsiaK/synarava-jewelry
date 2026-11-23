import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGoogleCalendarTokenCacheForTests,
  fetchGoogleCalendarAccessToken,
  parseGoogleServiceAccountJson,
  signGoogleServiceAccountJwt,
} from "@/lib/marketing/calendar/google-auth";
import { isGoogleCalendarSyncEnabled } from "@/lib/marketing/calendar/config";
import { syncIdeaToGoogleCalendar } from "@/lib/marketing/calendar/google-sync";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const SA_JSON = JSON.stringify({
  client_email: "bot@example.iam.gserviceaccount.com",
  private_key: privateKey,
});

const idea = {
  id: "idea1",
  productIds: ["p1"],
  script: "Локация: кафе\nКрупный план",
  shotList: ["руки", "деталь"],
  hook: { en: "Soft stack", pt: "Stack suave" },
  plannedFor: "2026-12-01T12:00:00.000Z",
  calendarEventId: null as string | null,
};

const productNames = new Map([["p1", "Beaded Bracelet"]]);

const envOn = {
  GOOGLE_CALENDAR_ID: "primary",
  GOOGLE_SERVICE_ACCOUNT_JSON: SA_JSON,
};

describe("google calendar auth", () => {
  beforeEach(() => {
    clearGoogleCalendarTokenCacheForTests();
  });

  it("parses service account and signs RS256 JWT", () => {
    const sa = parseGoogleServiceAccountJson(SA_JSON);
    expect(sa?.client_email).toContain("@");
    const jwt = signGoogleServiceAccountJwt(sa!);
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("caches access token until expiry", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ access_token: "tok-1", expires_in: 3600 }),
    );
    const sa = parseGoogleServiceAccountJson(SA_JSON)!;
    const a = await fetchGoogleCalendarAccessToken({
      sa,
      fetchFn: fetchFn as unknown as typeof fetch,
      nowMs: 1_000_000,
    });
    const b = await fetchGoogleCalendarAccessToken({
      sa,
      fetchFn: fetchFn as unknown as typeof fetch,
      nowMs: 1_000_000 + 10_000,
    });
    expect(a).toBe("tok-1");
    expect(b).toBe("tok-1");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("is disabled when env missing", () => {
    expect(isGoogleCalendarSyncEnabled({})).toBe(false);
    expect(
      isGoogleCalendarSyncEnabled({ GOOGLE_CALENDAR_ID: "x" }),
    ).toBe(false);
    expect(isGoogleCalendarSyncEnabled(envOn)).toBe(true);
  });
});

describe("syncIdeaToGoogleCalendar", () => {
  beforeEach(() => {
    clearGoogleCalendarTokenCacheForTests();
  });

  afterEach(() => {
    clearGoogleCalendarTokenCacheForTests();
  });

  it("makes no network calls when env missing", async () => {
    const fetchFn = vi.fn();
    const result = await syncIdeaToGoogleCalendar({
      idea,
      productNameById: productNames,
      op: "upsert",
      env: {},
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, skipped: true, reason: "disabled" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("inserts on approve (no existing event id)", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      if (url.includes("/calendars/") && init?.method === "POST") {
        return Response.json({ id: "evt-1" });
      }
      return new Response("no", { status: 404 });
    });
    const result = await syncIdeaToGoogleCalendar({
      idea: { ...idea, calendarEventId: null },
      productNameById: productNames,
      op: "upsert",
      env: envOn,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, action: "insert", eventId: "evt-1" });
    const post = fetchFn.mock.calls.find((c) => {
      const url = String(c[0]);
      const method = (c[1] as RequestInit | undefined)?.method;
      return method === "POST" && url.includes("/calendars/");
    });
    expect(String(post?.[0])).toContain("www.googleapis.com/calendar");
    const body = JSON.parse(String((post?.[1] as RequestInit).body));
    expect(body.summary).toContain("Beaded Bracelet");
    expect(body.start.date).toBe("2026-12-01");
  });

  it("patches on date change when event id exists", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      if (url.includes("/events/evt-9") && init?.method === "PATCH") {
        return Response.json({ id: "evt-9" });
      }
      return new Response("no", { status: 404 });
    });
    const result = await syncIdeaToGoogleCalendar({
      idea: {
        ...idea,
        calendarEventId: "evt-9",
        plannedFor: "2026-12-15T12:00:00.000Z",
      },
      productNameById: productNames,
      op: "upsert",
      env: envOn,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, action: "patch", eventId: "evt-9" });
  });

  it("deletes on reject", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "tok", expires_in: 3600 });
      }
      if (url.includes("/events/evt-9") && init?.method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      return new Response("no", { status: 404 });
    });
    const result = await syncIdeaToGoogleCalendar({
      idea: { ...idea, calendarEventId: "evt-9" },
      productNameById: productNames,
      op: "delete",
      env: envOn,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, action: "delete", eventId: null });
  });

  it("stores failure without throwing; redacts secrets", async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "super-secret-token", expires_in: 3600 });
      }
      return new Response("Bearer super-secret-token boom", { status: 500 });
    });
    const result = await syncIdeaToGoogleCalendar({
      idea: { ...idea, calendarEventId: null },
      productNameById: productNames,
      op: "upsert",
      env: envOn,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("super-secret-token");
      expect(result.error).toContain("[redacted]");
    }
  });

  it("never puts private key in signed assertion payload stringification of errors", () => {
    const sa = parseGoogleServiceAccountJson(SA_JSON)!;
    const jwt = signGoogleServiceAccountJwt(sa);
    expect(jwt).not.toContain("BEGIN PRIVATE KEY");
    expect(JSON.stringify({ jwt })).not.toContain("BEGIN PRIVATE KEY");
  });
});
