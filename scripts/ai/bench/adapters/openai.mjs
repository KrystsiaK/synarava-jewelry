/**
 * Bench-only OpenAI adapter (REST fetch, no SDK).
 * Uses Responses API structured outputs via text.format json_schema.
 */

export async function callOpenAI({ system, user, jsonSchema, apiKey, model, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "product_content",
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });
    const body = await response.json();
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      throw new Error(body?.error?.message || `OpenAI HTTP ${response.status}`);
    }
    const text =
      body.output_text ??
      (body.output ?? [])
        .flatMap((item) => item.content ?? [])
        .filter((part) => part.type === "output_text" || part.type === "text")
        .map((part) => part.text ?? "")
        .join("");
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("OpenAI returned non-JSON text");
    }
    return {
      json,
      usage: {
        model,
        inputTokens: body.usage?.input_tokens ?? body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? body.usage?.completion_tokens ?? 0,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingOpenAI({ apiKey, model, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: "Reply with ok",
        text: {
          format: {
            type: "json_schema",
            name: "ping",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["ok"],
              properties: { ok: { type: "boolean" } },
            },
          },
        },
      }),
    });
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
