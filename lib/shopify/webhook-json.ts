/**
 * Shopify REST webhook JSON often embeds 64-bit resource ids that exceed
 * `Number.MAX_SAFE_INTEGER`. Quoting long digit runs before `JSON.parse`
 * keeps `order_id` exact so we can normalize to `gid://shopify/Order/<id>`.
 *
 * Only transforms unquoted integer literals (≥16 digits) after `:` / `[` / `,`.
 */
export function parseShopifyWebhookJson(rawBody: string): unknown {
  const quoted = rawBody.replace(/([:[\],]\s*)(\d{16,})\b/g, '$1"$2"');
  return JSON.parse(quoted);
}
