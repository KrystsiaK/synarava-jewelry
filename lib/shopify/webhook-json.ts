/**
 * Shopify REST webhook JSON often embeds 64-bit resource ids that exceed
 * `Number.MAX_SAFE_INTEGER`. Use `JSON.parse` with a reviver that reads
 * `context.source` (Node >= 22.13 / current V8) so unsafe integer tokens are
 * kept as exact digit strings without touching digit runs inside JSON strings.
 *
 * @see https://nodejs.org/api/globals.html#jsonparsejson-reviver
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#the_reviver_parameter
 */
type JsonParseReviverContext = {
  source?: string;
};

export function parseShopifyWebhookJson(rawBody: string): unknown {
  return JSON.parse(rawBody, (key, value, context?: JsonParseReviverContext) => {
    if (typeof value !== "number" || Number.isSafeInteger(value)) {
      return value;
    }

    const source = context?.source;
    if (typeof source === "string" && /^-?\d+$/.test(source)) {
      return source;
    }

    // Engines without context.source cannot recover exact digits; keep the
    // imprecise number rather than inventing a different id.
    return value;
  });
}
