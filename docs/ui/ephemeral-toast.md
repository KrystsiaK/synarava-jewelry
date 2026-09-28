# Ephemeral toast (shared UI)

Quiet status / error notices for **admin and storefront**. Not a notification center.

## Placement rule (cms vs view vs shared)

| Surface | Home | Import |
|---------|------|--------|
| Shared UI (admin **and** storefront) | `components/ui/` | `@/components/ui/ephemeral-toast` or `@/components/ui` |
| Admin form chrome only | synarava-cms → `components/admin/shared/` | `@/components/synarava-cms` |
| Storefront editorial / CMS view composition | `components/ui/` primitives + feature folders (`home/`, `shop/`, …) | feature modules |

Ephemeral toast is **shared UI**. It must **not** live in synarava-cms (admin fields) or a storefront-only view package.

Admin keeps a thin adapter so existing mutation call sites stay stable:

- `components/admin/shared/admin-toast.tsx` → `AdminToastProvider` / `useAdminToast`
- Implementation is `EphemeralToastProvider` with `surface="admin"` (z-index `--adm-z-toast`)

## API

```tsx
import { EphemeralToastProvider, useEphemeralToast } from "@/components/ui/ephemeral-toast";

// Root storefront mount (app/layout.tsx)
<EphemeralToastProvider surface="storefront">{children}</EphemeralToastProvider>

// Client call site
const { pushToast } = useEphemeralToast();
pushToast({ message: "Could not save wishlist.", tone: "error" });
pushToast({ message: "Saved.", tone: "success" });
```

Admin:

```tsx
import { useAdminToast } from "@/components/admin/shared/admin-toast";

const { pushToast } = useAdminToast();
pushToast({ message: result.error, tone: "error" });
```

Tones: `error` | `success` | `info`. Empty messages are ignored.

## Behavior

| Rule | Choice |
|------|--------|
| Placement | **Bottom-center**, safe-area aware. Clears sticky storefront header and admin topbar; leaves privacy consent (bottom-left) and cart confirmation (bottom-right) alone. |
| Duration | success `3200ms`, info `4000ms`, error `7000ms`. Pause on hover/focus; resume with remaining time. |
| Queue | Max **2** visible. Same `message`+`tone` **replaces** (no duplicate stack). At capacity, oldest drops; newest shows. |
| Motion | Short enter from below; `prefers-reduced-motion` → opacity fade only. |
| A11y | `role="alert"` + assertive for errors; `role="status"` + polite otherwise. Focus not stolen. Dismiss control is keyboard-reachable. |
| Visual | Brand glass (`--color-glass`, `--blur-glass`), quiet tone accent hairline — no loud red slabs, no emoji, no tone title shouting “Error”. |

## Providers

- Storefront: `EphemeralToastProvider` in `app/layout.tsx`
- Admin console: `AdminToastProvider` in `app/admin/(admin)/layout.tsx` (nested admin surface / z-index)
- Modals must not mark the toast portal `inert` (`data-ephemeral-toast-root`, legacy `data-admin-toast-root`)

## Replaced UI

- Previous admin-only `AdminToastCard` stack (top-center, 22s, loud gradient slabs, uncapped queue)
- Wishlist inline absolute error popover → shared toast

Form-level `AdminAlert` banners stay for in-form save/load copy; they are not ephemeral toasts.

## Tests

`components/ui/__tests__/ephemeral-toast.test.tsx` — queue cap, duplicate collapse, auto-dismiss, hover pause, dismiss control.
