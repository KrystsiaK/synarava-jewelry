import "server-only";

import { headers } from "next/headers";
import { getTrustedClientIp } from "@/lib/security/request-ip";

export async function getShopifyBuyerIp() {
  const requestHeaders = await headers();
  const ip = getTrustedClientIp(requestHeaders);
  return ip === "unknown" ? null : ip;
}
