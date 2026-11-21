import {
  getGeminiApiKey,
  getGeminiModel,
  GEMINI_TIMEOUT_MS,
} from "@/lib/ai/config";
import type { ContentProvider } from "@/lib/ai/product-content/provider";

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiResponseBody = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: GeminiUsageMetadata;
  error?: { message?: string; code?: number; status?: string };
};

function extractText(body: GeminiResponseBody): string | null {
  const parts = body.candidates?.[0]?.content?.parts;
  if (!parts?.length) return null;
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
}

/**
 * Gemini REST ContentProvider (generateContent, no SDK).
 * Matches `ContentProvider` exactly — returns `{ json, usage }` and throws on
 * transport / HTTP / timeout failures. Cost is computed outside via `config.estimateCostUsd`.
 *
 * NOT wired into production `getContentProvider()` — production stays on the stub
 * until the architect picks a benchmark winner. Bench adapters live under
 * `scripts/ai/bench/`. Never logs the API key or request body.
 */
export const geminiContentProvider: ContentProvider = async (input) => {
  const model = getGeminiModel();
  const started = Date.now();
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const timeoutMs = input.timeoutMs > 0 ? input.timeoutMs : GEMINI_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: input.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.user }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
          responseJsonSchema: input.jsonSchema,
        },
      }),
    });

    const latencyMs = Date.now() - started;
    let body: GeminiResponseBody;
    try {
      body = (await response.json()) as GeminiResponseBody;
    } catch {
      throw new Error("Provider returned non-JSON body");
    }

    if (!response.ok) {
      const providerMessage =
        typeof body.error?.message === "string" && body.error.message.trim()
          ? body.error.message.trim()
          : `Gemini HTTP ${response.status}`;
      throw new Error(providerMessage);
    }

    const text = extractText(body);
    if (!text) {
      throw new Error("Gemini response missing text candidates");
    }

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      // Still return usage so generate can AuditLog invalid_output.
      json = text;
    }

    const inputTokens = Math.max(0, body.usageMetadata?.promptTokenCount ?? 0);
    const outputTokens = Math.max(0, body.usageMetadata?.candidatesTokenCount ?? 0);

    return {
      json,
      usage: {
        model,
        inputTokens,
        outputTokens,
        latencyMs,
      },
    };
  } catch (error) {
    const aborted =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    if (aborted) {
      const err = new Error(`Gemini request timed out after ${timeoutMs}ms`);
      err.name = "AbortError";
      throw err;
    }
    throw error instanceof Error ? error : new Error("Gemini request failed");
  } finally {
    clearTimeout(timeoutId);
  }
};
