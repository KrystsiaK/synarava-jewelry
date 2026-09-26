"use client";

import {
  buildOurCommerceStoreAction,
  compareAndPersistCommerceStoresAction,
  fetchShopifyCommerceStoreAction,
} from "@/app/admin/actions/sync";

let inFlight: Promise<void> | null = null;

/**
 * Browser console walkthrough of the dual-store refresh.
 * Deduped: React Strict Mode / list+editor must not run two Shopify sweeps.
 */
export function runCommerceStoreConsoleFlow(source: string): Promise<void> {
  if (inFlight) {
    console.log(`[commerce-store] already running — join (${source})`);
    return inFlight;
  }
  inFlight = runFlow(source).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlow(source: string): Promise<void> {
  const tag = "[commerce-store]";
  console.log(`${tag} ── FLOW START (${source}) ──`);
  console.log(`${tag} 1. Building OUR snapshot from DB…`);

  const ourResult = await buildOurCommerceStoreAction();
  if ("error" in ourResult) {
    console.error(`${tag} 1. FAILED building OUR:`, ourResult.error);
    return;
  }
  console.log(
    `${tag} 2. GOT OUR snapshot (${Object.keys(ourResult.our.products).length} products):`,
    ourResult.our,
  );

  console.log(`${tag} 3. Fetching SHOPIFY snapshot (paginated catalog — not per-product)…`);
  const shopifyResult = await fetchShopifyCommerceStoreAction();
  if ("error" in shopifyResult) {
    console.error(`${tag} 3. FAILED fetching SHOPIFY:`, shopifyResult.error);
    return;
  }
  console.log(
    `${tag} 4. GOT SHOPIFY snapshot (${Object.keys(shopifyResult.shopify.products).length} products):`,
    shopifyResult.shopify,
  );

  console.log(`${tag} 5. Comparing OUR vs SHOPIFY…`);
  const compareResult = await compareAndPersistCommerceStoresAction(
    ourResult.our,
    shopifyResult.shopify,
  );
  if ("error" in compareResult) {
    console.error(`${tag} 5. FAILED compare/persist:`, compareResult.error);
    return;
  }
  console.log(
    `${tag} 6. GOT conflict products (${compareResult.conflicts.length}):`,
    compareResult.conflicts,
  );
  console.log(`${tag} 7. Persisted both snapshots to CommerceSyncStore.`, compareResult.debug);
  console.log(`${tag} ── FLOW DONE ──`);
}
