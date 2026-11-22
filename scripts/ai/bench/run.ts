/**
 * Provider benchmark (Stage B tooling; kept after Stage C).
 * Usage:
 *   node scripts/ai/bench/run.mjs [productId ...] [--fixtures] [--repeat N] [--models gemini] [--budget 0.20] [--editor]
 *
 * Hard budget default $1.50 (override with --budget).
 * `--editor` runs a second polish pass (same as AI_EDITOR_PASS) and reports pass 1/2 metrics.
 * Missing keys → "skipped: no key". Raw → .artifacts/ai-bench/. Report → docs/ai/provider-benchmark.md
 * Criterion: 0 invented materials/sizes/claims (claim warnings).
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { estimateCostUsd, MODEL_PRICE_TABLE } from "@/lib/ai/config";
import type { AiLocale } from "@/lib/ai/product-content/contract";
import {
  buildProductContentFacts,
  type ProductForFacts,
} from "@/lib/ai/product-content/facts";
import {
  buildEditorSystemInstruction,
  buildEditorUserPrompt,
  buildSystemInstruction,
  buildUserPrompt,
} from "@/lib/ai/product-content/prompt";
import { PRODUCT_CONTENT_RESPONSE_SCHEMA } from "@/lib/ai/product-content/schema";
import { validateAndNormalizeDraftLocales } from "@/lib/ai/product-content/validate";

import { callClaude, pingClaude } from "./adapters/claude";
import { callGemini, pingGemini } from "./adapters/gemini";
import { callOpenAI, pingOpenAI } from "./adapters/openai";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARTIFACTS_DIR = join(ROOT, ".artifacts/ai-bench");
const FIXTURES_DIR = join(ROOT, "scripts/ai/bench/fixtures");
const REPORT_PATH = join(ROOT, "docs/ai/provider-benchmark.md");
const DEFAULT_HARD_BUDGET_USD = 1.5;
const TIMEOUT_MS = 45_000;
const LOCALES: AiLocale[] = ["en", "pt", "ru"];

type BenchCall = (input: {
  system: string;
  user: string;
  jsonSchema: object;
  apiKey: string;
  model: string;
  timeoutMs: number;
}) => Promise<{
  json: unknown;
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
}>;

type BenchPing = (input: {
  apiKey: string;
  model: string;
}) => Promise<{ ok: boolean; message: string }>;

const ALL_MODELS: Array<{
  id: string;
  label: string;
  envKey: string;
  alias: string;
  ping: BenchPing;
  call: BenchCall;
}> = [
  {
    id: "gemini-3.1-flash-lite",
    alias: "gemini",
    label: MODEL_PRICE_TABLE["gemini-3.1-flash-lite"]!.label,
    envKey: "GEMINI_API_KEY",
    ping: pingGemini,
    call: callGemini,
  },
  {
    id: "claude-haiku-5-5",
    alias: "claude-haiku",
    label: MODEL_PRICE_TABLE["claude-haiku-5-5"]!.label,
    envKey: "ANTHROPIC_API_KEY",
    ping: pingClaude,
    call: callClaude,
  },
  {
    id: "claude-sonnet-5-5",
    alias: "claude-sonnet",
    label: MODEL_PRICE_TABLE["claude-sonnet-5-5"]!.label,
    envKey: "ANTHROPIC_API_KEY",
    ping: pingClaude,
    call: callClaude,
  },
  {
    id: "gpt-5-nano",
    alias: "openai",
    label: MODEL_PRICE_TABLE["gpt-5-nano"]!.label,
    envKey: "OPENAI_API_KEY",
    ping: pingOpenAI,
    call: callOpenAI,
  },
];

type CliOpts = {
  productIds: string[];
  fixtures: boolean;
  repeat: number;
  models: string[];
  budget: number;
  editor: boolean;
};

function parseArgs(argv: string[]): CliOpts {
  const productIds: string[] = [];
  let fixtures = false;
  let repeat = 1;
  let models: string[] = ALL_MODELS.map((m) => m.id);
  let budget = DEFAULT_HARD_BUDGET_USD;
  let editor = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--fixtures") {
      fixtures = true;
      continue;
    }
    if (arg === "--editor") {
      editor = true;
      continue;
    }
    if (arg === "--repeat") {
      const n = Number(argv[++i]);
      repeat = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
      continue;
    }
    if (arg.startsWith("--repeat=")) {
      const n = Number(arg.slice("--repeat=".length));
      repeat = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
      continue;
    }
    if (arg === "--models") {
      const raw = argv[++i] ?? "";
      models = raw.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (arg.startsWith("--models=")) {
      models = arg
        .slice("--models=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--budget") {
      const n = Number(argv[++i]);
      budget = Number.isFinite(n) && n > 0 ? n : DEFAULT_HARD_BUDGET_USD;
      continue;
    }
    if (arg.startsWith("--budget=")) {
      const n = Number(arg.slice("--budget=".length));
      budget = Number.isFinite(n) && n > 0 ? n : DEFAULT_HARD_BUDGET_USD;
      continue;
    }
    if (arg.startsWith("-")) {
      console.warn(`Unknown flag ignored: ${arg}`);
      continue;
    }
    productIds.push(arg);
  }

  return { productIds, fixtures, repeat, models, budget, editor };
}

function selectModels(requested: string[]) {
  const wanted = new Set(requested.map((r) => r.toLowerCase()));
  return ALL_MODELS.filter(
    (m) =>
      wanted.has(m.id.toLowerCase()) ||
      wanted.has(m.alias.toLowerCase()) ||
      (wanted.has("gemini") && m.id.startsWith("gemini")),
  );
}

const prisma = new PrismaClient();

function productSelect() {
  return {
    id: true,
    name: true,
    productType: true,
    materialLine: true,
    shortDescription: true,
    description: true,
    seoTitle: true,
    seoDescription: true,
    details: true,
    characteristics: {
      select: {
        key: true,
        label: true,
        textValue: true,
        numberValue: true,
        booleanValue: true,
        unit: true,
      },
      take: 30,
      orderBy: { sortOrder: "asc" as const },
    },
    collections: {
      select: { collection: { select: { name: true } } },
      take: 8,
    },
    translations: {
      select: {
        locale: true,
        title: true,
        shortDescription: true,
        description: true,
        materialLine: true,
        seoTitle: true,
        seoDescription: true,
      },
      take: 6,
    },
  };
}

function loadFixtures(): ProductForFacts[] {
  const files = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((file) => {
    const raw = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")) as ProductForFacts;
    return raw;
  });
}

async function loadDbProducts(ids: string[]): Promise<ProductForFacts[]> {
  if (ids.length > 0) {
    const rows: ProductForFacts[] = [];
    for (const id of ids) {
      const row = await prisma.product.findUnique({
        where: { id },
        select: productSelect(),
      });
      if (row) rows.push(row);
      else console.warn(`Product not found (skipped): ${id}`);
    }
    return rows;
  }
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: productSelect(),
  });
}

type PassMetrics = {
  latencyMs: number;
  costUsd: number;
  clicheWarnings: number;
  warningCount: number;
  claimWarnings: number;
};

type MetricRow = {
  modelId: string;
  productId: string;
  productName: string;
  status: string;
  schemaOk: string;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  claimWarnings?: number;
  clicheWarnings?: number;
  warningCount?: number;
  pass1?: PassMetrics;
  pass2?: PassMetrics | { status: string };
  error?: string;
  artifactPath: string;
  repeat?: number;
};

function countWarnings(
  warnings: Array<{ message: string }> | null | undefined,
): { claim: number; cliche: number; total: number } {
  const list = warnings ?? [];
  return {
    total: list.length,
    claim: list.filter((w) => /invented claim|unsupported number/i.test(w.message)).length,
    cliche: list.filter((w) => /cliché/i.test(w.message)).length,
  };
}

function writeReport(input: {
  probed: Array<{ id: string; label: string; availability: string }>;
  rows: MetricRow[];
  spent: number;
  stoppedEarly: boolean;
  products: ProductForFacts[];
  budget: number;
  models: string[];
  repeat: number;
  editor: boolean;
}): void {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const now = new Date().toISOString();

  const probeLines = input.probed
    .map((p) => {
      const price = MODEL_PRICE_TABLE[p.id];
      if (!price) {
        return `| ${p.label} | \`${p.id}\` | ${p.availability} |  |  |  |`;
      }
      return `| ${p.label} | \`${p.id}\` | ${p.availability} | $${price.inputUsdPer1M} / $${price.outputUsdPer1M} | ${price.structuredOutput ? "yes" : "no"} | ${price.priceSource} |`;
    })
    .join("\n");

  const metricLines = input.rows
    .map((r) => {
      const p1 = r.pass1
        ? `${r.pass1.latencyMs}ms / $${r.pass1.costUsd} / cliché ${r.pass1.clicheWarnings} / warn ${r.pass1.warningCount}`
        : "";
      const p2 =
        r.pass2 && "latencyMs" in r.pass2
          ? `${r.pass2.latencyMs}ms / $${r.pass2.costUsd} / cliché ${r.pass2.clicheWarnings} / warn ${r.pass2.warningCount}`
          : r.pass2 && "status" in r.pass2
            ? r.pass2.status
            : "";
      return `| ${r.modelId} | ${r.productId} | ${r.productName.replace(/\|/g, "/")} | ${r.status} | ${r.schemaOk} | ${r.latencyMs ?? ""} | ${r.inputTokens ?? ""} | ${r.outputTokens ?? ""} | ${r.costUsd ?? ""} | ${r.claimWarnings ?? ""} | ${r.clicheWarnings ?? ""} | ${r.warningCount ?? ""} | ${p1} | ${p2} | ${r.error ?? ""} |`;
    })
    .join("\n");

  const invented = input.rows.filter(
    (r) => typeof r.claimWarnings === "number" && r.claimWarnings > 0,
  ).length;

  const productList =
    input.products.map((p) => "`" + p.id + "` (" + p.name + ")").join(", ") || "_none_";

  const md = [
    "# AI product content — provider benchmark",
    "",
    "**Status:** Stage C — production winner Gemini 3.1 Flash-Lite; bench remains for regression",
    `**Generated:** ${now}`,
    `**Hard budget:** $${input.budget.toFixed(2)}`,
    `**Spent this run:** $${input.spent.toFixed(6)}${input.stoppedEarly ? " — **stopped early (budget)**" : ""}`,
    `**Models:** ${input.models.join(", ")}`,
    `**Repeat:** ${input.repeat}`,
    `**Editor pass:** ${input.editor ? "on (--editor)" : "off"}`,
    `**Products:** ${productList}`,
    "**Locales:** EN, PT-PT, RU",
    `**Invented-claim cells (claim warnings > 0):** ${invented} (criterion: 0)`,
    "",
    "Production `ContentProvider` = Gemini (`AI_CONTENT_MODEL`). Bench adapters under `scripts/ai/bench/`.",
    "Prompt / schema / validate / price table: reused from `lib/ai/**`.",
    "",
    "## Pre-run model card",
    "",
    "| Model | ID | Availability | Price in/out ($/1M) | Structured output | Price source |",
    "|---|---|---|---|---|---|",
    probeLines || "| _none_ | | | | | |",
    "",
    "## Metrics",
    "",
    "| model | productId | name | status | schema ok | latencyMs | tokens in | tokens out | costUsd | claim warnings | cliché | warnings | pass1 (lat/$/cliché/warn) | pass2 | error |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    metricLines || "| _no runs_ | | | | | | | | | | | | | | |",
    "",
    "## Notes",
    "",
    "- Criterion: **0 invented materials/sizes/claims** (claim warnings column).",
    "- Claude: `output_config.format = json_schema`, `effort: \"low\"`, no temperature.",
    "- Gemini: REST `generateContent` + `responseJsonSchema` + `maxOutputTokens`.",
    "- Fixtures: `scripts/ai/bench/fixtures/` (no DB writes).",
    "- `--editor`: second polish call; pass1/pass2 columns show latency, $, cliché and warning counts.",
    "",
  ].join("\n");

  writeFileSync(REPORT_PATH, md, "utf8");
  console.log(`Wrote ${REPORT_PATH}`);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const models = selectModels(opts.models);
  if (models.length === 0) {
    console.error(`No models matched: ${opts.models.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const probed: Array<{ id: string; label: string; availability: string }> = [];
  for (const model of models) {
    const key = process.env[model.envKey]?.trim();
    if (!key) {
      probed.push({ id: model.id, label: model.label, availability: "skipped: no key" });
      console.log(`${model.id}: skipped: no key`);
      continue;
    }
    const ping = await model.ping({ apiKey: key, model: model.id });
    probed.push({
      id: model.id,
      label: model.label,
      availability: ping.ok ? `available (${ping.message})` : `unavailable: ${ping.message}`,
    });
    console.log(`${model.id}: ${probed.at(-1)!.availability}`);
  }

  let products: ProductForFacts[] = [];
  try {
    if (opts.productIds.length > 0 || !opts.fixtures) {
      products = await loadDbProducts(opts.productIds);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`DB read skipped: ${message.split("\n")[0]}`);
    products = [];
  }

  if (opts.fixtures) {
    products = [...products, ...loadFixtures()];
  }

  if (products.length === 0) {
    console.warn("No products/fixtures available. Writing skip report.");
  }

  let spent = 0;
  let stoppedEarly = false;
  const rows: MetricRow[] = [];
  const system = buildSystemInstruction(LOCALES);

  for (let rep = 1; rep <= opts.repeat; rep += 1) {
    for (const product of products) {
      if (stoppedEarly) break;
      const facts = buildProductContentFacts(product);
      const user = buildUserPrompt(facts, LOCALES);

      for (const model of models) {
        if (stoppedEarly) break;
        const key = process.env[model.envKey]?.trim();
        if (!key) {
          rows.push({
            modelId: model.id,
            productId: product.id,
            productName: product.name,
            status: "skipped: no key",
            schemaOk: "",
            artifactPath: "",
            repeat: rep,
          });
          continue;
        }

        const probe = probed.find((p) => p.id === model.id);
        if (probe && probe.availability.startsWith("unavailable")) {
          rows.push({
            modelId: model.id,
            productId: product.id,
            productName: product.name,
            status: "skipped: unavailable",
            schemaOk: "",
            error: probe.availability,
            artifactPath: "",
            repeat: rep,
          });
          continue;
        }

        if (spent >= opts.budget) {
          stoppedEarly = true;
          break;
        }

        try {
          const result = await model.call({
            system,
            user,
            jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as object,
            apiKey: key,
            model: model.id,
            timeoutMs: TIMEOUT_MS,
          });
          const cost1 = estimateCostUsd(
            model.id,
            result.usage.inputTokens,
            result.usage.outputTokens,
          );
          spent += cost1;
          const validated1 = validateAndNormalizeDraftLocales(result.json, facts, LOCALES);
          const w1 = countWarnings(validated1?.warnings);
          const pass1: PassMetrics = {
            latencyMs: result.usage.latencyMs,
            costUsd: cost1,
            clicheWarnings: w1.cliche,
            warningCount: w1.total,
            claimWarnings: w1.claim,
          };

          let finalJson: unknown = result.json;
          let finalValidated = validated1;
          let pass2: MetricRow["pass2"];
          let inputTokens = result.usage.inputTokens;
          let outputTokens = result.usage.outputTokens;
          let latencyMs = result.usage.latencyMs;
          let cost = cost1;
          let status = "ok";

          if (opts.editor && validated1) {
            if (spent >= opts.budget) {
              stoppedEarly = true;
              pass2 = { status: "skipped: budget" };
            } else {
              try {
                const editorResult = await model.call({
                  system: buildEditorSystemInstruction(LOCALES),
                  user: buildEditorUserPrompt(facts, validated1.locales, LOCALES),
                  jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA as unknown as object,
                  apiKey: key,
                  model: model.id,
                  timeoutMs: TIMEOUT_MS,
                });
                const cost2 = estimateCostUsd(
                  model.id,
                  editorResult.usage.inputTokens,
                  editorResult.usage.outputTokens,
                );
                spent += cost2;
                inputTokens += editorResult.usage.inputTokens;
                outputTokens += editorResult.usage.outputTokens;
                latencyMs += editorResult.usage.latencyMs;
                cost += cost2;
                const validated2 = validateAndNormalizeDraftLocales(
                  editorResult.json,
                  facts,
                  LOCALES,
                );
                if (!validated2) {
                  pass2 = {
                    latencyMs: editorResult.usage.latencyMs,
                    costUsd: cost2,
                    clicheWarnings: 0,
                    warningCount: 0,
                    claimWarnings: 0,
                  };
                  status = "ok (editor skipped)";
                } else {
                  const w2 = countWarnings(validated2.warnings);
                  pass2 = {
                    latencyMs: editorResult.usage.latencyMs,
                    costUsd: cost2,
                    clicheWarnings: w2.cliche,
                    warningCount: w2.total,
                    claimWarnings: w2.claim,
                  };
                  finalJson = editorResult.json;
                  finalValidated = validated2;
                }
              } catch (editorError) {
                pass2 = {
                  status: `editor skipped: ${
                    editorError instanceof Error ? editorError.message : String(editorError)
                  }`,
                };
                status = "ok (editor skipped)";
              }
            }
          }

          const finalW = countWarnings(finalValidated?.warnings);
          const artifactRel = `.artifacts/ai-bench/${model.id}__${product.id}__r${rep}.json`;
          writeFileSync(
            join(ROOT, artifactRel),
            JSON.stringify(
              {
                model: model.id,
                productId: product.id,
                productName: product.name,
                repeat: rep,
                editor: opts.editor,
                locales: LOCALES,
                usage: { inputTokens, outputTokens, latencyMs },
                costUsd: cost,
                pass1,
                pass2: pass2 ?? null,
                json: finalJson,
                warnings: finalValidated?.warnings ?? null,
              },
              null,
              2,
            ),
            "utf8",
          );
          rows.push({
            modelId: model.id,
            productId: product.id,
            productName: product.name,
            status,
            schemaOk: finalValidated ? "yes" : "no",
            latencyMs,
            inputTokens,
            outputTokens,
            costUsd: cost,
            claimWarnings: finalW.claim,
            clicheWarnings: finalW.cliche,
            warningCount: finalW.total,
            pass1,
            pass2,
            artifactPath: artifactRel,
            repeat: rep,
          });
          if (spent >= opts.budget) stoppedEarly = true;
        } catch (error) {
          rows.push({
            modelId: model.id,
            productId: product.id,
            productName: product.name,
            status: "error",
            schemaOk: "no",
            error: error instanceof Error ? error.message : String(error),
            artifactPath: "",
            repeat: rep,
          });
        }
      }
    }
  }

  if (products.length === 0) {
    for (const model of models) {
      const key = process.env[model.envKey]?.trim();
      rows.push({
        modelId: model.id,
        productId: "(none)",
        productName: "(no products)",
        status: key ? "skipped: no products" : "skipped: no key",
        schemaOk: "",
        artifactPath: "",
      });
    }
  }

  writeReport({
    probed,
    rows,
    spent,
    stoppedEarly,
    products,
    budget: opts.budget,
    models: models.map((m) => m.id),
    repeat: opts.repeat,
    editor: opts.editor,
  });
  console.log(`Spent $${spent.toFixed(6)} / $${opts.budget}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
