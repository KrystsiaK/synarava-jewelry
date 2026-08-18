import "server-only";

import { headers } from "next/headers";

export async function getShopifyBuyerIp() {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    null
  );
}
