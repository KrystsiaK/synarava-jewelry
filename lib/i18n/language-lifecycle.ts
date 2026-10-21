import "server-only";

import { db } from "@/lib/db";
import { isValidBcp47 } from "@/lib/i18n/bcp47";
import {
  exportLanguageBundle,
  type LanguageBundle,
} from "@/lib/i18n/language-bundle";
import {
  clearLanguageExportReceipt,
  recordLanguageExportReceipt,
  verifyLanguageExportReceipt,
} from "@/lib/i18n/language-export-receipt";
import { invalidateStorefrontLocaleCache } from "@/lib/i18n/storefront-locale-cache";
import {
  LOCALE_DELETE_RETENTION_DAYS,
  localeLifecycleState,
  retentionDaysElapsed,
} from "@/lib/i18n/storefront-locale-status";
import {
  hasWriteLocalesScope,
  shopLocaleDisable,
  shopLocaleEnable,
  shopLocaleUpdate,
} from "@/lib/shopify/locale-mutations";

export type LanguageActionResult = {
  success?: string;
  error?: string;
  requiresWriteLocales?: boolean;
};

async function unresolvedSyncDifferences(locale: string): Promise<number> {
  return db.shopifyFieldDivergence.count({
    where: { locale, resolvedAt: null },
  });
}

export async function addStorefrontLanguage(input: {
  code: string;
  routeSegment: string;
  shopifyLocale: string;
  intlLocale: string;
  name: string;
  nativeName: string;
}): Promise<LanguageActionResult> {
  const code = input.code.trim().toLowerCase();
  const routeSegment = input.routeSegment.trim().toLowerCase();
  if (!code || !routeSegment) return { error: "Code and route segment are required." };
  if (!isValidBcp47(input.shopifyLocale.trim()) && !/^[a-z]{2}(-[A-Za-z0-9]+)?$/.test(input.shopifyLocale.trim())) {
    return { error: "Shopify locale must look like a language tag (e.g. de or pt-PT)." };
  }
  if (code === "en" || routeSegment === "en") return { error: "English is the source locale and cannot be re-added." };

  const existing = await db.storefrontLocale.findFirst({
    where: {
      OR: [{ code }, { routeSegment }, { shopifyLocale: input.shopifyLocale.trim() }],
    },
  });
  if (existing) return { error: `Locale already registered as ${existing.code}.` };

  const maxSort = await db.storefrontLocale.aggregate({ _max: { sortOrder: true } });
  await db.storefrontLocale.create({
    data: {
      code,
      routeSegment,
      shopifyLocale: input.shopifyLocale.trim(),
      intlLocale: input.intlLocale.trim() || input.shopifyLocale.trim(),
      name: input.name.trim() || code,
      nativeName: input.nativeName.trim() || input.name.trim() || code,
      isDefault: false,
      status: "DRAFT",
      isPublished: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  const canWrite = await hasWriteLocalesScope().catch(() => false);
  if (!canWrite) {
    invalidateStorefrontLocaleCache();
    return {
      success: `Added ${code} as Draft. Shopify enable/publish is read-only until the app has write_locales.`,
      requiresWriteLocales: true,
    };
  }

  try {
    await shopLocaleEnable(input.shopifyLocale.trim());
  } catch (error) {
    invalidateStorefrontLocaleCache();
    return {
      success: `Added ${code} as Draft locally.`,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  invalidateStorefrontLocaleCache();
  return { success: `Added ${code} as Draft and enabled it in Shopify (unpublished).` };
}

export async function hideStorefrontLanguage(code: string): Promise<LanguageActionResult> {
  const locale = await db.storefrontLocale.findUnique({ where: { code } });
  if (!locale) return { error: `Locale "${code}" not found.` };
  if (locale.isDefault) return { error: "The default locale cannot be hidden." };
  if (localeLifecycleState(locale) === "deleted") return { error: "Locale is already deleted." };

  const canWrite = await hasWriteLocalesScope().catch(() => false);
  if (canWrite) {
    try {
      await shopLocaleUpdate(locale.shopifyLocale, false);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), requiresWriteLocales: false };
    }
  }

  await db.storefrontLocale.update({
    where: { id: locale.id },
    data: {
      status: "RETIRED",
      isPublished: false,
      retiredAt: locale.retiredAt ?? new Date(),
    },
  });
  invalidateStorefrontLocaleCache();
  return {
    success: canWrite
      ? `Hid ${code}. Storefront URLs now 301 to the default language.`
      : `Hid ${code} locally. Grant write_locales to unpublish it in Shopify.`,
    requiresWriteLocales: !canWrite,
  };
}

export async function restoreStorefrontLanguage(code: string): Promise<LanguageActionResult> {
  const locale = await db.storefrontLocale.findUnique({ where: { code } });
  if (!locale) return { error: `Locale "${code}" not found.` };
  if (locale.deletedAt) return { error: "Deleted locale data must be imported before restore." };
  if (localeLifecycleState(locale) !== "retired") return { error: "Only retired locales can be restored." };

  const canWrite = await hasWriteLocalesScope().catch(() => false);
  if (canWrite) {
    try {
      await shopLocaleEnable(locale.shopifyLocale);
      await shopLocaleUpdate(locale.shopifyLocale, true);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  await db.storefrontLocale.update({
    where: { id: locale.id },
    data: {
      status: "PUBLISHED",
      isPublished: true,
      retiredAt: null,
      deletedAt: null,
    },
  });
  invalidateStorefrontLocaleCache();
  return {
    success: canWrite
      ? `Restored and published ${code}.`
      : `Restored ${code} locally. Grant write_locales to publish it in Shopify.`,
    requiresWriteLocales: !canWrite,
  };
}

/**
 * Export a language bundle and record a server-side SiteSetting receipt
 * (checksum + timestamp) used to authorize delete within 60 minutes.
 */
export async function exportStorefrontLanguage(code: string): Promise<LanguageBundle> {
  const bundle = await exportLanguageBundle(code);
  await recordLanguageExportReceipt(bundle.locale, bundle.checksum);
  return bundle;
}

export async function deleteStorefrontLanguageData(input: {
  code: string;
  typedCode: string;
  exportChecksum: string;
}): Promise<LanguageActionResult> {
  const code = input.code.trim().toLowerCase();
  if (input.typedCode.trim().toLowerCase() !== code) {
    return { error: "Type the language code exactly to confirm deletion." };
  }

  const receiptCheck = await verifyLanguageExportReceipt(code, input.exportChecksum);
  if (!receiptCheck.ok) return { error: receiptCheck.error };

  const locale = await db.storefrontLocale.findUnique({ where: { code } });
  if (!locale) return { error: `Locale "${code}" not found.` };
  if (locale.isDefault) return { error: "The default locale cannot be deleted." };
  if (localeLifecycleState(locale) !== "retired") {
    return { error: "Hide (retire) the language and wait for the retention period before deleting data." };
  }
  if (!retentionDaysElapsed(locale.retiredAt)) {
    return {
      error: `Retention not met: language must stay retired for ${LOCALE_DELETE_RETENTION_DAYS} days before delete.`,
    };
  }

  const openDiffs = await unresolvedSyncDifferences(code);
  if (openDiffs > 0) {
    return { error: `Resolve ${openDiffs} sync difference(s) for ${code} before deleting data.` };
  }

  const canWrite = await hasWriteLocalesScope().catch(() => false);
  if (canWrite) {
    try {
      await shopLocaleDisable(locale.shopifyLocale);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  } else {
    return {
      error: "Deleting Shopify locale data requires write_locales. Add the scope, then retry.",
      requiresWriteLocales: true,
    };
  }

  await db.$transaction([
    db.productTranslation.deleteMany({ where: { locale: code } }),
    db.collectionTranslation.deleteMany({ where: { locale: code } }),
    db.pageTranslation.deleteMany({ where: { locale: code } }),
    db.localizedHandleRedirect.deleteMany({ where: { locale: code } }),
    db.shopifyTranslationSnapshot.deleteMany({ where: { locale: code } }),
    db.translationCache.deleteMany({ where: { locale: code } }),
    db.storefrontLocale.update({
      where: { id: locale.id },
      data: {
        deletedAt: new Date(),
        status: "RETIRED",
        isPublished: false,
      },
    }),
  ]);
  await clearLanguageExportReceipt(code).catch(() => undefined);
  invalidateStorefrontLocaleCache();
  return {
    success: `Deleted translation data for ${code}. 301 redirects remain.`,
  };
}
