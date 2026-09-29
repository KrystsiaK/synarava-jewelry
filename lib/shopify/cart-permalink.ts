/**
 * Shopify cart permalink contract: `<variant_id>:<quantity>` comma-separated.
 * @see https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks
 */

export const CART_PERMALINK_LIMITS = {
  maxRawLength: 2_048,
  maxLines: 50,
  maxQuantityPerLine: 99,
  maxTotalQuantity: 200,
} as const;

export type CartPermalinkLine = {
  /** Numeric Shopify ProductVariant id (not a GID). */
  variantId: string;
  quantity: number;
};

export type CartPermalinkRejectCode =
  | "empty"
  | "too_long"
  | "invalid_syntax"
  | "invalid_quantity"
  | "too_many_lines"
  | "total_quantity";

export type CartPermalinkParseResult =
  | { ok: true; lines: CartPermalinkLine[]; canonical: string }
  | { ok: false; code: CartPermalinkRejectCode };

const SEGMENT = /^(\d+):(\d+)$/;

/** Parse and normalize a Shopify cart permalink payload (path segment only). */
export function parseCartPermalink(raw: string): CartPermalinkParseResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, code: "empty" };
  if (trimmed.length > CART_PERMALINK_LIMITS.maxRawLength) {
    return { ok: false, code: "too_long" };
  }
  // Reject fragments, queries, properties, or path separators Shopify does not use here.
  if (/[?#&=\[\]\s/]/.test(trimmed)) {
    return { ok: false, code: "invalid_syntax" };
  }

  const segments = trimmed.split(",");
  if (segments.length > CART_PERMALINK_LIMITS.maxLines) {
    return { ok: false, code: "too_many_lines" };
  }

  const quantities = new Map<string, number>();
  for (const segment of segments) {
    if (!segment) return { ok: false, code: "invalid_syntax" };
    const match = SEGMENT.exec(segment);
    if (!match) return { ok: false, code: "invalid_syntax" };

    const variantId = match[1];
    // Reject leading zeros that are not a single "0" id (ids are positive).
    if (variantId.length > 1 && variantId.startsWith("0")) {
      return { ok: false, code: "invalid_syntax" };
    }

    const quantity = Number.parseInt(match[2], 10);
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return { ok: false, code: "invalid_quantity" };
    }
    if (quantity > CART_PERMALINK_LIMITS.maxQuantityPerLine) {
      return { ok: false, code: "invalid_quantity" };
    }

    quantities.set(variantId, (quantities.get(variantId) ?? 0) + quantity);
  }

  if (quantities.size === 0) return { ok: false, code: "empty" };

  let total = 0;
  const lines: CartPermalinkLine[] = [];
  // Deterministic order: ascending numeric variant id.
  const orderedIds = [...quantities.keys()].sort((a, b) => {
    const diff = BigInt(a) - BigInt(b);
    if (diff < BigInt(0)) return -1;
    if (diff > BigInt(0)) return 1;
    return 0;
  });

  for (const variantId of orderedIds) {
    const quantity = quantities.get(variantId)!;
    if (quantity > CART_PERMALINK_LIMITS.maxQuantityPerLine) {
      return { ok: false, code: "invalid_quantity" };
    }
    total += quantity;
    if (total > CART_PERMALINK_LIMITS.maxTotalQuantity) {
      return { ok: false, code: "total_quantity" };
    }
    lines.push({ variantId, quantity });
  }

  const canonical = lines.map((line) => `${line.variantId}:${line.quantity}`).join(",");
  return { ok: true, lines, canonical };
}

export function variantGidFromNumericId(variantId: string) {
  return `gid://shopify/ProductVariant/${variantId}`;
}

export function numericIdFromVariantGid(gid: string): string | null {
  const match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/.exec(gid);
  return match?.[1] ?? null;
}
