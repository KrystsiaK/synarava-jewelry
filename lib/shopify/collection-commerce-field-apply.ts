import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ShopifyAdminError, shopifyAdminRequest } from "@/lib/shopify/admin";

import { commerceFingerprint } from "./catalog-conflict";
import {
  isScopedCollectionCommerceFieldLabel,
  SCOPED_COLLECTION_COMMERCE_FIELD_LABELS,
} from "./catalog-conflict-policy";
import {
  buildCollectionWindowFromColumns,
  collectionCommerceInputFromWindow,
  diffCollectionCommerceWindows,
  writeThroughLocalCollectionToProjection,
} from "./collection-commerce-projection";
import { refreshShopifyCollectionState } from "./collection-presence-server";

export { isScopedCollectionCommerceFieldLabel, SCOPED_COLLECTION_COMMERCE_FIELD_LABELS };

export type CollectionCommerceFieldApplyResult =
  | { ok: true; message: string }
  | { ok: false; reason: "STALE" | "UNSUPPORTED" | "WRITE_FAILED"; message: string };

function rawValue(displayValue: string): string {
  return displayValue === "—" ? "" : displayValue;
}

function patchForLabel(label: string, value: string): {
  title?: string;
  handle?: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
} {
  if (label === "Name") return { title: value };
  if (label === "Handle") return { handle: value.trim() };
  if (label === "Description") return { description: value || null };
  if (label === "SEO title") return { seoTitle: value || null };
  if (label === "SEO description") return { seoDescription: value || null };
  return {};
}

async function writeLocally(collectionId: string, label: string, value: string) {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      shopifyCollectionId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!collection) throw new Error("Collection was not found.");

  if (label === "Handle") {
    const handle = value.trim();
    if (!handle) throw new Error("Handle cannot be empty.");
    const clash = await db.collection.findFirst({
      where: { slug: handle, NOT: { id: collectionId } },
      select: { id: true },
    });
    if (clash) throw new Error(`Handle "${handle}" is already used by another Synarava collection.`);
  }

  const columnData: Prisma.CollectionUpdateInput = {};
  if (label === "Name") columnData.name = value;
  if (label === "Handle") {
    columnData.slug = value.trim();
    columnData.shopifyHandle = value.trim();
  }
  if (label === "Description") columnData.description = value || null;
  if (label === "SEO title") columnData.seoTitle = value || null;
  if (label === "SEO description") columnData.seoDescription = value || null;

  const base = collection.workingSnapshot
    ?? buildCollectionWindowFromColumns({
      shopifyCollectionId: collection.shopifyCollectionId,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
      shopifySnapshot: collection.shopifySnapshot,
    });
  const nextWorking = writeThroughLocalCollectionToProjection(base, {
    id: collection.shopifyCollectionId,
    ...patchForLabel(label, value),
  });

  const updated = await db.collection.update({
    where: { id: collectionId },
    data: {
      ...columnData,
      workingSnapshot: nextWorking as Prisma.InputJsonValue,
      syncStatus: "CONFLICT",
      syncError: "workingSnapshot and shopifySnapshot differ.",
    },
  });

  if (label === "Name" && updated.name !== value) {
    throw new Error("Local write did not take effect as expected.");
  }
  if (label === "Handle" && updated.slug !== value.trim()) {
    throw new Error("Local write did not take effect as expected.");
  }

  // EN copy lives on Collection base columns only — no CollectionTranslation locale=en row.
}

async function writeToShopify(collectionId: string, label: string, value: string) {
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      shopifyCollectionId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!collection) throw new Error("Collection was not found.");
  if (!collection.shopifyCollectionId) {
    throw new ShopifyAdminError("This collection is not linked to Shopify.");
  }

  const window = writeThroughLocalCollectionToProjection(
    collection.workingSnapshot
      ?? buildCollectionWindowFromColumns({
        shopifyCollectionId: collection.shopifyCollectionId,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        seoTitle: collection.seoTitle,
        seoDescription: collection.seoDescription,
        shopifySnapshot: collection.shopifySnapshot,
      }),
    { id: collection.shopifyCollectionId, ...patchForLabel(label, value) },
  );
  const input = collectionCommerceInputFromWindow(window);
  const result = await shopifyAdminRequest<{
    collectionUpdate: {
      collection: { id: string; handle: string; updatedAt?: string } | null;
      userErrors: Array<{ field?: string[]; message: string }>;
    };
  }>(
    `mutation SynaravaCollectionCommerceFieldUpdate($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection { id handle updatedAt }
        userErrors { field message }
      }
    }`,
    {
      input: {
        id: collection.shopifyCollectionId,
        title: input.title,
        handle: input.handle || undefined,
        descriptionHtml: input.descriptionHtml,
        seo: input.seo,
      },
    },
  );
  if (result.collectionUpdate.userErrors.length > 0) {
    throw new ShopifyAdminError(result.collectionUpdate.userErrors.map((error) => error.message).join("; "));
  }
  if (!result.collectionUpdate.collection) {
    throw new ShopifyAdminError("Shopify did not return the updated collection.");
  }

  // Keep OUR window in sync with what we pushed for this field, then refresh Shopify copy.
  await db.collection.update({
    where: { id: collectionId },
    data: {
      workingSnapshot: window as Prisma.InputJsonValue,
      ...(label === "Name" ? { name: value } : {}),
      ...(label === "Handle" ? { slug: value.trim(), shopifyHandle: value.trim() } : {}),
      ...(label === "Description" ? { description: value || null } : {}),
      ...(label === "SEO title" ? { seoTitle: value || null } : {}),
      ...(label === "SEO description" ? { seoDescription: value || null } : {}),
    },
  });
  await refreshShopifyCollectionState(collection.shopifyCollectionId);
}

/**
 * Apply one collection commerce field. Re-validates fingerprints against the
 * stored windows immediately before writing (same contract as product scoped apply).
 */
export async function applyCollectionCommerceField({
  collectionId,
  label,
  direction,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
}: {
  collectionId: string;
  label: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
}): Promise<CollectionCommerceFieldApplyResult> {
  if (!isScopedCollectionCommerceFieldLabel(label)) {
    return { ok: false, reason: "UNSUPPORTED", message: `${label} is not a supported collection commerce field.` };
  }

  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      shopifyCollectionId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!collection) {
    return { ok: false, reason: "STALE", message: "This collection no longer exists." };
  }
  if (!collection.shopifyCollectionId) {
    return { ok: false, reason: "UNSUPPORTED", message: "This collection is not linked to Shopify." };
  }
  if (collection.workingSnapshot == null) {
    return {
      ok: false,
      reason: "UNSUPPORTED",
      message: "Synarava has no commerce window yet. Adopt Shopify first.",
    };
  }

  const working = collection.workingSnapshot;
  const shopify = collection.shopifySnapshot
    ?? buildCollectionWindowFromColumns({
      shopifyCollectionId: collection.shopifyCollectionId,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
    });
  const differences = diffCollectionCommerceWindows(working, shopify);
  const difference = differences.find((item) => item.field === label);
  if (!difference) {
    return { ok: false, reason: "STALE", message: "This field is no longer different — it may already have been resolved." };
  }
  if (
    commerceFingerprint(difference.local) !== expectedLocalFingerprint
    || commerceFingerprint(difference.shopify) !== expectedShopifyFingerprint
  ) {
    return { ok: false, reason: "STALE", message: "Synarava or Shopify changed since this was reviewed. Refresh and try again." };
  }

  try {
    const value = rawValue(direction === "SHOPIFY_TO_SYNARAVA" ? difference.shopify : difference.local);
    if (direction === "SHOPIFY_TO_SYNARAVA") {
      await writeLocally(collectionId, label, value);
    } else {
      await writeToShopify(collectionId, label, value);
    }

    // Re-check the applied field against stored windows.
    const after = await db.collection.findUnique({
      where: { id: collectionId },
      select: { workingSnapshot: true, shopifySnapshot: true },
    });
    if (!after) {
      return { ok: false, reason: "WRITE_FAILED", message: "Collection disappeared after apply." };
    }
    const stillOpen = diffCollectionCommerceWindows(after.workingSnapshot, after.shopifySnapshot)
      .some((item) => item.field === label);
    if (stillOpen) {
      return { ok: false, reason: "WRITE_FAILED", message: "The field still differs after apply. Nothing is marked resolved." };
    }

    const remaining = diffCollectionCommerceWindows(after.workingSnapshot, after.shopifySnapshot);
    if (remaining.length === 0) {
      await db.collection.update({
        where: { id: collectionId },
        data: { syncStatus: "SYNCED", syncError: null, lastSyncedAt: new Date() },
      });
    }

    return {
      ok: true,
      message: direction === "SHOPIFY_TO_SYNARAVA"
        ? `${label} applied from Shopify.`
        : `${label} pushed to Shopify.`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: error instanceof Error ? error.message : "This collection field could not be applied.",
    };
  }
}
