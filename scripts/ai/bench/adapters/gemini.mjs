/**
 * Bench-only Gemini 3.1 Flash-Lite adapter (REST fetch, no SDK).
 * Not the production ContentProvider.
 */

export async function callGemini({ system, user, jsonSchema, apiKey, model, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
          },
        }),
      },
    );
    const body = await response.json();
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Gemini HTTP ${response.status}`);
    }
    const text =
      body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Gemini returned non-JSON text");
    }
    return {
      json,
      usage: {
        model,
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingGemini({ apiKey, model, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
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
    const body = await response.json();
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
