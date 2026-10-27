import type { ListStateField } from "./types";

function valuesEqual<T>(a: T, b: T, equals?: (x: T, y: T) => boolean): boolean {
  if (equals) return equals(a, b);
  return Object.is(a, b);
}

/** Free-text field. Empty/whitespace maps to default; default is omitted from the URL. */
export function stringField(options: {
  key: string;
  defaultValue?: string;
}): ListStateField<string> {
  const defaultValue = options.defaultValue ?? "";
  return {
    key: options.key,
    defaultValue,
    parse(raw) {
      if (raw == null) return defaultValue;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : defaultValue;
    },
    serialize(value) {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      if (trimmed === defaultValue) return null;
      return trimmed;
    },
  };
}

/** Optional free-text: absent/empty → undefined; undefined omitted from URL. */
export function optionalStringField(options: {
  key: string;
}): ListStateField<string | undefined> {
  return {
    key: options.key,
    defaultValue: undefined,
    parse(raw) {
      if (raw == null) return undefined;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    serialize(value) {
      if (value == null) return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
  };
}

/**
 * Enum/whitelist field. Unknown values fall back to defaultValue.
 * Default is omitted from the URL unless `serializeDefault` is true.
 */
export function enumField<const T extends string>(options: {
  key: string;
  defaultValue: T;
  allowed: readonly T[];
  /** When true, the default is still written to the query string. */
  serializeDefault?: boolean;
}): ListStateField<T> {
  const allowed = new Set<string>(options.allowed);
  const { defaultValue, key, serializeDefault = false } = options;
  return {
    key,
    defaultValue,
    parse(raw) {
      if (raw == null) return defaultValue;
      return allowed.has(raw) ? (raw as T) : defaultValue;
    },
    serialize(value) {
      if (!allowed.has(value)) return null;
      if (!serializeDefault && value === defaultValue) return null;
      return value;
    },
  };
}

/**
 * Optional enum: absent/invalid → undefined. Only allowed values appear in the URL.
 */
export function optionalEnumField<const T extends string>(options: {
  key: string;
  allowed: readonly T[];
}): ListStateField<T | undefined> {
  const allowed = new Set<string>(options.allowed);
  return {
    key: options.key,
    defaultValue: undefined,
    parse(raw) {
      if (raw == null) return undefined;
      return allowed.has(raw) ? (raw as T) : undefined;
    },
    serialize(value) {
      if (value == null) return null;
      return allowed.has(value) ? value : null;
    },
  };
}

/** Sentinel string field (e.g. admin "ALL"): default omitted; non-default written as-is when non-empty. */
export function sentinelField(options: {
  key: string;
  defaultValue: string;
}): ListStateField<string> {
  const { key, defaultValue } = options;
  return {
    key,
    defaultValue,
    parse(raw) {
      if (raw == null || raw.trim() === "") return defaultValue;
      return raw;
    },
    serialize(value) {
      if (value === defaultValue || value.trim() === "") return null;
      return value;
    },
  };
}

export function fieldEquals<T>(field: ListStateField<T>, a: T, b: T): boolean {
  return valuesEqual(a, b, field.equals);
}
