/**
 * M4 evaluate — READ-ONLY production generate path (dryRun skips AuditLog).
 * Writes docs/ai/m4-results.md with metrics + empty owner score columns.
 *
 * Usage (via launcher): node scripts/ai/m4-evaluate.mjs [productId ...]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateProductContent } from "@/lib/ai/product-content/generate";
import type { AiLocale } from "@/lib/ai/product-content/contract";
import { db } from "@/lib/db";

const LOCALES: AiLocale[] = ["en", "pt", "ru"];
const ACTOR = { username: "m4-evaluate", sessionId: "m4-evaluate-dry-run" };
const RESULTS_PATH = join(process.cwd(), "docs/ai/m4-results.md");
const DEFAULT_LIMIT = 10;

type Row = {
  productId: string;
  name: string;
  ok: boolean;
  code: string;
  latencyMs: string;
  inputTokens: string;
  outputTokens: string;
  costUsd: string;
  warnings: string;
  failure: string;
};

function esc(cell: string): string {
  return cell.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

async function resolveProductIds(argvIds: string[]): Promise<Array<{ id: string; name: string }>> {
  if (argvIds.length > 0) {
    const rows = await db.product.findMany({
      where: { id: { in: argvIds } },
      select: { id: true, name: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return argvIds.flatMap((id) => {
      const row = byId.get(id);
      return row ? [{ id: row.id, name: row.name }] : [];
    });
  }

  const rows = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: DEFAULT_LIMIT,
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

function renderMarkdown(input: {
  generatedAt: string;
  productSource: string;
  rows: Row[];
  totals: { ok: number; fail: number; costUsd: number; latencyMs: number };
}): string {
  const lines: string[] = [
    "# AI content — M4 evaluate results",
    "",
    "**Status:** machine metrics filled; owner score columns empty",
    `**Generated:** ${input.generatedAt}`,
    `**Products:** ${input.productSource}`,
    `**Path:** production \`generateProductContent\` with \`dryRun: true\` (no AuditLog write)`,
    `**Locales:** ${LOCALES.join(", ")}`,
    "",
    "## Machine metrics",
    "",
    "| productId | name | ok | code | latencyMs | tokens in | tokens out | costUsd | warnings | failure | manual time (min) | AI+verify time (min) | real errors | edits | quality EN (1–5) | quality PT (1–5) | quality RU (1–5) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const row of input.rows) {
    lines.push(
      `| ${esc(row.productId)} | ${esc(row.name)} | ${row.ok ? "yes" : "no"} | ${esc(row.code)} | ${esc(row.latencyMs)} | ${esc(row.inputTokens)} | ${esc(row.outputTokens)} | ${esc(row.costUsd)} | ${esc(row.warnings)} | ${esc(row.failure)} |  |  |  |  |  |  |  |`,
    );
  }

  if (input.rows.length === 0) {
    lines.push("| _none_ | | | | | | | | | | | | | | | | |");
  }

  lines.push(
    "",
    "## Totals",
    "",
    `| ok | fail | sum costUsd | sum latencyMs |`,
    `| --- | --- | --- | --- |`,
    `| ${input.totals.ok} | ${input.totals.fail} | ${input.totals.costUsd.toFixed(6)} | ${input.totals.latencyMs} |`,
    "",
    "## Owner notes",
    "",
    "- Fill empty columns above after reviewing each draft in admin (or side-by-side).",
    "- Do not treat this file as a merge gate; it is an evaluation worksheet.",
    "",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const argvIds = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const products = await resolveProductIds(argvIds);
  const productSource =
    argvIds.length > 0
      ? `argv (${argvIds.length} requested, ${products.length} found)`
      : `${products.length} latest ACTIVE`;

  const rows: Row[] = [];
  let okCount = 0;
  let failCount = 0;
  let costSum = 0;
  let latencySum = 0;

  for (const product of products) {
    const result = await generateProductContent({
      productId: product.id,
      locales: LOCALES,
      actor: ACTOR,
      dryRun: true,
    });

    if (result.ok) {
      okCount += 1;
      const usage = result.draft.usage;
      costSum += usage.costUsd;
      latencySum += usage.latencyMs;
      rows.push({
        productId: product.id,
        name: product.name,
        ok: true,
        code: "ok",
        latencyMs: String(usage.latencyMs),
        inputTokens: String(usage.inputTokens),
        outputTokens: String(usage.outputTokens),
        costUsd: usage.costUsd.toFixed(6),
        warnings: result.draft.warnings.map((w) => `${w.locale}.${w.field}:${w.message}`).join("; ") || "—",
        failure: "—",
      });
      continue;
    }

    failCount += 1;
    rows.push({
      productId: product.id,
      name: product.name,
      ok: false,
      code: result.code,
      latencyMs: "—",
      inputTokens: "—",
      outputTokens: "—",
      costUsd: "—",
      warnings: "—",
      failure: result.message,
    });
  }

  const markdown = renderMarkdown({
    generatedAt: new Date().toISOString(),
    productSource,
    rows,
    totals: { ok: okCount, fail: failCount, costUsd: costSum, latencyMs: latencySum },
  });

  writeFileSync(RESULTS_PATH, markdown, "utf8");
  console.log(`Wrote ${RESULTS_PATH} (${okCount} ok / ${failCount} fail)`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect().catch(() => undefined);
  });
