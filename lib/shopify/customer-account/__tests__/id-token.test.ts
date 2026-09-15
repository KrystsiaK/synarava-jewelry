import { generateKeyPairSync, sign } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyShopifyIdToken } from "../id-token";

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("verifyShopifyIdToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects the matching RSA key from Shopify's mixed JWKS", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const header = encode({ alg: "RS256", kid: "shopify-key" });
    const now = Math.floor(Date.now() / 1000);
    const claims = encode({
      aud: "customer-client-id",
      exp: now + 300,
      iat: now,
      iss: "https://shopify.com/authentication/110141768029",
      nonce: "expected-nonce",
    });
    const signature = sign(
      "RSA-SHA256",
      Buffer.from(`${header}.${claims}`, "utf8"),
      privateKey,
    ).toString("base64url");
    const jwk = publicKey.export({ format: "jwk" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        keys: [
          {
            alg: "ED25519",
            crv: "Ed25519",
            kid: "0",
            kty: "OKP",
            use: "sig",
            x: "unrelated-public-key",
          },
          { ...jwk, alg: "RS256", kid: "shopify-key", use: "sig" },
          {
            alg: "ED25519",
            crv: "Ed25519",
            kid: "shop_0",
            kty: "OKP",
            use: "sig",
            x: "another-unrelated-public-key",
          },
        ],
      }),
    );

    await expect(
      verifyShopifyIdToken({
        clientId: "customer-client-id",
        idToken: `${header}.${claims}.${signature}`,
        issuer: "https://shopify.com/authentication/110141768029",
        jwksUri: "https://shopify.com/authentication/.well-known/jwks.json",
        nonce: "expected-nonce",
      }),
    ).resolves.toMatchObject({
      aud: "customer-client-id",
      nonce: "expected-nonce",
    });
  });
});
