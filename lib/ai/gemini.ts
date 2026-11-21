import {
  estimateCostUsd,
  getGeminiApiKey,
  getGeminiModel,
  GEMINI_TIMEOUT_MS,
} from "@/lib/ai/config";

export type GeminiStructuredResult =
  | {
      ok: true;
      text: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      latencyMs: number;
    }
  | {
      ok: false;
      code: "timeout" | "provider_error" | "invalid_output" | "disabled";
      message: string;
      latencyMs: number;
      model: string;
    };

export type GeminiGenerateParams = {
  systemInstruction: string;
  userPrompt: string;
  responseJsonSchema: Record<string, unknown>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

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
 * Low-level Gemini REST helper (generateContent, no SDK).
 * NOT the production ContentProvider — production uses the stub in
 * `lib/ai/product-content/provider.ts` until the benchmark winner is chosen.
 * Bench adapters live under `scripts/ai/bench/`.
 * Never logs the API key or request body.
 */
export async function generateStructuredJson(
  params: GeminiGenerateParams,
): Promise<GeminiStructuredResult> {
  const model = getGeminiModel();
  const started = Date.now();
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      code: "disabled",
      message: "GEMINI_API_KEY is not configured",
      latencyMs: Date.now() - started,
      model,
    };
  }

  const timeoutMs = params.timeoutMs ?? GEMINI_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  params.signal?.addEventListener("abort", onExternalAbort);

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
          parts: [{ text: params.systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: params.userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
          responseJsonSchema: params.responseJsonSchema,
        },
      }),
    });

    const latencyMs = Date.now() - started;
    let body: GeminiResponseBody;
    try {
      body = (await response.json()) as GeminiResponseBody;
    } catch {
      return {
        ok: false,
        code: "invalid_output",
        message: "Provider returned non-JSON body",
        latencyMs,
        model,
      };
    }

    if (!response.ok) {
      const providerMessage =
        typeof body.error?.message === "string" && body.error.message.trim()
          ? body.error.message.trim()
          : `Gemini HTTP ${response.status}`;
      return {
        ok: false,
        code: "provider_error",
        message: providerMessage,
        latencyMs,
        model,
      };
    }

    const text = extractText(body);
    if (!text) {
      return {
        ok: false,
        code: "invalid_output",
        message: "Gemini response missing text candidates",
        latencyMs,
        model,
      };
    }

    const inputTokens = Math.max(0, body.usageMetadata?.promptTokenCount ?? 0);
    const outputTokens = Math.max(0, body.usageMetadata?.candidatesTokenCount ?? 0);

    return {
      ok: true,
      text,
      model,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(inputTokens, outputTokens),
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const aborted =
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    if (aborted) {
      return {
        ok: false,
        code: "timeout",
        message: `Gemini request timed out after ${timeoutMs}ms`,
        latencyMs,
        model,
      };
    }
    return {
      ok: false,
      code: "provider_error",
      message: error instanceof Error ? error.message : "Gemini request failed",
      latencyMs,
      model,
    };
  } finally {
    clearTimeout(timeoutId);
    params.signal?.removeEventListener("abort", onExternalAbort);
  }
}
