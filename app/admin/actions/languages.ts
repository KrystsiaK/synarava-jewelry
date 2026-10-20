"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { writeAuditLog } from "@/app/admin/actions/shared";
import {
  importLanguageBundle,
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
import { hasWriteLocalesScope } from "@/lib/shopify/locale-mutations";

async function revalidateLanguagesAdmin() {
  revalidatePath("/admin/translations");
  invalidateStorefrontLocaleCache();
}

export async function getWriteLocalesScopeAction() {
  await requireAdminSession();
  try {
    return { hasWriteLocales: await hasWriteLocalesScope() };
  } catch {
    return { hasWriteLocales: false };
  }
}

export async function addLanguageAction(input: {
  code: string;
  routeSegment: string;
  shopifyLocale: string;
  intlLocale: string;
  name: string;
  nativeName: string;
}) {
  await requireAdminSession();
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
  }
  return result;
}

export async function hideLanguageAction(code: string) {
  await requireAdminSession();
  const result = await hideStorefrontLanguage(code);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_HIDE",
      entityType: "STOREFRONT_LOCALE",
      entityId: code,
      after: { status: "RETIRED" },
    });
    await revalidateLanguagesAdmin();
  }
  return result;
}

export async function restoreLanguageAction(code: string) {
  await requireAdminSession();
  const result = await restoreStorefrontLanguage(code);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_RESTORE",
      entityType: "STOREFRONT_LOCALE",
      entityId: code,
      after: { status: "PUBLISHED" },
    });
    await revalidateLanguagesAdmin();
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

export async function importLanguageAction(bundle: LanguageBundle, expectedLocale?: string) {
  await requireAdminSession();
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
    return { success: `Imported ${result.locale}: ${result.products} products, ${result.collections} collections, ${result.pages} pages.`, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteLanguageDataAction(input: {
  code: string;
  typedCode: string;
  exportChecksum: string;
}) {
  await requireAdminSession();
  const result = await deleteStorefrontLanguageData(input);
  if (result.success) {
    await writeAuditLog({
      action: "LANGUAGE_DELETE_DATA",
      entityType: "STOREFRONT_LOCALE",
      entityId: input.code,
      metadata: { exportChecksum: input.exportChecksum },
    });
    await revalidateLanguagesAdmin();
  }
  return result;
}
