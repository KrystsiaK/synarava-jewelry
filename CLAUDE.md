## graphify

Canonical graphify rules live in `AGENTS.md` (query-first, dirty `graphify-out/` expected locally, never commit `graphify-out/` in feature PRs — restore/unstage before commit; maintainer refreshes via `chore: refresh graphify`).

## Ship finished work (staging → main)

See `.agents/skills/ship-to-main/SKILL.md` (canonical).

## Mission Control hub

Любая работа над хабом наблюдения — сперва прочитать `docs/runbooks/mission-control-hub-plan.md`, §0 «Контракт простоты», и [ADR-0005](docs/adr/0005-mission-control-hub.md). Усложнение здесь — провал, а не фича: read-only витрина на `@synarava/*` виджетах, бюджет сложности строгий, превышение = СТОП и вопрос владельцу.
