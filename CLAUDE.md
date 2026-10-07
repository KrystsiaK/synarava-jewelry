## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- Dirty `graphify-out/` files are expected after hooks or incremental updates. Committed artifacts (`graph.json`, `GRAPH_REPORT.md`, `manifest.json`) travel with the repo for fast context on another machine; `cache/` stays local.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Ship finished work (staging → main)

See `.agents/skills/ship-to-main/SKILL.md` (canonical).
