import { z } from "zod";

const skuEnvSchema = z.object({
  SKU_API_URL: z.string().url().optional(),
  SKU_API_TOKEN: z.string().min(8).optional(),
  SKU_API_WORKSPACE: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .default("synarava-shop"),
});

export type SkuServiceConfig =
  | {
      readonly configured: true;
      readonly baseUrl: string;
      readonly serviceToken: string;
      readonly workspaceKey: string;
    }
  | { readonly configured: false; readonly reason: string };

/** Synarava → sku-api client config. Secrets stay server-side only. */
export function getSkuServiceConfig(): SkuServiceConfig {
  const parsed = skuEnvSchema.safeParse({
    SKU_API_URL: process.env.SKU_API_URL,
    SKU_API_TOKEN: process.env.SKU_API_TOKEN,
    SKU_API_WORKSPACE: process.env.SKU_API_WORKSPACE ?? "synarava-shop",
  });

  if (!parsed.success) {
    return { configured: false, reason: "SKU env invalid" };
  }

  const { SKU_API_URL, SKU_API_TOKEN, SKU_API_WORKSPACE } = parsed.data;
  if (!SKU_API_URL || !SKU_API_TOKEN) {
    return {
      configured: false,
      reason: "SKU_API_URL and SKU_API_TOKEN are not set (staging gate)",
    };
  }

  return {
    configured: true,
    baseUrl: SKU_API_URL,
    serviceToken: SKU_API_TOKEN,
    workspaceKey: SKU_API_WORKSPACE,
  };
}
