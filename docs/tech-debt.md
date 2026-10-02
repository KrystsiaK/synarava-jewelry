# Storefront and integrations tech debt

Open storefront, customer-experience, and third-party integration follow-ups that
are intentionally deferred. Keep entries actionable: problem, reason for
deferral, launch criteria, and an explicit owner before activation.

Admin/CMS-specific follow-ups remain in [`docs/admin/tech-debt.md`](admin/tech-debt.md).

---

## TD-CX-01 — Evaluate Shopify Inbox for the headless storefront

**Status:** open (2026-10-02)  
**Area:** Customer support · Shopify Inbox · Next.js headless storefront  
**Current decision:** Do not install or expose Shopify Inbox in production yet.

### Problem

Shopify Inbox is Shopify's customer-chat product, but its documented storefront
activation path uses an Online Store theme app embed. Synarava runs a custom
Next.js storefront, so installing the Shopify app alone does not establish that
the customer-facing chat can be embedded, authenticated, styled, or supported
correctly on the production site.

### Why deferred

- Chat is not required for the current staging and commerce launch path.
- The supported integration contract for a non-Hydrogen custom storefront must
  be verified against current Shopify documentation before implementation.
- A live channel needs an owner, availability hours, notification routing, and a
  response expectation; an unattended chat would degrade customer experience.
- The widget or integration must be reviewed for consent, personal-data handling,
  accessibility, localization, and storefront performance.
- The choice between staff-managed conversations and Shopify's optional Inbox
  agent needs an explicit product and support decision.

### Acceptance when done

- [ ] Verify the current official Shopify-supported path for Inbox on a custom
      Next.js/headless storefront; if none exists, document that limitation and
      evaluate a headless-compatible alternative.
- [ ] Define the support owner, availability hours, notification recipients,
      expected response time, and off switch.
- [ ] Decide whether conversations are staff-managed or use the Inbox agent;
      review its sources, permissions, safety limits, and escalation behavior.
- [ ] Prototype only on staging and test guest chat, signed-in chat, order lookup,
      staff handoff, email fallback to `care@synarava.com`, and mobile behavior.
- [ ] Validate accessibility, localization, consent/privacy disclosures, data
      retention, Core Web Vitals, bundle/network cost, and visual fit.
- [ ] Document installation, rollback, and operating procedures before enabling
      the production chat.

### Official references

- [Shopify Inbox](https://help.shopify.com/en/manual/inbox)
- [Configure Shopify Inbox](https://help.shopify.com/en/manual/inbox/configure-inbox)
- [Customize chat settings and appearance](https://help.shopify.com/en/manual/inbox/chat-settings-and-appearance/settings)
- [Shopify custom storefronts](https://shopify.dev/docs/storefronts/headless/getting-started)

