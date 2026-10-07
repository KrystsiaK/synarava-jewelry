# Synarava UI Kit

## Design intent

The UI kit must support all Stitch surfaces with one shared vocabulary:

- museum/editorial composition
- high-contrast serif headlines
- restrained grotesk utility labels
- mono metadata
- hard edges over soft ecommerce pills
- glass, linen, charcoal, and couture-red surfaces

## Foundation tokens

These tokens live in CSS variables and should remain the only source of truth:

- colors
  - `--color-linen`
  - `--color-stone-beige`
  - `--color-charcoal`
  - `--color-couture-red`
  - `--color-muted-ink`
  - `--color-glass`
  - `--color-glass-strong`
  - `--color-border-subtle`
  - `--color-border-soft`
- type
  - `--font-sans` — Hanken Grotesk variable (`latin`, `latin-ext`, `cyrillic-ext`), `display: swap`
  - `--font-serif` — Playfair Display variable normal+italic (`latin`, `latin-ext`, `cyrillic`), `display: swap`
  - `--font-mono`
  - `--font-size-label-caps`
  - `--font-size-label-mono`
  - `--tracking-label-caps`
  - `--tracking-label-mono`
  - `--tracking-brand`

Root layout (`app/layout.tsx`) owns `next/font` loading. Prefer the variable
files over static weight lists so LCP does not pull one file per weight×style.
Hanken has no basic `cyrillic` subset on Google Fonts — only `cyrillic-ext` —
so Russian body copy may still fall back for some glyphs; Playfair covers
display Cyrillic.
- layout
  - `--spacing-page-x-mobile`
  - `--spacing-page-x-desktop`
  - `--spacing-gutter`
  - `--spacing-section`
  - `--spacing-footer-y`
- effects
  - `--blur-panel`
  - `--blur-glass`

## Core primitives

These primitives should be used across all screens:

- `CapsLabel`
  - utility eyebrow, section name, status label
- `MonoMeta`
  - archive numbers, prices, timestamps, product codes
- `DisplayHeading`
  - every large storefront serif title (heroes, PDP, shop, collections)
  - owns fit-by-longest-word: never mid-word-break; shrink type to the measure instead
  - do not add `overflow-wrap: anywhere` / `break-all` on display type; do not rebuild titles with raw `.type-display`
- `EditorialHeading`
  - large serif display heading; for narrow `max-w-[Nch]` heroes use `DisplayHeading` + `text` (fit)
- `BodyLead`
  - intro paragraph with generous line-height
- `ArtifactPanel`
  - glass or framed information card
- `ArtifactButton`
  - shared primary/secondary CTA styling for buttons and links; the red primary variant always has white text
  - `PrimaryCtaButton` uses the same primary styling for magnetic editorial links and form actions
- `MediaFrame`
  - image wrapper with optional mirrored crop, overlay, caption
- `DividerOrnament`
  - hairline section divider with a single accent diamond in the pause
- `InfoList`
  - compact label/value list for PDP and admin sidebars

## Screen composition rules

### Product detail

- hero split layout
- mirrored media fragment
- one product info panel
- one semantic/story panel
- one related pairing gallery

### Collection detail

- collection hero
- editorial lead block
- repeated alternating `media + text panel` sections
- product rail driven by the same product cards used elsewhere

### Collections index

- unified search canvas
- collection cards and product cards share one spacing scale
- filters and search controls use the same field primitives as admin

### Manifesto and home

- built from `Page` content blocks using the same primitives
- no one-off bespoke components if a primitive composition can express it

## Admin UI kit extension

The admin should reuse the same foundations, but with denser information:

- `AdminShell`
- `AdminSidebar`
- `DataTable`
- `EntityHeader`
- `FieldGroup`
- `AssetPicker`
- `StatusBadge`
- `PermissionMatrix`

Admin **form** controls live in **synarava-cms** (`@/components/synarava-cms`) — not in this storefront UI kit. See [`docs/admin/synarava-cms.md`](./admin/synarava-cms.md).

Cross-surface chrome that both admin and storefront need (e.g. ephemeral toast) lives in `components/ui/` — see [`docs/ui/ephemeral-toast.md`](./ui/ephemeral-toast.md). Do not put shared toasts inside synarava-cms.

## Implementation rule

Before building pages, implement primitives first and compose screens from them. If a page needs a unique visual pattern, promote it into a reusable component instead of embedding raw markup into one page file.

### Where new UI goes

| Need | Put it in |
|------|-----------|
| Admin form field / panel / list chrome | synarava-cms (`components/admin/shared` + re-export) |
| Shared admin+storefront surface (toast, modal shell, tooltip) | `components/ui/` |
| Storefront-only editorial section | feature folder under `components/` (`home/`, `shop/`, …) composing `components/ui` primitives |
