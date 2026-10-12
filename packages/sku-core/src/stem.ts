import { fail, ok, type SkuResult } from "./errors.js";
import { normalizeFamilyKey, normalizeStem } from "./normalize.js";
import type { PolicyProfileConfig } from "./profile.js";

export function resolveStem(
  profile: PolicyProfileConfig,
  familyKeyRaw: string,
): SkuResult<string> {
  const familyKey = normalizeFamilyKey(familyKeyRaw);
  if (!familyKey.ok) {
    return familyKey;
  }

  const mapped = profile.families[familyKey.value];
  if (mapped === undefined) {
    return fail(
      "UNKNOWN_FAMILY",
      `no family mapping for "${familyKey.value}" in profile v${profile.version}`,
    );
  }

  return normalizeStem(mapped, profile.separator);
}
