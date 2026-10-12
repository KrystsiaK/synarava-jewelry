import { fail, ok, type SkuResult } from "./errors.js";
import { escapeRegExp } from "./normalize.js";
import type { PolicyProfileConfig } from "./profile.js";

export type FormattedSku = {
  readonly sku: string;
  readonly stem: string;
  readonly sequence: number;
};

export function formatSequence(sequence: number, width: number): SkuResult<string> {
  if (!Number.isInteger(sequence) || sequence < 0) {
    return fail("INVALID_INPUT", "sequence must be a non-negative integer");
  }
  if (!Number.isInteger(width) || width < 1 || width > 8) {
    return fail("INVALID_INPUT", "suffix width must be 1–8");
  }

  const max = 10 ** width - 1;
  if (sequence > max) {
    return fail(
      "SEQUENCE_EXHAUSTED",
      `sequence ${sequence} exceeds max ${max} for width ${width}`,
    );
  }

  return ok(String(sequence).padStart(width, "0"));
}

export function formatSku(
  stem: string,
  sequence: number,
  profile: Pick<PolicyProfileConfig, "separator" | "suffix" | "allowedCharacters">,
): SkuResult<FormattedSku> {
  const suffix = formatSequence(sequence, profile.suffix.width);
  if (!suffix.ok) {
    return suffix;
  }

  const sku = `${stem}${profile.separator}${suffix.value}`;
  const validated = validateSkuFormat(sku, profile.allowedCharacters);
  if (!validated.ok) {
    return validated;
  }

  return ok({ sku, stem, sequence });
}

export function validateSkuFormat(
  sku: string,
  allowedCharactersPattern: string,
): SkuResult<string> {
  const trimmed = sku.trim().toUpperCase();
  if (trimmed.length === 0) {
    return fail("INVALID_SKU_FORMAT", "sku is required");
  }

  let re: RegExp;
  try {
    re = new RegExp(allowedCharactersPattern);
  } catch {
    return fail("INVALID_INPUT", "allowedCharacters is not a valid regex");
  }

  if (!re.test(trimmed)) {
    return fail(
      "INVALID_SKU_FORMAT",
      `sku "${sku}" does not match allowedCharacters`,
    );
  }

  return ok(trimmed);
}

export function parseSku(
  skuRaw: string,
  profile: Pick<PolicyProfileConfig, "separator" | "suffix">,
): SkuResult<FormattedSku> {
  const sku = skuRaw.trim().toUpperCase();
  if (sku.length === 0) {
    return fail("INVALID_SKU_FORMAT", "sku is required");
  }

  const sep = escapeRegExp(profile.separator);
  const width = profile.suffix.width;
  const pattern = new RegExp(
    `^(.+)${sep}(\\d{${width}})$`,
  );
  const match = pattern.exec(sku);
  if (!match) {
    return fail(
      "INVALID_SKU_FORMAT",
      `sku "${skuRaw}" does not end with ${profile.separator}+${width} digits`,
    );
  }

  const stem = match[1]!;
  const sequence = Number.parseInt(match[2]!, 10);
  if (!Number.isInteger(sequence)) {
    return fail("INVALID_SKU_FORMAT", "suffix is not an integer");
  }

  return ok({ sku, stem, sequence });
}

export function nextSequence(
  lastAllocated: number | null,
  profile: Pick<PolicyProfileConfig, "suffix">,
): SkuResult<number> {
  const candidate =
    lastAllocated === null ? profile.suffix.start : lastAllocated + 1;
  const max = 10 ** profile.suffix.width - 1;
  if (candidate > max) {
    return fail(
      "SEQUENCE_EXHAUSTED",
      `stem sequence exhausted at ${max} (width ${profile.suffix.width})`,
    );
  }
  return ok(candidate);
}
