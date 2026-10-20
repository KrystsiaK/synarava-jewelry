# ADR-0006: Mission Control as architecture map and operations center

**Date**: 2026-10-20
**Status**: accepted
**Deciders**: project owner

## Context

Mission Control v1 proved the read-only status map, but the owner also needs the
same screen to explain the complete operating architecture: service ownership,
environment-specific destinations, documentation, and the systems around each
live signal. Fixed cards alone do not support inspecting a larger map or
rearranging it for a particular screen.

The safety boundary remains unchanged: Mission Control observes and explains;
it never operates a service or writes infrastructure state.

## Decision

Mission Control v1.1 is the repository-backed architecture map and read-only
operations center.

- `lib/mission-control/wiring-config.json` remains the single source of truth
  for groups, nodes, documentation, environment presentation, and directed
  flows.
- Nodes may be dragged for local reading comfort. Positions are stored only in
  guarded `localStorage`, keyed by selected environment and config version.
  Reset restores the repository layout. Connections are never edited.
- Nodes are `live`, `info`, or `placeholder`. Only `live` nodes have providers
  and status records. Info nodes explain verified architecture without creating
  fake health data; placeholders show planned/unwired systems honestly.
- Directed edges are either `continuous` or `event`. Continuous flows remain
  active; event flows animate only while `lastFlowAt` is fresh.
- Framed groups describe system boundaries. Selecting any node opens one shared,
  accessible inspection window with status, topology, docs, remediation copy,
  and a small typed extension slot. v1.1 ships only the `database` extension.
- Production/Staging changes environment-specific labels, links, and settings.
  Live health always comes from the deployment currently rendering the page and
  is labeled as such; the hub never reads another environment's database.
- Allowed controls are limited to navigation, prompt copy, opening/closing the
  inspection window, node dragging, resetting local layout, and changing the
  displayed environment.

This decision supersedes only ADR-0005/runbook language that forbade node
dragging. It does not permit editing graph connections, repository config,
providers, services, or databases from the UI.

## Alternatives considered

### Persist positions in Postgres

Rejected: layout is a personal viewing preference, not business state. It would
add schema, writes, authorization surface, and migration risk for no operational
benefit.

### Make every architecture node live

Rejected: fabricated health is worse than an honest neutral node. A node is
promoted to `live` only when a provider exists.

### Create per-service modal implementations

Rejected: one shared inspector plus a tiny typed extension registry keeps the
interaction consistent. Only a database extension is justified now.

## Consequences

- The hub becomes useful both for a five-second health scan and architecture
  orientation without gaining service-action privileges.
- The map is larger and requires explicit ordered geometry, group validation,
  mobile list parity, and robust localStorage fallbacks.
- Repository documentation links can be verified. Unknown external destinations
  remain empty and are tracked as owner TODOs rather than invented.
- Browser layout preferences are intentionally non-portable and disposable.

