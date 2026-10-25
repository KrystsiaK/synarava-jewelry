import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError } from "@/lib/shopify/admin";

const SHOPIFY_STORE_BINDING_KEY = "shopify.store_binding";

function normalizeShopDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function classifyShopifyStoreBinding(boundShopDomain: string | null, currentShopDomain: string) {
  const current = normalizeShopDomain(currentShopDomain);
  if (!boundShopDomain) return { status: "UNBOUND" as const, currentShopDomain: current };
  const bound = normalizeShopDomain(boundShopDomain);
  if (bound === current) return { status: "MATCH" as const, currentShopDomain: current };
  return {
    status: "MISMATCH" as const,
    boundShopDomain: bound,
    currentShopDomain: current,
  };
}

async function getShopifyStoreBinding() {
  const setting = await db.siteSetting.findUnique({ where: { key: SHOPIFY_STORE_BINDING_KEY } });
  const value = setting?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const shopDomain = "shopDomain" in value && typeof value.shopDomain === "string"
    ? value.shopDomain
    : null;
  return shopDomain ? normalizeShopDomain(shopDomain) : null;
}

export async function assertShopifyStoreBinding(currentShopDomain: string) {
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), currentShopDomain);
  if (classification.status === "UNBOUND") {
    throw new ShopifyAdminError(
      "Use the Shopify button in the top bar once to bind this catalog before syncing.",
    );
  }
  if (classification.status === "MISMATCH") {
    throw new ShopifyAdminError(
      `This catalog is linked to ${classification.boundShopDomain}, but the current credentials belong to ${classification.currentShopDomain}. Use the Shopify button in the top bar and resolve the store binding before syncing.`,
    );
  }
  return classification;
}
