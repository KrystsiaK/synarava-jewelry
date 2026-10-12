import "server-only";

import { createSkuClient, type SkuClient } from "@synarava/sku-contract";
import { getSkuServiceConfig } from "@/lib/sku/config";

export function tryCreateSkuClient(): SkuClient | null {
  const config = getSkuServiceConfig();
  if (!config.configured) return null;
  return createSkuClient({
    baseUrl: config.baseUrl,
    serviceToken: config.serviceToken,
    workspaceKey: config.workspaceKey,
  });
}
