/**
 * Pure list-state field contract: one schema entry = one filter/sort/search key.
 * No React, no browser APIs — safe for server and client.
 */

export type ListStateField<T> = {
  readonly key: string;
  readonly defaultValue: T;
  /** Whitelist parse: invalid/unknown input must return defaultValue. */
  readonly parse: (raw: string | null) => T;
  /** Return null to omit the key from the URL (defaults stay out of the query string). */
  readonly serialize: (value: T) => string | null;
  readonly equals?: (a: T, b: T) => boolean;
};

export type ListStateSchema<TState extends Record<string, unknown>> = {
  readonly fields: { readonly [K in keyof TState]: ListStateField<TState[K]> };
};

/** Next.js / URLSearchParams-compatible input bag. */
export type ListStateParamSource =
  | URLSearchParams
  | Readonly<Record<string, string | string[] | undefined | null>>;
