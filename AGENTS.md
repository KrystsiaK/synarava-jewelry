## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Filesystem boundary

- Never create, modify, move, rename, or delete any file or directory outside `/Users/kirylkrystsia/WebstormProjects/synarava-jewelry`.
- This prohibition includes the home directory, `/tmp`, system and application directories, adjacent repositories, Simulator data, global package locations, and Codex configuration directories.
- Do not install global tools or change operating-system, browser, Xcode, Simulator, shell, or IDE settings.
- Read-only inspection outside the project is allowed only when necessary for the task. All generated screenshots, traces, profiles, logs, and temporary artifacts must be written inside the project.
- If completing a task would require any write or mutation outside the project, stop and ask the user instead of requesting or attempting elevated access.

## Protected environment files

- Never read, search, print, copy, modify, rename, delete, or enumerate any file whose name starts with `.env`.
- Never use a wildcard or broad file-reading command that could include `.env*` files.
- The repository `PreToolUse` hook in `.codex/hooks/protect-env-local.mjs` must deny such tool calls before execution. Do not disable, bypass, rewrite, or work around this hook.
- Ask the user to enter secret values directly. Work only with variable names or redacted placeholders supplied by the user.

## Design and performance

- Treat visual ambition and runtime performance as one requirement, never a trade-off: a design is successful only when it remains fast, and performance work is successful only when it preserves the intended visual experience.
- Do not remove or flatten a rich interaction merely to make a device faster. Find an engineered alternative that retains the visual intent while reducing main-thread, paint, compositing, memory, network, or layout cost.
- For mobile and iOS, validate the actual interaction path. Prefer progressive enhancement, targeted fallbacks, and rendering strategies that preserve the effect's perceptual result rather than replacing it with a generic opaque surface.

## Documentation hygiene

- Treat documentation updates as part of Definition of Done. When a change makes product, architecture, setup, or operational documentation stale, update or remove the stale material in the same change.
- Do not preserve placeholders, superseded instructions, or descriptions of unimplemented future state as if they were current. Keep historical context only when it is explicitly labeled as history or captured in an ADR/history document.
- Before committing, review the documentation touched by or directly describing the changed behavior and make sure it matches the implementation.

## Shopify commerce model

- Treat Shopify as the source of truth for catalog and commerce capabilities. Verify the current official Shopify API and data model before implementing a commerce feature.
- Reuse Shopify-native resources, collections, metafields, metaobjects, and semantics whenever Shopify supports the capability. Do not create a parallel local commerce concept; local data may only act as an explicit projection, cache, or Synarava-specific editorial layer.
- Keep local projections synchronized with Shopify. When a Shopify capability requires approval or restricted access scopes, preserve the Shopify-native integration contract and surface the requirement instead of replacing it with an invented local substitute.

## synarava-cms

- Admin UI under `components/admin/` must reuse **synarava-cms** (`AdminTextField`, `AdminSelectField`, `AdminCheckboxField` / `AdminCheckboxControl`, `AdminLongTextField`, `AdminCollapsiblePanel`, `AdminPanel`, `AdminNavTree`, `AdminSectionTabs`, `AdminEntityList`, `AdminIconButton`, `AdminSignalChip`, `AdminSortChips`, `AdminStatusBadge`, `AdminFieldShell`). Prefer imports from `@/components/synarava-cms`. Do not invent parallel raw field markup.
- Sticky chrome uses shared rhythm (`.adm-band`, `--adm-inset-x` / Tailwind `px-adm-inset`, `.adm-band--sticky-radius`) — one horizontal gutter inside panels; no ad-hoc `px-*` / `py-*` on headers.
- Contract: [`docs/admin/synarava-cms.md`](docs/admin/synarava-cms.md). Skill: `synarava-cms` (`.agents/skills/synarava-cms/`, `.claude/skills/synarava-cms/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
