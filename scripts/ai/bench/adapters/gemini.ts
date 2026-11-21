/**
 * Bench-only Gemini 3.1 Flash-Lite adapter (REST fetch, no SDK).
 * Not the production ContentProvider.
 */

export async function callGemini(input: {
  system: string;
  user: string;
  jsonSchema: object;
  apiKey: string;
  model: string;
  timeoutMs: number;
}): Promise<{
  json: unknown;
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": input.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.user }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: input.jsonSchema,
          },
        }),
      },
    );
    const body = (await response.json()) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Gemini HTTP ${response.status}`);
    }
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Gemini returned non-JSON text");
    }
    return {
      json,
      usage: {
        model: input.model,
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingGemini(input: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; message: string }> {
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": input.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: 'Reply with JSON {"ok":true}' }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: { ok: { type: "boolean" } },
              required: ["ok"],
            },
          },
        }),
      },
    );
    const body = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) {
      return { ok: false, message: body?.error?.message || `HTTP ${response.status}` };
    }
    return { ok: true, message: "available" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
