import "server-only";

import { db } from "@/lib/db";
import { ShopifyAdminError } from "@/lib/shopify/admin";

const SHOPIFY_STORE_BINDING_KEY = "shopify.store_binding";

function normalizeShopDomain(domain: string) {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function shopDomainFromSettingValue(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const shopDomain = "shopDomain" in value && typeof value.shopDomain === "string"
    ? value.shopDomain
    : null;
  return shopDomain ? normalizeShopDomain(shopDomain) : null;
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
  return shopDomainFromSettingValue(setting?.value);
}

function mismatchError(boundShopDomain: string, currentShopDomain: string) {
  return new ShopifyAdminError(
    `This catalog is linked to ${boundShopDomain}, but the current credentials belong to ${currentShopDomain}. Use the Shopify button in the top bar and resolve the store binding before syncing.`,
  );
}

/**
 * First full catalog check (top-bar Manual / once-per-login Auto): bind when UNBOUND.
 * MATCH → proceed. MISMATCH → fail closed (never overwrite).
 * Called from runCatalogConflictCheck only — Push/Apply use assertShopifyStoreBinding.
 *
 * No rebind UI exists today (rebindShopifyStore was removed with its only callers in #268).
 * Mismatch stays fail-closed until an explicit human-confirmed rebind UI is restored.
 */
export async function ensureShopifyStoreBinding(currentShopDomain: string) {
  const current = normalizeShopDomain(currentShopDomain);
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), current);

  if (classification.status === "MATCH") return classification;
  if (classification.status === "MISMATCH") {
    throw mismatchError(classification.boundShopDomain, classification.currentShopDomain);
  }

  // UNBOUND — re-read inside a transaction so a concurrent bind cannot be overwritten
  // with a different domain (fail closed if another writer already bound elsewhere).
  await db.$transaction(async (tx) => {
    const setting = await tx.siteSetting.findUnique({ where: { key: SHOPIFY_STORE_BINDING_KEY } });
    const existing = shopDomainFromSettingValue(setting?.value);
    const again = classifyShopifyStoreBinding(existing, current);
    if (again.status === "MISMATCH") {
      throw mismatchError(again.boundShopDomain, again.currentShopDomain);
    }
    if (again.status === "MATCH") return;
    await tx.siteSetting.upsert({
      where: { key: SHOPIFY_STORE_BINDING_KEY },
      update: { value: { shopDomain: current } },
      create: { key: SHOPIFY_STORE_BINDING_KEY, value: { shopDomain: current } },
    });
  });

  return { status: "MATCH" as const, currentShopDomain: current };
}

export async function assertShopifyStoreBinding(currentShopDomain: string) {
  const classification = classifyShopifyStoreBinding(await getShopifyStoreBinding(), currentShopDomain);
  if (classification.status === "UNBOUND") {
    throw new ShopifyAdminError(
      "Use the Shopify button in the top bar once to bind this catalog before syncing.",
    );
  }
  if (classification.status === "MISMATCH") {
    throw mismatchError(classification.boundShopDomain, classification.currentShopDomain);
  }
  return classification;
}
