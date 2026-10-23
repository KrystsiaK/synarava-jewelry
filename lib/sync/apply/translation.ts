import "server-only";

import {
  applyReconcileChoice,
  type ReconcileChoice,
} from "@/lib/shopify/reconciliation-apply";

/** Human-only translation field Apply. */
export async function applyTranslationSync(input: {
  divergenceId: string;
  choice: ReconcileChoice;
  expectedLocalFingerprint: string;
  expectedShopifyFingerprint: string;
  actorUsername: string;
}) {
  return applyReconcileChoice(input);
}
