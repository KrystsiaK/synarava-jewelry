# Shared list-state

One schema-driven codec for admin and storefront list filters. Adding a filter = one schema entry. No duplicated parse/serialize logic.

## Layout

| Layer | Path | Role |
|---|---|---|
| Core (pure TS) | `lib/list-state/` | `ListStateSchema`, field helpers, `parseListState` / `serializeListState` |
| React | `components/shared/list-state/` | `useListState(schema, adapter)`, admin + site adapters |
| Domain schemas | e.g. `lib/admin/products-list-state.ts` | Concrete field lists per surface |

URL is the source of truth (`router.replace`, `scroll: false`). Invalid / unknown values whitelist-drop to defaults. Pagination `cursor` is never part of a schema (refetch page 1 on restore).

## Adapters

- **Admin** (`createAdminListStateAdapter`): URL + versioned `sessionStorage` restore when the URL has no schema params. `clear()` resets URL and storage. All storage access is try/catch.
- **Site** (`createSiteListStateAdapter`): URL only — shareable / SEO-clean; no storage restore. Canonical, robots, and hreflang stay unchanged.

## Admin list survey (filters)

| List | Has filters? | Status | Why |
|---|---|---|---|
| Products (`ProductsCms`) | Yes — q, status, category, collection, sort | **Migrated** | Was five `useState`s lost on navigation; now shared schema + admin adapter |
| Collections (`CollectionsCms`) | No | Skipped | Full in-memory list + row actions / reorder only |
| Pages (`PagesCms`) | No | Skipped | Full in-memory list + row actions only |
| Site videos (`SiteVideosCms`) | No | Skipped | Form editor, not a filterable list |
| Translations / languages | No list filters | Skipped | Panel/config UI, not a catalog-style list |
| Orders | N/A | Skipped | No admin orders list route under `app/admin/(admin)/` |
| Mission Control / meta / settings | N/A | Skipped | Dashboards / editors, not filterable entity lists |

When a new admin list gains search/status/sort controls, add a domain schema next to that feature and wire `useListState` with the admin adapter — do not reintroduce local filter `useState`.

## Storefront

Shop / collection filter bars should use the same core with the **site** adapter. Resulting URLs and catalog queries must stay identical (see shop migration PR).
