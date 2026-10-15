import { describe, expect, it } from "vitest";
import {
  authenticateRequest,
  createCredential,
  parseCredentialsEnv,
  verifyServiceToken,
} from "./auth.js";

describe("sku-api auth", () => {
  it("verifies hashed service tokens", () => {
    const credential = createCredential("synarava-shop", "secret-token");
    expect(verifyServiceToken("secret-token", credential)).toBe(true);
    expect(verifyServiceToken("wrong", credential)).toBe(false);
  });

  it("scopes bearer auth to path workspace", () => {
    const credential = createCredential("synarava-shop", "secret-token");
    const env = `${credential.workspaceKey}:${credential.salt}:${credential.tokenHash}`;
    const credentials = parseCredentialsEnv(env);

    expect(
      authenticateRequest({
        authorizationHeader: "Bearer secret-token",
        pathWorkspaceKey: "synarava-shop",
        credentials,
      }),
    ).toEqual({ ok: true, workspaceKey: "synarava-shop" });

    expect(
      authenticateRequest({
        authorizationHeader: "Bearer secret-token",
        pathWorkspaceKey: "other-shop",
        credentials,
      }).ok,
    ).toBe(false);
  });
});
