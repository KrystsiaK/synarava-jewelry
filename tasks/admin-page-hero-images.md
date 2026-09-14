# Spec: Admin-managed page hero images

## Objective

Make the CMS the source of truth for hero images on every built-in editorial/index page. A page
must never borrow its hero image from the first product or collection. When no image is configured,
the existing layout remains usable with a neutral background.

## Scope

- CMS page records: `home`, `about`, `shop`, `collections`, `journal`, `care`, `shipping`,
  `returns`, `faq`, `offer`, and `privacy`.
- Dynamic product, collection-detail, and journal-post pages continue using media configured on
  their own CMS entities.
- Cart, checkout, authentication, and account screens are functional flows, not editorial heroes,
  and are outside this feature.

## Existing contract

- Store the image in the existing `Page.content.heroImage` field.
- Reuse the existing page image upload flow and `ImageFileField`; do not add a parallel settings
  table or a second media-storage path.
- Only published/public page records affect the storefront.

## Implementation plan

1. Define and seed the protected built-in page records so every route is visible in Admin → Pages.
2. Remove automatic product/collection hero fallbacks from Home, Shop, and Collections.
3. Pass each route's configured `heroImage` into its hero component and Open Graph metadata.
4. Add optional configured media to Journal, service, legal, and generic static-page heroes while
   preserving their current typography and responsive layout.
5. Verify with focused tests, the full test suite, lint, type-check, production build, and browser
   checks at desktop and mobile widths.

## Success criteria

- Uploading a hero image in Admin → Pages changes only that route's leading hero image.
- Shop and Collections no longer use the first product/collection as their hero.
- Home no longer falls back to the first collection image.
- Removing a configured hero produces a valid neutral hero, not an unrelated automatic image.
- Built-in page records cannot be deleted as custom pages.
- Existing product, collection-detail, and journal-post media behavior remains unchanged.

## Commands

- Focused tests: `pnpm test:run <test files>`
- Full tests: `pnpm test:run`
- Lint: `pnpm lint`
- Type-check: `pnpm exec tsc --noEmit`
- Build: `pnpm build`

## Boundaries

- Always: reuse the current CMS upload/storage abstraction and decorative-image accessibility.
- Ask first: changing how entity-level product, collection, or post media is authored.
- Never: read protected environment files or create a second local commerce/content source of truth.
