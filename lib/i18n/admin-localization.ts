// Generic EN/PT contract shared by every admin form and Shopify adapter:
// resolving a locale's content against a field registry, readiness/
// completeness, and the review/sync/conflict state machine. Entity-specific
// modules (e.g. lib/products/localization.ts) keep their own persistence
// shapes but should route through these once they migrate onto the shared
// workspace (Phase 4/5) rather than re-deriving this logic.
//
// Reuses the storefront-facing resolver in lib/i18n/localized-content.ts —
// this file adds the admin/sync layer on top, it does not replace it.

import type { TranslationReviewStatus, TranslationSyncStatus } from "@prisma/client";
import {
  localizedFields,
  requiredLocalizedFields,
  type EntityFieldRegistry,
} from "@/lib/i18n/admin-field-registry";
import { contentCompleteness, hasContent, resolveLocalizedContent } from "@/lib/i18n/localized-content";

export type { TranslationReviewStatus, TranslationSyncStatus };

export type LocaleSyncState = {
  reviewStatus: TranslationReviewStatus;
  syncStatus: TranslationSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: Date | string | null;
};

export type LocaleBinding = {
  resourceType: string;
  resourceId: string;
};

/** Shape stored on TranslationSyncEvent.fieldConflicts JSON — not a three-way engine. */
export type FieldConflict<T = string> = {
  field: string;
  local: T;
  remote: T;
};

/** planReconcile summary direction — human Apply chooses side; not auto push/pull. */
export type SyncDirection = "push" | "pull" | "conflict" | "noop";

export type LocalizedRecord = Record<string, unknown>;

function optionalKeys<T extends LocalizedRecord>(registry: EntityFieldRegistry): Array<keyof T> {
  return localizedFields(registry)
    .filter((field) => field.required === "optional")
    .map((field) => field.key) as Array<keyof T>;
}

/** Resolve a locale's content: required fields render blank when untranslated (a visible readiness gap), optional fields fall back to the source. */
export function resolveEntityLocale<T extends LocalizedRecord>(
  registry: EntityFieldRegistry,
  source: T,
  translation: Partial<T> | null | undefined,
): T {
  return resolveLocalizedContent({ source, translation, optionalFields: optionalKeys<T>(registry) });
}

export function entityLocaleReadiness<T extends LocalizedRecord>(
  registry: EntityFieldRegistry,
  content: T,
  { published }: { published: boolean },
) {
  const required = requiredLocalizedFields(registry, { published }).map((field) => field.key) as Array<keyof T>;
  return contentCompleteness(content, required);
}

/** Publish gate: every `always`/`when-published` field must be non-blank in both locales, and PT must be reviewed. Empty once already public (unpublish is not this function's concern). */
export function missingRequiredForPublish<T extends LocalizedRecord>(
  registry: EntityFieldRegistry,
  english: T,
  portuguese: T,
  { portugueseReviewed, isAlreadyPublic }: { portugueseReviewed: boolean; isAlreadyPublic: boolean },
): string[] {
  if (isAlreadyPublic) return [];
  const required = requiredLocalizedFields(registry, { published: true });
  const missing: string[] = [];
  for (const field of required) {
    if (!hasContent(english[field.key])) missing.push(`English ${field.label}`);
    if (!hasContent(portuguese[field.key])) missing.push(`Portuguese ${field.label}`);
  }
  if (required.length > 0 && !portugueseReviewed) missing.push("Portuguese review");
  return missing;
}

