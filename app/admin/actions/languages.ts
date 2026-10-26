"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { writeAuditLog } from "@/app/admin/actions/shared";
import {
  importLanguageBundle,
  previewLanguageBundleImport,
  type LanguageBundle,
  verifyLanguageBundle,
} from "@/lib/i18n/language-bundle";
import {
  addStorefrontLanguage,
  deleteStorefrontLanguageData,
  exportStorefrontLanguage,
  hideStorefrontLanguage,
  restoreStorefrontLanguage,
} from "@/lib/i18n/language-lifecycle";
import { invalidateStorefrontLocaleCache } from "@/lib/i18n/storefront-locale-cache";
import { hasShopifyAdminConfig } from "@/lib/shopify/admin";
import { runAfterSaveCatalogConflictCheck } from "@/lib/shopify/after-save-catalog-check";

async function afterLanguageSettingSave(requestedBy: string): Promise<string | undefined> {
  if (!hasShopifyAdminConfig()) return undefined;
  const check = await runAfterSaveCatalogConflictCheck(requestedBy);
  return check.warning;
}

async function revalidateLanguagesAdmin() {
  // Locale tabs live under every admin section — refresh the whole tree.
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/translations");
  invalidateStorefrontLocaleCache();
}

export async function addLanguageAction(input: {
  code: string;
  routeSegment: string;
  shopifyLocale: string;
  intlLocale: string;
  name: string;
  nativeName: string;
}) {
  const session = await requireAdminSession();
  const result = await addStorefrontLanguage(input);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_ADD",
      entityType: "STOREFRONT_LOCALE",
      entityId: input.code.trim().toLowerCase(),
      after: input,
      metadata: { requiresWriteLocales: result.requiresWriteLocales ?? false },
    });
    await revalidateLanguagesAdmin();
    const syncWarning = await afterLanguageSettingSave(session.username);
    return { ...result, syncWarning };
  }
  return result;
}

export async function hideLanguageAction(code: string) {
  const session = await requireAdminSession();
  const result = await hideStorefrontLanguage(code);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_HIDE",
      entityType: "STOREFRONT_LOCALE",
      entityId: code,
      after: { status: "RETIRED" },
    });
    await revalidateLanguagesAdmin();
    const syncWarning = await afterLanguageSettingSave(session.username);
    return { ...result, syncWarning };
  }
  return result;
}

export async function restoreLanguageAction(code: string) {
  const session = await requireAdminSession();
  const result = await restoreStorefrontLanguage(code);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_RESTORE",
      entityType: "STOREFRONT_LOCALE",
      entityId: code,
      after: { status: "PUBLISHED" },
    });
    await revalidateLanguagesAdmin();
    const syncWarning = await afterLanguageSettingSave(session.username);
    return { ...result, syncWarning };
  }
  return result;
}

export async function exportLanguageAction(code: string) {
  await requireAdminSession();
  const bundle = await exportStorefrontLanguage(code);
  await writeAuditLog({
    action: "LANGUAGE_EXPORT",
    entityType: "STOREFRONT_LOCALE",
    entityId: code,
    metadata: { checksum: bundle.checksum, schemaVersion: bundle.schemaVersion },
  });
  return { bundle };
}

/** Dry-run import — counts + sample field changes. Does not write. */
export async function previewImportLanguageAction(bundle: LanguageBundle, expectedLocale?: string) {
  await requireAdminSession();
  const verified = verifyLanguageBundle(bundle);
  if (!verified.ok) return { error: verified.error };
  try {
    const preview = await previewLanguageBundleImport(bundle, expectedLocale);
    return { preview };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function importLanguageAction(bundle: LanguageBundle, expectedLocale?: string) {
  const session = await requireAdminSession();
  const verified = verifyLanguageBundle(bundle);
  if (!verified.ok) return { error: verified.error };
  try {
    const result = await importLanguageBundle(bundle, expectedLocale);
    await writeAuditLog({
      action: "LANGUAGE_IMPORT",
      entityType: "STOREFRONT_LOCALE",
      entityId: result.locale,
      after: result,
      metadata: { checksum: bundle.checksum },
    });
    await revalidateLanguagesAdmin();
    const syncWarning = await afterLanguageSettingSave(session.username);
    return {
      success: `Imported ${result.locale}: ${result.products} products, ${result.collections} collections, ${result.pages} pages.`,
      result,
      syncWarning,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteLanguageDataAction(input: {
  code: string;
  typedCode: string;
  exportChecksum: string;
}) {
  const session = await requireAdminSession();
  const result = await deleteStorefrontLanguageData(input);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_DELETE_DATA",
      entityType: "STOREFRONT_LOCALE",
      entityId: input.code,
      metadata: { exportChecksum: input.exportChecksum },
    });
    await revalidateLanguagesAdmin();
    const syncWarning = await afterLanguageSettingSave(session.username);
    return { ...result, syncWarning };
  }
  return result;
}
