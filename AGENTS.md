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
