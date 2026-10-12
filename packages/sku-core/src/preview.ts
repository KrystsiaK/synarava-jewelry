import { fail, ok, type SkuResult } from "./errors.js";
import { formatSku, nextSequence, type FormattedSku } from "./format.js";
import type { PolicyProfileConfig } from "./profile.js";
import { resolveStem } from "./stem.js";

export type PreviewInput = {
  readonly familyKey: string;
  /** Highest sequence already allocated for this stem, or null if none. */
  readonly lastAllocatedSequence: number | null;
};

export type PreviewResult = FormattedSku & {
  readonly policyVersion: number;
  readonly familyKey: string;
  /** Preview never promises the candidate will remain free. */
  readonly provisional: true;
};

/**
 * Build a candidate SKU without reserving. Callers must not treat the result as held.
 */
export function previewSku(
  profile: PolicyProfileConfig,
  input: PreviewInput,
): SkuResult<PreviewResult> {
  if (profile.suffix.reuse !== false) {
    return fail("INVALID_INPUT", "suffix.reuse must be false");
  }

  const stem = resolveStem(profile, input.familyKey);
  if (!stem.ok) {
    return stem;
  }

  const sequence = nextSequence(input.lastAllocatedSequence, profile);
  if (!sequence.ok) {
    return sequence;
  }

  const formatted = formatSku(stem.value, sequence.value, profile);
  if (!formatted.ok) {
    return formatted;
  }

  return ok({
    ...formatted.value,
    policyVersion: profile.version,
    familyKey: input.familyKey.trim().toLowerCase(),
    provisional: true,
  });
}
