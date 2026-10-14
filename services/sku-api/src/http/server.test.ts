import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "@synarava/sku-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createCredential } from "../auth.js";
import {
  createMemorySkuRegistryStore,
  publishExampleProfile,
} from "../registry/memory-store.js";
import { createFixedWindowRateLimiter } from "./rate-limit.js";
import { createSkuHttpServer } from "./server.js";

describe("sku-api http", () => {
  let server: Server;
  let baseUrl: string;
  const token = "test-service-token-001";
  const credential = createCredential("synarava-shop", token);

  beforeAll(async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    server = createSkuHttpServer({
      store,
      credentials: [credential],
      ready: () => true,
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("no listen address");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("health is ready", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, ready: true });
  });

  it("rejects missing auth", async () => {
    const res = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/skus/preview`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          familyKey: "jewelry.necklace",
          correlationId: "corr-http-1",
        }),
      },
    );
    expect(res.status).toBe(401);
  });

  it("preview / reserve / validate with workspace isolation", async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": "http-idem-1",
    };

    const preview = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/skus/preview`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyKey: "jewelry.necklace",
          correlationId: "corr-http-preview",
        }),
      },
    );
    expect(preview.status).toBe(200);
    const previewBody = (await preview.json()) as { sku: string };
    expect(previewBody.sku).toBe("JW-NECK-001");

    const reserve = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/reservations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyKey: "jewelry.necklace",
          correlationId: "corr-http-reserve",
        }),
      },
    );
    expect(reserve.status).toBe(200);
    const reserved = (await reserve.json()) as {
      reservationId: string;
      sku: string;
    };
    expect(reserved.sku).toBe("JW-NECK-001");

    const validate = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/skus/validate`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          sku: reserved.sku,
          correlationId: "corr-http-validate",
        }),
      },
    );
    expect(validate.status).toBe(200);
    await expect(validate.json()).resolves.toMatchObject({
      ok: true,
      validFormat: true,
      reservationStatus: "pending",
    });

    const foreign = await fetch(
      `${baseUrl}/v1/workspaces/other-shop/skus/preview`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyKey: "jewelry.necklace",
          correlationId: "corr-http-foreign",
        }),
      },
    );
    expect(foreign.status).toBe(403);
  });

  it("returns RATE_LIMITED when the per-minute budget is exhausted", async () => {
    const store = createMemorySkuRegistryStore();
    await store.ensureWorkspace("synarava-shop");
    await publishExampleProfile(store, SYNARAVA_SHOP_PROFILE_V1_EXAMPLE);
    const limitedServer = createSkuHttpServer({
      store,
      credentials: [credential],
      ready: () => true,
      rateLimiter: createFixedWindowRateLimiter({ limitPerMinute: 1 }),
    });
    await new Promise<void>((resolve) => {
      limitedServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = limitedServer.address();
    if (!address || typeof address === "string") {
      throw new Error("no listen address");
    }
    const limitedBase = `http://127.0.0.1:${address.port}`;
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    const first = await fetch(`${limitedBase}/v1/workspaces/synarava-shop/profiles`, {
      headers,
    });
    expect(first.status).toBe(200);
    const second = await fetch(
      `${limitedBase}/v1/workspaces/synarava-shop/profiles`,
      { headers },
    );
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
    });
    await new Promise<void>((resolve, reject) => {
      limitedServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("rate-limits before auth so bad tokens cannot burn scrypt budget", async () => {
    const store = createMemorySkuRegistryStore();
    const limitedServer = createSkuHttpServer({
      store,
      credentials: [credential],
      ready: () => true,
      rateLimiter: createFixedWindowRateLimiter({ limitPerMinute: 1 }),
    });
    await new Promise<void>((resolve) => {
      limitedServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = limitedServer.address();
    if (!address || typeof address === "string") {
      throw new Error("no listen address");
    }
    const limitedBase = `http://127.0.0.1:${address.port}`;
    const badHeaders = {
      authorization: "Bearer wrong-token",
      "content-type": "application/json",
    };
    const first = await fetch(`${limitedBase}/v1/workspaces/synarava-shop/profiles`, {
      headers: badHeaders,
    });
    expect(first.status).toBe(401);
    const second = await fetch(
      `${limitedBase}/v1/workspaces/synarava-shop/profiles`,
      { headers: badHeaders },
    );
    expect(second.status).toBe(429);
    await expect(second.json()).resolves.toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
    });
    await new Promise<void>((resolve, reject) => {
      limitedServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("catalog audit is read-only and notifies only on new digest", async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": "http-audit-idem-1",
    };

    const reserve = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/reservations`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          familyKey: "jewelry.bracelet",
          correlationId: "corr-http-audit-reserve",
        }),
      },
    );
    expect(reserve.status).toBe(200);
    const reserved = (await reserve.json()) as {
      reservationId: string;
      sku: string;
    };

    const confirm = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/assignments/confirm`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reservationId: reserved.reservationId,
          sku: reserved.sku,
          externalSystem: "shopify",
          externalShop: "staging.myshopify.com",
          externalProductId: "gid://shopify/Product/audit",
          externalVariantId: "gid://shopify/ProductVariant/audit",
          shopifyReadBackSku: reserved.sku,
          correlationId: "corr-http-audit-confirm",
        }),
      },
    );
    expect(confirm.status).toBe(200);

    const first = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/audit/catalog`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              externalVariantId: "gid://shopify/ProductVariant/audit",
              sku: "JW-BRACELET-999",
            },
          ],
          previousDigest: null,
          correlationId: "corr-http-audit-1",
        }),
      },
    );
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as {
      shouldNotify: boolean;
      digest: string;
      deviationCount: number;
      llmEnabled: boolean;
    };
    expect(firstBody.shouldNotify).toBe(true);
    expect(firstBody.deviationCount).toBe(1);
    expect(firstBody.llmEnabled).toBe(false);

    const second = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/audit/catalog`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: [
            {
              externalVariantId: "gid://shopify/ProductVariant/audit",
              sku: "JW-BRACELET-999",
            },
          ],
          previousDigest: firstBody.digest,
          correlationId: "corr-http-audit-2",
        }),
      },
    );
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      shouldNotify: false,
      digest: firstBody.digest,
      deviationCount: 1,
      llmEnabled: false,
    });
  });

  it("draft and publish profile versions", async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
    const draft = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/profiles`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          version: 2,
          separator: "-",
          suffix: { width: 3, start: 1, reuse: false },
          families: {
            ...SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.families,
            "jewelry.ring": "JW-RING",
          },
          allowedCharacters: SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.allowedCharacters,
          correlationId: "corr-profile-draft",
        }),
      },
    );
    expect(draft.status).toBe(200);

    const publish = await fetch(
      `${baseUrl}/v1/workspaces/synarava-shop/profiles/2/publish`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ correlationId: "corr-profile-publish" }),
      },
    );
    expect(publish.status).toBe(200);

    const list = await fetch(`${baseUrl}/v1/workspaces/synarava-shop/profiles`, {
      headers,
    });
    const body = (await list.json()) as {
      profiles: Array<{ version: number; status: string }>;
    };
    expect(body.profiles.some((p) => p.version === 2 && p.status === "published")).toBe(
      true,
    );
  });
});
