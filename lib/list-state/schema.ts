import type { ListStateField, ListStateSchema } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- field value types vary; InferState recovers them
type AnyField = ListStateField<any>;

type InferState<TFields extends Record<string, AnyField>> = {
  [K in keyof TFields]: TFields[K] extends ListStateField<infer T> ? T : never;
};

/**
 * Declare a list schema. Adding a filter = adding one entry to `fields`.
 * Field object keys are the typed state keys; each field's `key` is the URL param name.
 */
export function defineListStateSchema<const TFields extends Record<string, AnyField>>(
  fields: TFields,
): ListStateSchema<InferState<TFields>> {
  return { fields: fields as ListStateSchema<InferState<TFields>>["fields"] };
}
