# Admin help article template

New admin how-to documentation belongs in this directory. Each article is a
reviewed Markdown file named with a lowercase kebab-case slug. Images belong in
`docs/user/assets/` and are referenced as `assets/file-name.png`.

Russian owner copies use a `-ru` slug suffix (for example `sync-flow.md` and
`sync-flow-ru.md`). Keep RU and EN behavior in lockstep; mark unfinished
product work as **coming**, never as current.

Copy this template into `docs/user/<slug>.md`:

```md
---
title: Clear task-focused title
section: Catalog
status: draft
verifiedOn:
updatedOn: 2026-10-23
---

# Clear task-focused title

## Goal

Explain the outcome and the system concept the reader needs to understand.

## Before you start

- List permissions, source material, or decisions needed first.

:::diagram name=product-ownership label="One product, two clear owners"
:::

## Steps

:::steps
### First step

Explain the action and why it matters.

Put real screenshots under `docs/user/assets/` (for example
`assets/add-product-header.png`) and embed them with a normal markdown image
once the file exists.

### Second step

Explain the next action.
:::

:::note
Use a note for context that helps the reader understand the system.
:::

:::warning
Use a warning for a choice that can create an unwanted state.
:::

:::good-to-know
Use good-to-know for a calm shortcut or useful distinction.
:::

Use `[Sync](glossary:sync)`, `[Draft](glossary:draft)`, or
`[Published](glossary:published)` to explain a glossary term on hover or tap.

## What if...

:::what-if
### The expected result does not appear

**Cause:** State the likely cause.

**What happens:** Describe the visible result.

**What to do:** Give the safest recovery action.
:::

## Verified on

Not verified yet. When the workflow is checked against the current admin, set
`status: verified`, add `verifiedOn: YYYY-MM-DD`, and update this section.
```

## Supported custom blocks

| Block | Purpose |
|---|---|
| `:::note` | Explanatory context |
| `:::warning` | Risk or important constraint |
| `:::good-to-know` | Useful distinction or shortcut |
| `:::steps` | Numbered cards; each `###` heading starts a step |
| `:::what-if` | Expandable recovery cards; each `###` heading starts a case |
| `:::diagram name=...` | Token-themed system flow diagram |

Raw HTML is not supported. Keep article behavior reviewable and safe in plain
Markdown rather than embedding scripts, iframes, or custom HTML.
