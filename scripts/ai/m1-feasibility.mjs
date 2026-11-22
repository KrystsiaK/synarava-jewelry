#!/usr/bin/env node
/**
 * M1 feasibility — one real Gemini call against a representative local product (read-only).
 * Usage: node scripts/ai/m1-feasibility.mjs [productId]
 *
 * Requires GEMINI_API_KEY. If missing, prints "M1 waits for key" and exits 0.
 * Never writes Product / ProductTranslation — optional AuditLog is skipped here.
 */

import { PrismaClient } from "@prisma/client";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const INPUT_USD_PER_1M = 0.25;
const OUTPUT_USD_PER_1M = 1.5;
const TIMEOUT_MS = 30_000;

const apiKey = process.env.GEMINI_API_KEY?.trim();
const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

if (!apiKey) {
  console.log("M1 waits for key");
  console.log("Set GEMINI_API_KEY to run a live feasibility call.");
  process.exit(0);
}

const prisma = new PrismaClient();

function estimateCost(inputTokens, outputTokens) {
  return (
    Math.round(
      ((inputTokens / 1_000_000) * INPUT_USD_PER_1M +
        (outputTokens / 1_000_000) * OUTPUT_USD_PER_1M) *
        1_000_000,
    ) / 1_000_000
  );
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["locales"],
  properties: {
    locales: {
      type: "object",
      additionalProperties: false,
      properties: {
        en: {
          type: "object",
          additionalProperties: false,
          properties: {
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
        pt: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
        ru: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            shortDescription: { type: "string" },
            description: { type: "string" },
            seoTitle: { type: "string" },
            seoDescription: { type: "string" },
          },
        },
      },
    },
  },
};

async function loadProduct(productId) {
  if (productId) {
    return prisma.product.findUnique({
      where: { id: productId },
      select: {
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
          take: 20,
        },
        collections: { select: { collection: { select: { name: true } } }, take: 5 },
        translations: {
          select: {
            locale: true,
            title: true,
            shortDescription: true,
            description: true,
            materialLine: true,
          },
          take: 6,
        },
      },
    });
  }
  return prisma.product.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
    select: {
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
        take: 20,
      },
      collections: { select: { collection: { select: { name: true } } }, take: 5 },
      translations: {
        select: {
          locale: true,
          title: true,
          shortDescription: true,
          description: true,
          materialLine: true,
        },
        take: 6,
      },
    },
  });
}

async function main() {
  const productId = process.argv[2];
  const product = await loadProduct(productId);
  if (!product) {
    console.error("No product found (read-only). Provide a productId or seed catalog.");
    process.exit(1);
  }

  const facts = {
    name: product.name,
    productType: product.productType,
    materialLine: product.materialLine,
    shortDescription: product.shortDescription,
    description: product.description,
    characteristics: product.characteristics,
    collections: product.collections.map((c) => c.collection.name),
    translations: product.translations,
  };

  const systemInstruction = [
    "Synarava jewelry copy. Quiet, ceremonial, precise.",
    "PT = European Portuguese (PT-PT). Never invent materials/claims.",
    "Never generate en.title. Return JSON only.",
  ].join(" ");

  const userPrompt = `Facts:\n${JSON.stringify(facts, null, 2)}\nLocales: en, pt, ru`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  let response;
  let body;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: responseSchema,
          },
        }),
      },
    );
    // Keep abort coverage while the body streams (same window as gemini.ts).
    body = await response.json();
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - started;
  if (!response.ok) {
    console.error("Gemini error:", body?.error?.message ?? response.status);
    process.exit(1);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Schema ok: false (invalid JSON)");
    process.exit(1);
  }

  const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
  const costUsd = estimateCost(inputTokens, outputTokens);

  console.log("productId:", product.id);
  console.log("name:", product.name);
  console.log("model:", model);
  console.log("schema ok: true");
  console.log("latencyMs:", latencyMs);
  console.log("inputTokens:", inputTokens);
  console.log("outputTokens:", outputTokens);
  console.log("costUsd:", costUsd);
  console.log("--- EN ---");
  console.log(JSON.stringify(parsed.locales?.en ?? {}, null, 2));
  console.log("--- PT ---");
  console.log(JSON.stringify(parsed.locales?.pt ?? {}, null, 2));
  console.log("--- RU ---");
  console.log(JSON.stringify(parsed.locales?.ru ?? {}, null, 2));
  if (parsed.locales?.en?.title) {
    console.error("FAIL: en.title must be absent");
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
