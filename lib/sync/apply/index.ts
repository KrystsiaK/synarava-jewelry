import "server-only";

import type {
  CatalogConflictApplyEntryInput,
  CatalogConflictApplyScope,
} from "@/lib/shopify/catalog-conflict-apply";
import type {
  CollectionConflictApplyEntryInput,
  CollectionConflictApplyScope,
} from "@/lib/shopify/collection-conflict-apply";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";
import type { CollectionPresenceDifference } from "@/lib/shopify/collection-presence";
import type { ReconcileChoice } from "@/lib/shopify/reconciliation-apply";

import { applyCollectionSync, previewCollectionSync } from "./collection";
import { applyPresenceSync } from "./presence";
import { applyProductSync, previewProductSync } from "./product";
import { applyTranslationSync } from "./translation";

export type SyncApplyTarget =
  | {
      resource: "product";
      entries: CatalogConflictApplyEntryInput[];
      acknowledgeClears: boolean;
      actorUsername: string;
    }
  | {
      resource: "collection";
      entries: CollectionConflictApplyEntryInput[];
      acknowledgeClears: boolean;
      actorUsername: string;
    }
  | {
      resource: "translation";
      divergenceId: string;
      choice: ReconcileChoice;
      expectedLocalFingerprint: string;
      expectedShopifyFingerprint: string;
      actorUsername: string;
    }
  | {
      resource: "presence";
      resourceType: "PRODUCT";
      difference: CatalogPresenceDifference;
      direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
    }
  | {
      resource: "presence";
      resourceType: "COLLECTION";
      difference: CollectionPresenceDifference;
      direction: "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";
    };

/** Human-only apply dispatcher — never called from webhooks / AUTO check. */
export async function applySync(target: SyncApplyTarget) {
  switch (target.resource) {
    case "product":
      return applyProductSync({
        entries: target.entries,
        acknowledgeClears: target.acknowledgeClears,
        actorUsername: target.actorUsername,
      });
    case "collection":
      return applyCollectionSync({
        entries: target.entries,
        acknowledgeClears: target.acknowledgeClears,
        actorUsername: target.actorUsername,
      });
    case "translation":
      return applyTranslationSync(target);
    case "presence":
      return applyPresenceSync(target);
    default: {
      const _exhaustive: never = target;
      return _exhaustive;
    }
  }
}

export type { CatalogConflictApplyScope, CollectionConflictApplyScope };

export {
  applyCollectionSync,
  applyPresenceSync,
  applyProductSync,
  applyTranslationSync,
  previewCollectionSync,
  previewProductSync,
};
