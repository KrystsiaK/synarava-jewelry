# ECC skills for Cursor cloud agents

Everything Claude Code (ECC) is installed into project `.cursor/` and committed so cloud checkouts receive it.

## Surfaces in git

| Path | Purpose |
| --- | --- |
| `.cursor/ecc-install-state.json` | ECC install metadata (paths sanitized; no secrets) |
| `.cursor/skills/` | Full ECC Cursor skill library (~120) |
| `.cursor/.agents/skills/` | ECC cross-harness skill copies |
| `.cursor/agents/` | Prefixed ECC agents (`ecc-*.md`) |
| `.cursor/commands/` | ECC slash commands |
| `.cursor/scripts/` | ECC scripts / hook helpers |
| `.cursor/hooks.json` + `.cursor/hooks/` | ECC hooks |
| `.cursor/rules/` | ECC language/common rules (keeps `synarava-cms.mdc`) |

**Not committed:** `.cursor/mcp.json`, `.cursor/mcp-configs/` (MCP wiring; avoid shipping secrets/keys).

## Curated copies under `.agents/skills/`

Cloud `available_skills` is dominated by repo-root `.agents/skills/`, not `.cursor/skills/`. These ECC (and related) skills are copied there so agents actively load them:

- `coding-standards`, `tdd-workflow`, `security-review`, `frontend-patterns`, `verification-loop`
- `ecc-guide`, `configure-ecc`, `ecc-conventions`, `ecc-recipes`
- `e2e-testing`, `api-design`, `backend-patterns`, `git-workflow`, `error-handling`
- `documentation-lookup`, `eval-harness`, `strategic-compact`, `production-audit`, `delivery-gate`
- `contract-first`, `agent-self-evaluation`, `codebase-onboarding`, `intent-driven-development`
- `iterative-retrieval`, `continuous-learning`, `agent-introspection-debugging`
- `skill-stocktake`, `skill-scout`
- `frontend-a11y`, `nextjs-turbopack`, `react-patterns`, `react-testing`, `react-performance`
- `design-system`, `mcp-server-patterns`
- `graphify` (from local `~/.agents/skills/graphify`; required by `AGENTS.md`)

Language-specific ECC skills (Django, Laravel, Kotlin, …) remain under `.cursor/skills/` only.

## Refresh

Re-run ECC install on a machine, then re-copy the curated set into `.agents/skills/` and commit. Prefer ECC’s Cursor installer over inventing a parallel skills lock entry.
