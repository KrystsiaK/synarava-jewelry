/**
 * Loose BCP-47 shape check for the language tags this app actually stores
 * (Shopify locale codes, `Intl` locale codes): a 2-3 letter language
 * subtag, optional 4-letter script, optional 2-letter region or 3-digit
 * area code. Not a full BCP-47 grammar — variants/extensions aren't
 * supported because nothing here produces them.
 */
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?$/;

export function isValidBcp47(value: string): boolean {
  return BCP47_PATTERN.test(value);
}
