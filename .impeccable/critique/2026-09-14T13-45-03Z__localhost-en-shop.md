---
target: improve categorization and visual hierarchy of the /shop catalog page
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "url:http://localhost:3000/en/shop"
timestamp: 2026-09-14T13-45-03Z
slug: localhost-en-shop
---
Method: dual-agent (A: aa8dc70fbbe4d0a8e · B: a907ae0ef24b76f2c)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Filter/sort changes show a progress bar + `aria-live` product count; solid, minor gaps only |
| 2 | Match System / Real World | 1 | Category facet values are raw multi-level Shopify/Google taxonomy strings, not plain-language names |
| 3 | User Control and Freedom | 2 | Good chip-level remove/clear-all/search-clear, but a stale-filter bug silently traps users in a 0-result state |
| 4 | Consistency and Standards | 3 | Visual system is consistent; card tags show a *truncated* taxonomy string while filter chips show the *full* one — two presentations of the same data |
| 5 | Error Prevention | 2 | Empty states are proactive, but nothing guards against the stale-department-filter bug resurfacing |
| 6 | Recognition Rather Than Recall | 3 | Active filters are clearly restated as chips; unstocked departments (Pets) aren't flagged in the dropdown, forcing a click to discover emptiness |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts; session-restore ("last viewing") banner is a nice efficiency touch, sort/search cover the basics |
| 8 | Aesthetic and Minimalist Design | 3 | Strong restraint in the default filter row (4 visible facets); undercut by taxonomy-string clutter on every card plus systemic undersized/cramped chip typography |
| 9 | Error Recovery | 3 | Genuinely good: warm "Pets is coming soon" copy with a CTA, and a deliberate broken-image fallback state in `ProductCard` |
| 10 | Help and Documentation | 1 | No inline help for jargon-adjacent facets (Origin, Compliance/REACH); FAQ exists only in the footer, disconnected from the filter bar |
| **Total** | | **23/40** | **Acceptable — significant improvements needed before users are happy** |

## Design Specificity Verdict

**LLM assessment (Assessment A):** Leans authored, undercut by a raw-data leak. The catalog has a real point of view — display serif headlines with an italic couture-red accent, an uppercase mono label system, product photography that sits desaturated at rest and blooms to color/scale on hover, an asymmetric editorial grid, and oversized ghost-text as background texture. That's specific, not a generic Shopify-theme default. What breaks the illusion: the category taxonomy shown to customers is the raw, unmapped Shopify/Google Product Taxonomy string (e.g. a filter chip reading `APPAREL & ACCESSORIES > CLOTHING ACCESSORIES > HAIR ACCESSORIES > HAIR PINS, CLAWS & CLIPS > HAIR BARRETTES & SLIDES`, wrapped across 3–4 lines), and every product card's tag row repeats the pattern. That's backend commerce plumbing surfacing verbatim in a "curated" storefront. Also: the hero is exclusively jewelry photography while the page's own copy promises four departments (jewelry, pets, kids, jewelry-making).

**Deterministic scan (Assessment B):** CLI static scan of the shop source (`app/[locale]/shop/page.tsx`, `components/shop/*`) was clean (exit 0, no findings) — the anti-pattern detector only catches known structural markup patterns, not runtime/data-driven content. The **browser-injected runtime detector found ~90–120 individual findings** (console reported "90 anti-patterns found" with 120 detail lines — a discrepancy in the detector's own console output, flagged rather than resolved) on the live desktop page, grouped as:

| Rule | Occurrences | What |
|---|---|---|
| `undersized-ui-text` | ~55 | Product count text, prices, and filter/tag chips rendering below 11px (down to 10px) |
| `all-caps-body` | ~14 | `text-transform: uppercase` on the same tag-chip body text |
| `clipped-overflow-container` | ~16 | Every product card's image wrapper (`overflow-hidden` + `aspect-[3/4]`/`aspect-[16/9]`) clips a positioned child — one root pattern repeated per card |
| `cramped-padding` | ~13 | 2px vertical padding on the 10px tag chips (needs ≥4px) |
| `skipped-heading` | 1 | Page goes `<h1>` "Curated shop" straight to `<h3>` product titles — no `<h2>` |
| `bounce-easing`, `layout-transition`, `codex-grid-background` | 1 each | Minor `body`-level motion/background rules |

This directly corroborates Assessment A's taxonomy-chip finding from a different angle: the exact chips A flagged as "wrong label" are the same chips B flagged as "too small, cramped, all-caps." One broken component, two independent audits converging on it.

**Visual overlays:** Injection succeeded and a live on-page overlay (yellow badges over affected elements) was confirmed in the browser tab during the audit; it is not still running now (the live-server was stopped after the pass).

## Overall Impression

The `/shop` catalog has a genuinely specific visual identity — hover interactions, editorial grid, restrained default filter row — sitting on top of an unmapped, backend-shaped data layer. The single biggest opportunity: the page's actual structural/backend building blocks (department, collection, priority, popular-sort) already exist and work; what's missing is presenting *human, curated-feeling labels and states* on top of them instead of leaking raw Shopify taxonomy strings and a positional "featured" hack.

## What's Working

1. **Product card hover interaction** (grayscale→color, brightness lift, slide-up caption, red underline sweep) is specific and consistently applied — real brand work, not decoration.
2. **Edge-case states got real design attention**: the "Pets is coming soon" empty department state (warm copy + CTA) and the broken-image fallback in `ProductCard` are both thought through, not defaults.
3. **Default filter row is disciplined**: Department, Category, Availability, Sort are the only facets visible by default; Collection, Tag, Material, Finish, Origin, Compliance are tucked behind "More Filters" — textbook progressive disclosure.

## Priority Issues

**[P1] Category filters and product tags show raw Shopify/Google taxonomy strings instead of human labels**
- **Why it matters**: A shopper sees filter options like `APPAREL & ACCESSORIES > HANDBAG & WALLET ACCESSORIES > BAG CHARMS` instead of "Bag Charms" — on mobile this spans 3 lines in the "Refine Products" sheet, and the same raw, all-caps, sub-11px string repeats as a tag under every product card (confirmed independently by the runtime detector: ~55 undersized-text + ~14 all-caps + ~13 cramped-padding hits, almost entirely on this one component). It reads as unfinished commerce plumbing, not a curated boutique.
- **Fix**: Map each Shopify category leaf to a short, human label before it reaches the filter option / card tag; reserve the full path (if needed) for a tooltip, not the primary label. Fix the typography (min 11px, real padding, drop forced uppercase or increase tracking/size to compensate) on the same pass.
- **Suggested command**: `/impeccable clarify`

**[P1] Stale department filter silently re-traps users in a 0-result state**
- **Why it matters**: Selecting Department → Pets correctly lands on "Pets is coming soon"; its "Browse available products" CTA navigates back to `/shop` (16 products). But `FilterBar`'s local state isn't reset on that navigation — the next action (e.g. changing Sort) re-applies the abandoned `department=pets` filter from memory, silently dropping the grid to 0 results with no visible cause. Reproduced directly: `/shop` (16 products) → escape Pets empty state → change sort → URL becomes `/shop?department=pets&sort=popular` → 0 products.
- **Fix**: Reset/re-sync `FilterBar`'s `filters` state from the URL/props whenever the route changes outside the component's own `navigate()` calls, not just on mount.
- **Suggested command**: `/impeccable harden`

**[P2] "Featured" visual treatment is hardcoded to grid position, not sort/priority state**
- **Why it matters**: `isFeatured = index === 0` in `ProductGrid` gives only the first card a larger aspect ratio, bigger type, and a shown description — regardless of the active sort. Under Price or Name sort, whatever happens to land first inherits a "this is special" signal it didn't earn, misleading shoppers about what's actually being highlighted (the real featured/priority and popular/best-selling data already exist server-side and aren't being used for this).
- **Fix**: Only apply the featured treatment when `sort === "featured"`, or base it on the real priority/best-seller signal already powering the backend sort.
- **Suggested command**: `/impeccable clarify`

**[P2] Not-yet-stocked departments are visually identical to live ones**
- **Why it matters**: "Pets" appears in the desktop dropdown and mobile nav drawer with the same styling as Jewelry/Kids/Jewelry Making — no badge or disabled state — so discovering it's empty costs a full click-and-render cycle, every visit.
- **Fix**: Badge or visually de-emphasize zero-product departments directly in the dropdown/menu (e.g. a muted "soon" tag).
- **Suggested command**: `/impeccable clarify`

**[P3] Structural/semantic gaps: skipped heading level and systemic clipped image containers**
- **Why it matters**: The page jumps `<h1>` → `<h3>` with no `<h2>`, hurting screen-reader navigation. Separately, every product card's image wrapper clips a positioned child via `overflow-hidden` + fixed aspect-ratio — one repeated pattern across all 16 cards, likely intentional crop behavior but worth confirming it never clips content that should stay visible (e.g. badges, quick-add controls).
- **Fix**: Insert a real `<h2>` (visually hidden if needed) ahead of the product grid; audit the card image wrapper for any positioned child that gets unintentionally clipped.
- **Suggested command**: `/impeccable audit`

## Persona Red Flags

**Jordan (Confused First-Timer)**: Taps "Bag Charms" expecting a category and instead parses a 3-line raw taxonomy string. Taps "Pets" in the department menu (identical styling to live departments) and hits a dead end with no advance warning. Compliance/Origin facets (REACH, "Lead free," "Cadmium free") have zero inline explanation.

**Riley (Deliberate Stress Tester)**: Found the exact stale-filter break described above (P1). Also surfaced live placeholder content shipping in production markup — the "AXIS Turquoise Necklace" card body text literally reads **"Test QA short description."**

**Casey (Distracted Mobile User)**: The "Refine Products" bottom sheet's Category section is dominated by 3–4-line taxonomy buttons — one-thumb scanning is effectively impossible before reaching a usable facet (Availability, Tag). The Sort/Filters toolbar sits just below the hero, not in the thumb zone.

## Minor Observations

- Two large ghost-text treatments back to back ("ARCHIVE" footer CTA band, then "SYNARAVA / CURATED GOODS" in the footer immediately below) read as the same trick used twice in quick succession.
- Price is shown twice per card (hover overlay + static meta row) — redundant, not harmful.
- Desktop Sort dropdown's inactive trigger reads "FEATURED" but "Featured" never appears as a selectable row in its own menu — implied by the "All"/clear row, a small label/content mismatch.
- Hero photography represents only jewelry despite the page's own copy promising four departments — a shopper arriving for pet accessories or kids' kits sees an entirely jewelry-branded moment first.
- Minor `body`-level motion/background rules flagged by the detector (bounce easing, a width transition, a decorative grid-line background) — low severity, worth a quick look during any animation/layout pass.
- Mobile-viewport browser automation failed in Assessment B for tooling reasons (`resize_window` didn't reflow the tab's actual rendering viewport); Assessment A's mobile findings (Casey persona) came through direct inspection and stand on their own, but a dedicated mobile screenshot pass is still worth doing before shipping fixes.

## Questions to Consider

- Does "Featured" need to mean something curated, or is it currently just `index === 0` doing double duty as a layout trick?
- If a shopper arrived specifically for pet accessories or kids' kits, would this hero tell them they're in the right place?
- What would it cost to give every Shopify taxonomy path a two-word human label before it ever reaches a customer-facing chip?
