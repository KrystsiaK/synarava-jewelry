# Translation migration and coverage

The translation migration command inventories active Products and Collections,
checks Portuguese completeness, validates Shopify identities/bindings, and
reports locally populated fields that do not yet have a live Shopify adapter.

It is deliberately conservative:

- dry-run is the default;
- it never writes translated content to Shopify;
- `--apply` only creates missing, non-conflicting
  `ShopifyTranslationBinding` rows;
- an existing binding that points to another Shopify resource is reported as
  a conflict and is never overwritten;
- Page and structured Metaobject targets remain visible as deferred resource
  types until Tasks 14/16 provide their persistence and adapters.

## Commands

Human-readable dry run:

```bash
pnpm translations:backfill --dry-run
```

Machine-readable report:

```bash
pnpm translations:backfill --dry-run --json
```

Use the report as an enforcement gate. Exit code `2` means at least one active
record is not ready:

```bash
pnpm translations:backfill --dry-run --json --strict
```

Create only missing safe bindings, then regenerate the report from the
database:

```bash
pnpm translations:backfill --apply
```

Running `--apply` repeatedly is safe. After the first successful run, existing
matching bindings are classified as `BOUND` and the create plan is empty.

## Report semantics

A record is `translationComplete` when all currently required PT fields are
filled and the PT copy is reviewed. A record is `enforcementReady` only when it
is also linked to the expected Shopify resource and has no populated field
whose Shopify adapter is still deferred.

The JSON payload is versioned with `schemaVersion`. Its main sections are:

- `mode` and `appliedBindings` — what this invocation did;
- `deferredResourceTypes` — platform work that prevents a false claim of full
  coverage;
- `report.rows` — field gaps, identity/binding state, and unsupported populated
  fields per entity;
- `report.summary` and `report.readyForEnforcement` — aggregate gate state.

## Safe staging procedure

1. Run `--dry-run --json` and retain the output as the before-report.
2. Resolve every `CONFLICT` manually. Never use `--apply` as a force-rebind.
3. Verify missing Shopify identities in the existing catalog reconciliation
   flow.
4. Run `--apply` once to create safe missing bindings.
5. Run the same `--apply` command again. It must report zero created bindings.
6. Run `--dry-run --json --strict`; review all remaining translation/content
   blockers before enabling a publication gate.

## Shopify contract

Shopify requires a current digest from `translatableResource` for each value
registered through `translationsRegister`. Only locales returned by
`shopLocales` are valid. This migration command does not bypass that contract
or make Translation API writes; the runtime adapters remain responsible for
digest-aware synchronization.

- [Manage translated content](https://shopify.dev/docs/apps/build/markets/manage-translated-content)
- [translatableResource](https://shopify.dev/docs/api/admin-graphql/latest/queries/translatableResource)
- [translationsRegister](https://shopify.dev/docs/api/admin-graphql/latest/mutations/translationsRegister)
- [shopLocales](https://shopify.dev/docs/api/admin-graphql/latest/queries/shopLocales)
