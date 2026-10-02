export const CUSTOMER_CARE_EMAIL = "care@synarava.com";

const LEGACY_CUSTOMER_CARE_EMAIL_RE = /synarava\.shop@gmail\.com/gi;

export function replaceLegacyCustomerCareEmail(value: string): string {
  return value.replace(LEGACY_CUSTOMER_CARE_EMAIL_RE, CUSTOMER_CARE_EMAIL);
}

/**
 * Page content is JSON. Clone it while replacing only the known retired
 * address, leaving every other customer-authored value untouched.
 */
export function normalizeCustomerCareContent<T>(value: T): T {
  if (typeof value === "string") {
    return replaceLegacyCustomerCareEmail(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCustomerCareContent(entry)) as T;
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeCustomerCareContent(entry)]),
    ) as T;
  }
  return value;
}
