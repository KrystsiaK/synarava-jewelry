# Admin tech debt

Open product-admin / CMS follow-ups that are intentionally deferred. Keep entries
actionable: problem, why deferred, acceptance criteria. Resolved items move to
`docs/history/` or are deleted with a one-line note in the PR.

---

## TD-01 — Compare-at price: legal rules + Synarava edit path

**Status:** open (2026-09-25)  
**Area:** Product editor → Price tab · `compareAt` / Shopify `compareAtPrice`  
**UI today:** `AdminReadonlyField` — Synarava shows the pulled value only; edit in Shopify Admin.

### Why deferred

Compare-at (reference / “was” price) is subject to consumer-protection and
promotional-pricing rules that differ by market (EU/EEA, Ireland, etc.). What we
may show as a struck-through original, for how long, and when a discount claim is
lawful is not settled for Synarava. Editing from CMS before those rules are clear
risks storefront claims we cannot defend.

### What to figure out

1. **Legal / commercial policy** — which reference-price patterns are allowed for
   Synarava (and Shopify) storefronts; any required disclosure or history window.
2. **Product rules** — when compare-at may be set relative to Price (must be
   higher? clearance? prior 30-day lowest?).
3. **Edit ownership** — after rules exist: keep Shopify-only, or reopen Synarava
   edit with validation that encodes the policy.
4. **Conflict apply** — catalog conflict writer still treats “Compare-at price” as
   a scoped commerce field (`commerce-field-apply`). Decide whether Synarava →
   Shopify apply stays enabled once CMS edit is locked, or should be blocked /
   Shopify-wins only until TD-01 closes.
5. **Unit price** (related, separate) — Shopify Unit price / `unitPriceMeasurement`
   remains deferred on the Price tab.

### Acceptance when done

- [ ] Written policy (or link to counsel note) for compare-at on Synarava storefronts
- [ ] Admin UX matches that policy (read-only vs editable + validation)
- [ ] Pull/push and conflict-apply paths documented and tested against the decision
- [ ] This entry closed or moved to history

### Code pointers

- UI: `components/admin/products/product-price-fields.tsx` (`AdminReadonlyField`)
- Save preserves DB compare-at (ignores FormData): `app/admin/actions/products.ts`
- Sync: `lib/shopify/product-sync.ts` (pull/push still round-trip the projection)
- Conflict apply: `lib/shopify/commerce-field-apply.ts` (“Compare-at price”)
- Library control: `AdminReadonlyField` in synarava-cms
