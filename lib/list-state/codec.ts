import { fieldEquals } from "./fields";
import type { ListStateField, ListStateParamSource, ListStateSchema } from "./types";

function readParam(source: ListStateParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) {
    return source.get(key);
  }
  const value = source[key];
  if (value == null) return null;
  if (Array.isArray(value)) {
    const first = value[0];
    return first == null || first === "" ? null : first;
  }
  return value === "" ? null : value;
}

/** Build typed state from URL/query input. Invalid values fall back to field defaults. */
export function parseListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  source: ListStateParamSource,
): TState {
  const state = {} as TState;
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    state[fieldKey] = field.parse(readParam(source, field.key));
  }
  return state;
}

/** Serialize state to URLSearchParams. Defaults and null serializations are omitted. */
export function serializeListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  state: TState,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    const serialized = field.serialize(state[fieldKey]);
    if (serialized != null) params.set(field.key, serialized);
  }
  return params;
}

export function listStateToSearchString<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  state: TState,
): string {
  return serializeListState(schema, state).toString();
}

export function defaultListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
): TState {
  const state = {} as TState;
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    state[fieldKey] = field.defaultValue;
  }
  return state;
}

export function isDefaultListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  state: TState,
): boolean {
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    if (!fieldEquals(field, state[fieldKey], field.defaultValue)) return false;
  }
  return true;
}

export function areListStatesEqual<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  a: TState,
  b: TState,
): boolean {
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    if (!fieldEquals(field, a[fieldKey], b[fieldKey])) return false;
  }
  return true;
}

/**
 * True when the source carries any known schema key (even if the value is invalid
 * and will parse to default). Used by the admin adapter to decide storage restore.
 */
export function hasListStateParams<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  source: ListStateParamSource,
): boolean {
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    if (readParam(source, field.key) != null) return true;
  }
  return false;
}

/** Patch onto defaults; unknown keys ignored. Values still run through field.parse via serialize round-trip safety. */
export function mergeListState<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  partial: Partial<TState>,
): TState {
  const base = defaultListState(schema);
  const next = { ...base };
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    if (Object.prototype.hasOwnProperty.call(partial, fieldKey) && partial[fieldKey] !== undefined) {
      // Re-parse via serialize so untrusted partials (e.g. storage) stay on the whitelist.
      const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
      const raw = field.serialize(partial[fieldKey] as TState[keyof TState]);
      next[fieldKey] = field.parse(raw);
    }
  }
  return next;
}

/**
 * Soft-parse a JSON-like bag (sessionStorage restore): only schema keys, each value
 * coerced through serialize→parse so invalid stored values collapse to defaults.
 */
export function parseListStateRecord<TState extends Record<string, unknown>>(
  schema: ListStateSchema<TState>,
  record: unknown,
): TState {
  if (record == null || typeof record !== "object" || Array.isArray(record)) {
    return defaultListState(schema);
  }
  const bag = record as Record<string, unknown>;
  const state = {} as TState;
  for (const fieldKey of Object.keys(schema.fields) as Array<keyof TState>) {
    const field = schema.fields[fieldKey] as ListStateField<TState[keyof TState]>;
    const rawValue = bag[field.key] ?? bag[fieldKey as string];
    if (rawValue == null) {
      state[fieldKey] = field.defaultValue;
      continue;
    }
    if (typeof rawValue === "string") {
      state[fieldKey] = field.parse(rawValue);
      continue;
    }
    // Non-string stored values: serialize if the field accepts the typed value, else default.
    try {
      const serialized = field.serialize(rawValue as TState[keyof TState]);
      state[fieldKey] = field.parse(serialized);
    } catch {
      state[fieldKey] = field.defaultValue;
    }
  }
  return state;
}
