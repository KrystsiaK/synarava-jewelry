import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ShopifyAdminError } from "@/lib/shopify/admin";
import {
  gateWriteConvergence,
  findConflictLeaf,
  leafMatchesExpectedFingerprints,
  recheckEntityConflictLeaves,
  intendedAddressFromLeaf,
} from "@/lib/sync";

import {
  isScopedCollectionCommerceFieldLabel,
  SCOPED_COLLECTION_COMMERCE_FIELD_LABELS,
} from "./catalog-conflict-policy";
import {
  collectionCommerceInputFromWindow,
} from "./collection-commerce-projection";
import { refreshShopifyCollectionState } from "./collection-presence-server";
import { runShopifyCollectionUpdate } from "./collection-update";
import {
  deriveCollectionWindow,
  preferredHtmlFromShopifySnapshot,
} from "@/lib/sync/derive-window";

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
      extras: true,
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

  const updated = await db.collection.update({
    where: { id: collectionId },
    data: {
      ...columnData,
      // Local field write → merchant intent to push; conflict SoT is SyncResult.
      // OUR window is derived from columns (ADR-0009).
      syncStatus: "PENDING",
      syncError: null,
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
      extras: true,
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

  const patch = patchForLabel(label, value);
  const window = deriveCollectionWindow({
    shopifyCollectionId: collection.shopifyCollectionId,
    name: patch.title ?? collection.name,
    slug: patch.handle ?? collection.slug,
    description: patch.description !== undefined ? patch.description : collection.description,
    seoTitle: patch.seoTitle !== undefined ? patch.seoTitle : collection.seoTitle,
    seoDescription: patch.seoDescription !== undefined ? patch.seoDescription : collection.seoDescription,
    extras: collection.extras,
    preferredDescriptionHtml: preferredHtmlFromShopifySnapshot(
      collection.shopifySnapshot,
      "descriptionHtml",
    ),
  });
  const input = collectionCommerceInputFromWindow(window);
  await runShopifyCollectionUpdate(
    {
      id: collection.shopifyCollectionId,
      title: input.title,
      handle: input.handle || undefined,
      descriptionHtml: input.descriptionHtml,
      seo: input.seo,
    },
    { requireCollection: true },
  );

  // Columns are OUR SoT; refresh Shopify copy after push (ADR-0009).
  await db.collection.update({
    where: { id: collectionId },
    data: {
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
  fieldKey,
  direction,
  expectedLocalFingerprint,
  expectedShopifyFingerprint,
  requestedBy = "system",
}: {
  collectionId: string;
  label: string;
  fieldKey?: string;
  direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  requestedBy?: string;
}): Promise<CollectionCommerceFieldApplyResult> {
  if (!isScopedCollectionCommerceFieldLabel(label)) {
    return { ok: false, reason: "UNSUPPORTED", message: `${label} is not a supported collection commerce field.` };
  }

  let leaves;
  try {
    ({ leaves } = await recheckEntityConflictLeaves({
      resourceType: "COLLECTION",
      resourceId: collectionId,
      requestedBy,
    }));
  } catch (error) {
    return {
      ok: false,
      reason: "WRITE_FAILED",
      message: error instanceof Error ? error.message : "Could not recheck this collection.",
    };
  }

  const leaf = findConflictLeaf(leaves, { fieldKey, label });
  if (!leaf) {
    return { ok: false, reason: "STALE", message: "This field is no longer different — it may already have been resolved." };
  }
  if (!leafMatchesExpectedFingerprints(leaf, {
    localFingerprint: expectedLocalFingerprint,
    shopifyFingerprint: expectedShopifyFingerprint,
  })) {
    return { ok: false, reason: "STALE", message: "Synarava or Shopify changed since this was reviewed. Refresh and try again." };
  }

  try {
    const value = rawValue(direction === "SHOPIFY_TO_SYNARAVA" ? leaf.shopifyValue : leaf.synaravaValue);
    if (direction === "SHOPIFY_TO_SYNARAVA") {
      await writeLocally(collectionId, label, value);
    } else {
      await writeToShopify(collectionId, label, value);
    }

    const gate = await gateWriteConvergence({
      resourceType: "COLLECTION",
      resourceId: collectionId,
      requestedBy,
      leavesBefore: leaves,
      intended: [intendedAddressFromLeaf(leaf)],
    });
    if (!gate.ok) {
      return { ok: false, reason: "WRITE_FAILED", message: gate.message };
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
