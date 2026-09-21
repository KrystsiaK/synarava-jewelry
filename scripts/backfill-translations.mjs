// Translation migration/coverage CLI (Task 19).
//
// Safe defaults:
// - no flag means dry-run;
// - --apply only creates missing Product/Collection/Page translation bindings;
// - conflicting bindings are reported and never overwritten;
// - this script never calls Shopify or modifies translated copy.
import { PrismaClient } from "@prisma/client";
import {
  buildCoverageReport,
  planBindingCreates,
} from "./lib/translation-coverage.mjs";

const prisma = new PrismaClient();

function parseArgs(argv) {
  const known = new Set(["--apply", "--dry-run", "--json", "--strict", "--help"]);
  const unknown = argv.filter((arg) => !known.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(", ")}`);
  if (argv.includes("--apply") && argv.includes("--dry-run")) {
    throw new Error("Choose either --apply or --dry-run, not both.");
  }
  return {
    apply: argv.includes("--apply"),
    json: argv.includes("--json"),
    strict: argv.includes("--strict"),
    help: argv.includes("--help"),
  };
}

function helpText() {
  return `Usage: node scripts/backfill-translations.mjs [options]

Options:
  --dry-run  Read-only coverage report (default)
  --apply    Create missing, non-conflicting Shopify translation bindings
  --json     Print a machine-readable JSON report
  --strict   Exit with code 2 while any enforcement blocker remains
  --help     Show this help

The command never writes translations to Shopify. Conflicting bindings are
reported for manual resolution and are never overwritten.`;
}

const productTranslationSelect = {
  locale: true,
  title: true,
  shortDescription: true,
  description: true,
  materialLine: true,
  symbolismLabel: true,
  symbolismTitle: true,
  symbolismBody: true,
  symbolismBody2: true,
  details: true,
  seoTitle: true,
  seoDescription: true,
  reviewStatus: true,
};

const collectionTranslationSelect = {
  locale: true,
  name: true,
  description: true,
  manifesto: true,
  symbolismLabel: true,
  symbolismTitle: true,
  symbolismBody: true,
  symbolismBody2: true,
  searchSummary: true,
  reviewStatus: true,
};

const pageTranslationSelect = {
  locale: true,
  title: true,
  localizedHandle: true,
  excerpt: true,
  content: true,
  seoTitle: true,
  seoDescription: true,
  reviewStatus: true,
};

async function loadInput() {
  const [products, collections, pages, bindings] = await Promise.all([
    prisma.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        sku: true,
        name: true,
        shopifyProductId: true,
        translations: { where: { locale: "pt" }, select: productTranslationSelect },
      },
      orderBy: [{ sku: "asc" }, { id: "asc" }],
    }),
    prisma.collection.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        name: true,
        shopifyCollectionId: true,
        translations: { where: { locale: "pt" }, select: collectionTranslationSelect },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.page.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        title: true,
        shopifyPageId: true,
        translations: { where: { locale: "pt" }, select: pageTranslationSelect },
      },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }),
    prisma.shopifyTranslationBinding.findMany({
      where: { resourceType: { in: ["PRODUCT", "COLLECTION", "PAGE"] } },
      select: { resourceType: true, entityId: true, shopifyResourceId: true },
    }),
  ]);
  return { products, collections, pages, bindings };
}

function blockers(row) {
  const reasons = [];
  if (!row.hasPt) reasons.push("no PT row");
  if (row.missingFields.length > 0) reasons.push(`missing ${row.missingFields.join(", ")}`);
  if (row.hasPt && !row.reviewed) reasons.push("not reviewed");
  if (row.missingIdentity) reasons.push("missing Shopify identity");
  if (row.bindingStatus === "MISSING") reasons.push("missing translation binding");
  if (row.bindingStatus === "CONFLICT") reasons.push("conflicting translation binding");
  if (row.unsupportedFields.length > 0) {
    reasons.push(`populated but not synced: ${row.unsupportedFields.join(", ")}`);
  }
  return reasons;
}

function printHuman(payload) {
  const { report } = payload;
  console.log(`[translation-backfill] ${payload.mode}; Shopify translation writes: disabled.`);
  if (payload.mode === "apply") {
    console.log(`[translation-backfill] created ${payload.appliedBindings} missing binding(s).`);
  }

  for (const entityType of ["PRODUCT", "COLLECTION", "PAGE"]) {
    const rows = report.rows.filter((row) => row.entityType === entityType);
    const ready = rows.filter((row) => row.enforcementReady).length;
    console.log(`\n${entityType}: ${ready}/${rows.length} enforcement-ready`);
    for (const row of rows) {
      const reasons = blockers(row);
      console.log(`  - [${reasons.length === 0 ? "READY" : "BLOCKED"}] ${row.label}${reasons.length > 0 ? `: ${reasons.join("; ")}` : ""}`);
    }
  }

  const summary = report.summary;
  console.log(`\nSummary: ${summary.enforcementReady}/${summary.total} enforcement-ready; ${summary.translationComplete}/${summary.total} PT-complete.`);
  console.log(`Blockers: missing PT ${summary.missingPt}; missing identity ${summary.missingIdentity}; missing binding ${summary.missingBinding}; binding conflicts ${summary.bindingConflicts}; unsupported populated copy ${summary.unsupported}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(helpText());
    return;
  }

  let input = await loadInput();
  let report = buildCoverageReport(input);
  let appliedBindings = 0;

  if (options.apply) {
    const creates = planBindingCreates(report);
    if (creates.length > 0) {
      const result = await prisma.shopifyTranslationBinding.createMany({
        data: creates,
        skipDuplicates: true,
      });
      appliedBindings = result.count;
      input = await loadInput();
      report = buildCoverageReport(input);
    }
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: options.apply ? "apply" : "dry-run",
    appliedBindings,
    deferredResourceTypes: [],
    managedOnEntitySync: [
      {
        resourceType: "METAOBJECT",
        reason: "App-owned editorial metaobjects are created idempotently by each entity sync, then tracked by their own binding and event.",
      },
    ],
    report,
  };

  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else printHuman(payload);

  if (options.strict && !report.readyForEnforcement) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
