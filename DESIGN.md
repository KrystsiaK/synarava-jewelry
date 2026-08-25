# Design System: Synarava Admin

## 1. Visual Theme & Atmosphere

A restrained luxury studio console with two equal presentation modes. Dark mode uses graphite surfaces for low-light studio sessions; light mode uses neutral porcelain and mineral-gray layers for daylight work. Both retain warm champagne accents, precise typography, and CMS-oriented hierarchy. Density is balanced for repeated admin work; motion is quiet, tactile, and state-driven.

## 2. Color Palette & Roles

- **Dark canvas** (#090807) / **Light canvas** (#F2F1EE) — Admin background.
- **Dark panel** (#141312) / **Light panel** (#FFFFFF) — Panels, cards, and form blocks.
- **Elevated charcoal** (#1D1A18) / **Elevated mineral** (#ECE9E3) — Hovered and selected surfaces.
- **Dark primary ink** (#F4EFE7) / **Light primary ink** (#211D19) — Primary text.
- **Dark secondary ink** (#B8AEA1) / **Light secondary ink** (#675E55) — Secondary text and descriptions; both meet WCAG AA on their canvas.
- **Hairline Bronze** (rgba(214, 190, 150, 0.18)) — Borders and structural dividers.
- **Champagne Signal** (#D8B66A dark / #7B5B1C light) — Single accent for primary actions, focus, active nav, and published state.
- **Garnet Risk** (#B94A48) — Destructive/error state only.

The public storefront uses neutral porcelain (#F7F7F5) in light mode rather than cream or parchment. Cinematic image-led hero sections may remain dark in either preference when the photography requires it; navigation must automatically maintain readable contrast over those sections.

## 3. Typography Rules

- **Admin UI:** Hanken Grotesk for labels, headings, body, controls, counts, slugs, metadata, and status chips.
- **Admin Data:** No monospace typography in admin. Codes and slugs use the same sans family with weight, size, and color for hierarchy.
- **Hierarchy:** Product UI uses fixed rem scale. Headings stay controlled; numbers may be larger when they act as scan anchors.
- **Banned In Admin:** Monospace typography, decorative serif labels, neon accents, pure black, low-contrast gray metadata, fake terminal noise.

## 4. Component Stylings

- **Buttons:** Hard-edged luxury controls with 8px radius, visible focus rings, and subtle press feedback.
- **Panels:** Dark graphite fills with a single hairline border. Use panels for grouped editing and status contexts, not decoration.
- **Inputs:** Label above, error below, dark inset field, AA placeholder contrast, champagne focus ring. Guidance appears in compact help popovers, never as loose paragraph text beneath fields.
- **Status Badges:** Published and draft states must be visually distinct but not loud.
- **Navigation:** Left rail on desktop, compact horizontal nav on mobile, active item marked by champagne accent and surface change.

## 5. Layout Principles

Admin screens use a persistent shell, clear page headers, responsive grids, and form sections that map to CMS concepts: identity, publishing, media, taxonomy, and editorial copy. Avoid nested cards and avoid hiding important state inside subtle text.

## 6. Motion & Interaction

Transitions stay between 120ms and 220ms, mostly color, opacity, and transform. Buttons press down subtly. Reduced motion removes non-essential transitions. Loading states should use progress/skeleton treatments rather than centered spinners.

Theme preference supports Light, Dark, and System. It is persisted in the `synarava-theme` cookie, applied before hydration to prevent a wrong-theme flash, and shared by the storefront, checkout, profile, authentication, and admin studio. Theme controls must remain available on every route and in the admin mobile drawer.

## 7. Anti-Patterns (Banned)

No neon terminal green, no AI-purple gradients, no pure black, no generic SaaS metric theatre, no low-contrast charcoal text on dark backgrounds, no decorative motion, no centered marketing hero patterns inside admin, no invented publishing metrics.
