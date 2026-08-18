import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { getShopifyCustomerAccountConfig } from "./config";

function encryptionKey() {
  return createHash("sha256")
    .update(getShopifyCustomerAccountConfig().sessionSecret, "utf8")
    .digest();
}

export function encryptCustomerSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptCustomerSecret(value: string) {
  const [encodedIv, encodedTag, encodedPayload, ...rest] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedPayload || rest.length > 0) {
    throw new Error("Invalid encrypted customer account value.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(encodedIv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
