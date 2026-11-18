"use server";

import { revalidatePath } from "next/cache";

import {
  readAnnouncementBarSetting,
  setAnnouncementBarEnabled,
  type AnnouncementBarSetting,
} from "@/lib/content/announcement-bar";
import { ANNOUNCEMENT_BAR_COPY_KEY } from "@/lib/content/announcement-bar-fields";
import { setStorefrontCopy, type StorefrontCopy } from "@/lib/content/storefront-copy";
import { getStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { ADMIN_SHARED_PATH } from "@/components/admin/shared/admin-paths";
import {
  applyShopConflictResolution,
  previewShopConflictResolution,
  type ShopConflictApplyEntryInput,
  type ShopConflictApplyScope,
} from "@/lib/shopify/shop-conflict-apply";
import { loadShopConflictFromSyncResult } from "@/lib/shopify/shop-conflict";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { FREE_SHIPPING_THRESHOLD_RESOURCE_ID } from "@/lib/content/announcement-bar-fields";
import { getCatalogCheckConflictWriteBlock } from "@/lib/shopify/reconciliation-run";
import { runSyncWaterfall, selectSyncCounts } from "@/lib/sync";

export type AnnouncementBarActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  setting?: AnnouncementBarSetting;
};

export async function loadAnnouncementBarEditorPayload(): Promise<{
  setting: AnnouncementBarSetting;
  thresholdConflictCount: number;
}> {
  await requireAdminSession();
  const [setting, waterfall] = await Promise.all([
    readAnnouncementBarSetting(),
    runSyncWaterfall({
      scope: { kind: "shop" },
      requestedBy: "admin",
      skipRefresh: true,
    }),
  ]);
  const thresholdConflictCount = selectSyncCounts(waterfall.result, {
    kind: "listChip",
    resourceType: "SHOP",
    resourceId: FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
  });
  return { setting, thresholdConflictCount };
}

export async function saveAnnouncementBarAction(input: {
  enabled: boolean;
  copyByLocale: Record<string, string>;
}): Promise<AnnouncementBarActionState> {
  try {
    await requireAdminSession();
    const locales = await getStorefrontLocales();
    const allowed = new Set(locales.map((locale) => locale.code));
    const updates: StorefrontCopy = {};
    for (const [locale, value] of Object.entries(input.copyByLocale)) {
      if (!allowed.has(locale)) continue;
      updates[locale] = { [ANNOUNCEMENT_BAR_COPY_KEY]: value };
    }
    const [setting] = await Promise.all([
      setAnnouncementBarEnabled(input.enabled),
      Object.keys(updates).length > 0 ? setStorefrontCopy(updates) : Promise.resolve(null),
    ]);
    revalidatePath(ADMIN_SHARED_PATH);
    revalidatePath("/");
    return { ok: true, message: "Announcement bar saved", setting };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Save failed",
    };
  }
}

/** Display-only: SyncResult leaves via waterfall skipRefresh — NO Shopify fetch. */
export async function loadShopCatalogConflictAction(
  shopId: string = FREE_SHIPPING_THRESHOLD_RESOURCE_ID,
) {
  const session = await requireAdminSession(ADMIN_SHARED_PATH);
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }
  try {
    return {
      conflict: await loadShopConflictFromSyncResult(shopId, {
        requestedBy: session.username,
        skipRefresh: true,
      }),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not load shop conflict details.",
    };
  }
}

export async function previewShopConflictResolutionAction(scope: ShopConflictApplyScope) {
  const session = await requireAdminSession(ADMIN_SHARED_PATH);
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }
  try {
    return { preview: await previewShopConflictResolution(scope, session.username) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not preview the conflict resolution.",
    };
  }
}

export async function applyShopConflictResolutionAction(input: {
  entries: ShopConflictApplyEntryInput[];
  acknowledgeClears: boolean;
}) {
  const session = await requireAdminSession(ADMIN_SHARED_PATH);
  if (!hasShopifyAdminConfig()) {
    return { error: "Shopify Admin API credentials are not configured." };
  }
  try {
    const blocked = await getCatalogCheckConflictWriteBlock();
    if (blocked) return { error: blocked };
    const outcome = await applyShopConflictResolution({
      entries: input.entries,
      acknowledgeClears: input.acknowledgeClears,
      actorUsername: session.username,
    });
    revalidatePath(ADMIN_SHARED_PATH);
    revalidatePath("/");
    const appliedCount = outcome.appliedCount;
    const failedCount = outcome.failedCount;
    return {
      outcome,
      success: appliedCount > 0
        ? `${appliedCount} change${appliedCount === 1 ? "" : "s"} applied${failedCount > 0 ? `; ${failedCount} could not be applied` : ""}.`
        : undefined,
      error: appliedCount === 0
        ? "None of the selected changes could be applied. Review the results below."
        : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Could not apply the conflict resolution.",
    };
  }
}
