import type { ListStateSchema } from "@/lib/list-state";

import { createListStateStorage, type ListStateStorage } from "./storage";

/**
 * Thin adapter contract. Both admin and site share one hook; only persistence differs.
 * Open/Closed: new surfaces add an adapter factory, not a fork of the hook.
 */
export type ListStateAdapter<TState extends Record<string, unknown>> = {
  readonly kind: "admin" | "site";
  /**
   * When the URL has no schema params, restore the last saved state into the URL once.
   * Site adapters leave this undefined (shareable / SEO-clean URLs only).
   */
  readonly storage?: ListStateStorage<TState>;
};

/** Admin: URL is source of truth + versioned sessionStorage restore when the URL is bare. */
export function createAdminListStateAdapter<TState extends Record<string, unknown>>(options: {
  listId: string;
  schema: ListStateSchema<TState>;
  version?: number;
}): ListStateAdapter<TState> {
  return {
    kind: "admin",
    storage: createListStateStorage({
      listId: options.listId,
      schema: options.schema,
      version: options.version,
    }),
  };
}

/** Storefront: URL only — no storage restore (shareable, SEO-clean). */
export function createSiteListStateAdapter<TState extends Record<string, unknown>>(): ListStateAdapter<TState> {
  return { kind: "site" };
}
