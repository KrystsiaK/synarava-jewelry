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
  - `--font-sans`
  - `--font-serif`
  - `--font-mono`
  - `--font-size-label-caps`
  - `--font-size-label-mono`
  - `--tracking-label-caps`
  - `--tracking-label-mono`
  - `--tracking-brand`
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
- `EditorialHeading`
  - large serif display heading
- `BodyLead`
  - intro paragraph with generous line-height
- `ArtifactPanel`
  - glass or framed information card
- `ArtifactButton`
  - primary/secondary CTA with hard-edged silhouette
- `MediaFrame`
  - image wrapper with optional mirrored crop, overlay, caption
- `DividerOrnament`
  - stitched / symbolic separator
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

## Implementation rule

Before building pages, implement primitives first and compose screens from them. If a page needs a unique visual pattern, promote it into a reusable component instead of embedding raw markup into one page file.
