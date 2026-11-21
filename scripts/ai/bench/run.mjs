#!/usr/bin/env node
/**
 * TASK-001 provider benchmark (one-off).
 * Usage: node scripts/ai/bench/run.mjs [productId ...]
 *
 * Hard budget: stop when spent ≥ $1.50.
 * Missing keys → "skipped: no key" and continue.
 * Raw texts → .artifacts/ai-bench/ (not git). Report → docs/ai/provider-benchmark.md
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

import { callClaude, pingClaude } from "./adapters/claude.mjs";
import { callGemini, pingGemini } from "./adapters/gemini.mjs";
import { callOpenAI, pingOpenAI } from "./adapters/openai.mjs";
import { countClaimWarnings, schemaValid } from "./claim-guard.mjs";
import { estimateCostUsd, MODEL_PRICES } from "./prices.mjs";
import {
  buildSystemInstruction,
  buildUserPrompt,
  PRODUCT_CONTENT_RESPONSE_SCHEMA,
} from "./schema.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARTIFACTS_DIR = join(ROOT, ".artifacts/ai-bench");
const REPORT_PATH = join(ROOT, "docs/ai/provider-benchmark.md");
const HARD_BUDGET_USD = 1.5;
const TIMEOUT_MS = 45_000;
const LOCALES = ["en", "pt", "ru"];

const MODELS = [
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    envKey: "GEMINI_API_KEY",
    ping: pingGemini,
    call: callGemini,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    envKey: "ANTHROPIC_API_KEY",
    ping: pingClaude,
    call: callClaude,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    envKey: "ANTHROPIC_API_KEY",
    ping: pingClaude,
    call: callClaude,
  },
  {
    id: "gpt-5-nano",
    label: "OpenAI gpt-5-nano (cheapest structured)",
    envKey: "OPENAI_API_KEY",
    ping: pingOpenAI,
    call: callOpenAI,
  },
];

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
      select: { key: true, label: true, textValue: true, unit: true },
      take: 30,
    },
    collections: { select: { collection: { select: { name: true } } }, take: 8 },
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

function toFacts(product) {
  return {
    productId: product.id,
    name: product.name,
    productType: product.productType,
    materialLine: product.materialLine,
    shortDescription: product.shortDescription,
    description: product.description,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    details: product.details,
    characteristics: product.characteristics,
    collections: product.collections.map((c) => c.collection.name),
    translations: product.translations,
  };
}

async function loadProducts(ids) {
  if (ids.length > 0) {
    const rows = [];
    for (const id of ids) {
      const row = await prisma.product.findUnique({ where: { id }, select: productSelect() });
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

function writeReport({ probed, rows, spent, stoppedEarly, products }) {
  mkdirSync(dirname(REPORT_PATH), { recursive: true });
  const now = new Date().toISOString();

  const probeLines = probed
    .map((p) => {
      const price = MODEL_PRICES[p.id];
      return `| ${p.label} | \`${p.id}\` | ${p.availability} | $${price.inputUsdPer1M} / $${price.outputUsdPer1M} | ${price.structuredOutput ? "yes" : "no"} | ${price.priceSource} |`;
    })
    .join("\n");

  const metricLines = rows
    .map((r) => {
      return `| ${r.modelId} | ${r.productId} | ${r.productName.replace(/\|/g, "/")} | ${r.status} | ${r.schemaOk} | ${r.latencyMs ?? ""} | ${r.inputTokens ?? ""} | ${r.outputTokens ?? ""} | ${r.costUsd ?? ""} | ${r.claimWarnings ?? ""} | ${r.error ?? ""} |`;
    })
    .join("\n");

  const scoreHeader =
    "| model | product | factual errors (human) | quality EN (1–5) | quality PT-PT (1–5) | quality RU (1–5) | brand (1–5) | edit minutes |";
  const scoreSep = "|---|---|---|---|---|---|---|---|";
  const scoreRows = rows
    .filter((r) => r.status === "ok")
    .map(
      (r) =>
        `| ${r.modelId} | ${r.productId} |  |  |  |  |  |  |`,
    )
    .join("\n");

  const rawIndex = rows
    .filter((r) => r.artifactPath)
    .map((r) => `- \`${r.artifactPath}\` — ${r.modelId} / ${r.productId}`)
    .join("\n");

  const productList =
    products.map((p) => "`" + p.id + "` (" + p.name + ")").join(", ") || "_none_";

  const md = [
    "# AI product content — provider benchmark",
    "",
    "**Status:** scaffolding + probe (no winner declared)",
    `**Generated:** ${now}`,
    `**Hard budget:** $${HARD_BUDGET_USD.toFixed(2)}`,
    `**Spent this run:** $${spent.toFixed(6)}${stoppedEarly ? " — **stopped early (budget)**" : ""}`,
    `**Products:** ${productList}`,
    "**Locales:** EN, PT-PT, RU",
    "",
    "Production `ContentProvider` remains a **stub** until the architect picks a winner. Bench adapters live only under `scripts/ai/bench/`.",
    "",
    "## Pre-run model card",
    "",
    "| Model | ID | Availability | Price in/out ($/1M) | Structured output | Price source |",
    "|---|---|---|---|---|---|",
    probeLines || "| _none_ | | | | | |",
    "",
    "## Metrics",
    "",
    "| model | productId | name | status | schema ok | latencyMs | tokens in | tokens out | costUsd | claim warnings | error |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    metricLines || "| _no runs_ | | | | | | | | | | |",
    "",
    "## Human score sheet (empty — fill manually)",
    "",
    scoreHeader,
    scoreSep,
    scoreRows || "| _no successful outputs_ | | | | | | | |",
    "",
    "## Side-by-side raw texts",
    "",
    "Raw JSON outputs are written under `.artifacts/ai-bench/` (gitignored), not committed:",
    "",
    rawIndex || "_No raw artifacts (all models skipped or no products)._",
    "",
    "## Notes",
    "",
    "- OpenAI pick: `gpt-5-nano` — cheapest first-party model with structured outputs on [OpenAI pricing](https://developers.openai.com/api/docs/pricing) at capture ($0.05 / $0.40 per 1M).",
    "- Claude: `output_config.format = json_schema`, `effort: \"low\"`, no temperature.",
    "- Gemini: REST `generateContent` + `responseJsonSchema`.",
    "- Same facts / system / user / schema for every model×product cell.",
    "- **Do not treat this file as a winner decision.**",
    "",
  ].join("\n");

  writeFileSync(REPORT_PATH, md, "utf8");
  console.log(`Wrote ${REPORT_PATH}`);
}

async function main() {
  const productIds = process.argv.slice(2);
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const probed = [];
  for (const model of MODELS) {
    const key = process.env[model.envKey]?.trim();
    if (!key) {
      probed.push({
        id: model.id,
        label: model.label,
        availability: "skipped: no key",
      });
      console.log(`${model.id}: skipped: no key`);
      continue;
    }
    const ping = await model.ping({ apiKey: key, model: model.id });
    probed.push({
      id: model.id,
      label: model.label,
      availability: ping.ok ? `available (${ping.message})` : `unavailable: ${ping.message}`,
    });
    console.log(`${model.id}: ${probed.at(-1).availability}`);
  }

  let products = [];
  try {
    products = await loadProducts(productIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`DB read skipped (read-only load failed): ${message.split("\n")[0]}`);
    products = [];
  }

  if (products.length === 0) {
    console.warn("No products available for benchmark (read-only). Writing skip report.");
  }

  let spent = 0;
  let stoppedEarly = false;
  const rows = [];
  const system = buildSystemInstruction();

  for (const product of products) {
    if (stoppedEarly) break;
    const facts = toFacts(product);
    const user = buildUserPrompt(facts);

    for (const model of MODELS) {
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
        });
        continue;
      }

      if (spent >= HARD_BUDGET_USD) {
        stoppedEarly = true;
        break;
      }

      try {
        const result = await model.call({
          system,
          user,
          jsonSchema: PRODUCT_CONTENT_RESPONSE_SCHEMA,
          apiKey: key,
          model: model.id,
          timeoutMs: TIMEOUT_MS,
        });
        const cost = estimateCostUsd(
          model.id,
          result.usage.inputTokens,
          result.usage.outputTokens,
        );
        spent += cost;
        const ok = schemaValid(result.json);
        const warnings = countClaimWarnings(result.json, facts);
        const artifactRel = `.artifacts/ai-bench/${model.id}__${product.id}.json`;
        writeFileSync(
          join(ROOT, artifactRel),
          JSON.stringify(
            {
              model: model.id,
              productId: product.id,
              productName: product.name,
              locales: LOCALES,
              usage: result.usage,
              costUsd: cost,
              json: result.json,
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
          status: "ok",
          schemaOk: ok ? "yes" : "no",
          latencyMs: result.usage.latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: cost,
          claimWarnings: warnings,
          artifactPath: artifactRel,
        });
        if (spent >= HARD_BUDGET_USD) stoppedEarly = true;
      } catch (error) {
        rows.push({
          modelId: model.id,
          productId: product.id,
          productName: product.name,
          status: "error",
          schemaOk: "no",
          error: error instanceof Error ? error.message : String(error),
          artifactPath: "",
        });
      }
    }
  }

  // When no products ran, still record per-model skip rows for the metrics table.
  if (products.length === 0) {
    for (const model of MODELS) {
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

  writeReport({ probed, rows, spent, stoppedEarly, products });
  console.log(`Spent $${spent.toFixed(6)} / $${HARD_BUDGET_USD}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
