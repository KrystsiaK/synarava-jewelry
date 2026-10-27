import type { ListStateField, ListStateSchema } from "./types";

type InferState<TFields extends Record<string, ListStateField<unknown>>> = {
  [K in keyof TFields]: TFields[K] extends ListStateField<infer T> ? T : never;
};

/**
 * Declare a list schema. Adding a filter = adding one entry to `fields`.
 * Field object keys are the typed state keys; each field's `key` is the URL param name.
 */
export function defineListStateSchema<
  const TFields extends Record<string, ListStateField<unknown>>,
>(fields: TFields): ListStateSchema<InferState<TFields>> {
  return { fields } as ListStateSchema<InferState<TFields>>;
}
