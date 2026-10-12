# Tech debt register

Единый реестр осознанно отложенной работы (бывшие `docs/tech-debt.md` + `docs/admin/tech-debt.md` + незакрытые хвосты завершённых планов из [`history/`](history/)).

**Правила**
- Одна строка в таблице = один пункт; ID не переиспользуются. Префиксы: `ADM` админка/CMS, `SYNC` Shopify sync, `I18N` локализация, `CX` витрина/покупатель, `QA` тесты/CI.
- Подробный разбор нужен, только если пункт не помещается в строку — тогда отдельный раздел ниже.
- Закрыл пункт → удали строку в том же PR. Если закрытие — долговременное решение, заведи ADR.
- Новая идея, а не долг → [`proposals/`](proposals/).

| ID | Что | Почему отложено / блокер | Источник |
|---|---|---|---|
| TD-ADM-01 | Compare-at price: правовые правила + путь редактирования из Synarava | Нет утверждённой политики reference-price (EU) | [ниже](#td-adm-01--compare-at-price-legal-rules--synarava-edit-path) |
| TD-ADM-02 | Удаление последнего фото из галереи оставляет товар опубликованным без картинки (`PROD-C43`) | Нужно продуктовое решение «баг или так задумано» до автотеста | [admin test cases](testing/admin-test-cases-manual-ru.md) |
| TD-ADM-03 | Option name/value labels и media alt/caption не редактируются в админке (поэтому и не переводятся) | Нет EN-редактора; поля уже есть в registry | [EN/PT tasks](history/2026-09-en-pt-translation-tasks.md) |
| TD-SYNC-01 | Live Shopify round trip для catalog conflicts (этап 7) и для каждого типа ресурса/локали | Нужен dev store с write-доступом | [catalog conflicts](history/2026-09-catalog-conflict-resolution.md), [EN/PT tasks](history/2026-09-en-pt-translation-tasks.md) |
| TD-SYNC-02 | Scoped-apply не покрывает Status, visibility, category, tags, collections, media, multi-variant, characteristics (только сравнение) | Резолв через Push/Pull редактора; поля по одному | [catalog-conflict UX](wiki/catalog-conflict-resolution-ux.md), [commerce-sync](wiki/commerce-sync.md#known-gaps-next-branches) |
| TD-SYNC-03 | Полный 3-way merge с явной base (B/L/R) | Следующая ветка после freeze | [commerce-sync](wiki/commerce-sync.md#known-gaps-next-branches) |
| TD-SYNC-04 | Reconciliation: richer audit payload (before/after), restore, disabled scopes с remediation, виртуализация больших списков, структурные логи/метрики | Не нужно до роста объёма | [reconciliation](history/2026-09-shopify-sync-reconciliation.md) |
| TD-SYNC-05 | Reconciliation a11y (reduced motion, focus restore, live regions, 44px) + usability-тест с нетехническим оператором | Перед production enablement | [reconciliation](history/2026-09-shopify-sync-reconciliation.md) |
| TD-I18N-01 | RU copy не введён/не вычитан; `pnpm translations:backfill --dry-run --strict` не чист | Контент, не код | [universal localization](history/2026-09-universal-localization.md) |
| TD-I18N-02 | Тест-интеграции `saveProductAction`/`saveCollectionAction` для транзакции переводов | Нужны моки `$transaction` | [EN/PT tasks](history/2026-09-en-pt-translation-tasks.md) |
| TD-CX-01 | Shopify Inbox на headless-витрине | Нет подтверждённого пути + нет владельца канала | [ниже](#td-cx-01--evaluate-shopify-inbox-for-the-headless-storefront) |
| TD-CX-02 | Customer session: rotation ID при refresh (Task 5, часть 2) и управление устройствами (Task 8). Hash ID уже сделан (`hashCustomerSessionId`) | P2, defense in depth | [customer session](history/2026-09-customer-session-and-cart.md) |
| TD-CX-03 | Глубокий каталог: `CATALOG_CANDIDATE_CAP = 1000` + сортировка в памяти, нет keyset | До роста каталога не критично | [proposal](proposals/catalog-server-pagination.md) |
| TD-CX-04 | `MovementStory` на About: нет poster для фонового видео (`components/about/about-page.tsx`) + ручная проверка reduced motion / play-pause в реальном браузере | Нужно подготовить кадр-poster; хвост REV-26 | [app review REV-26](history/2026-09-app-review.md) |
| TD-QA-01 | Coverage-политика для auth/content/commerce в CI (thresholds не действуют при `test:run`) | E2E smoke в CI уже есть | [app review REV-36](history/2026-09-app-review.md) |

---

## TD-ADM-01 — Compare-at price: legal rules + Synarava edit path

**Status:** open (2026-09-25)\
**Area:** Product editor → Price tab · `compareAt` / Shopify `compareAtPrice`\
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
   Shopify-wins only until TD-ADM-01 closes.
5. **Unit price** (related, separate) — Shopify Unit price / `unitPriceMeasurement`
   remains deferred on the Price tab.

### Acceptance when done

- [ ] Written policy (or link to counsel note) for compare-at on Synarava storefronts
- [ ] Admin UX matches that policy (read-only vs editable + validation)
- [ ] Pull/push and conflict-apply paths documented and tested against the decision
- [ ] This entry removed from the register (decision recorded as ADR if durable)

### Code pointers

- UI: `components/admin/products/product-price-fields.tsx` (`AdminReadonlyField` for compare-at and cost)
- Save preserves DB compare-at and cost (ignores FormData): `app/admin/actions/products.ts`
- Sync: `lib/shopify/product-sync.ts` (pull/push still round-trip the projection)
- Conflict apply: `lib/shopify/commerce-field-apply.ts` (“Compare-at price”)
- Library control: `AdminReadonlyField` in synarava-cms

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
