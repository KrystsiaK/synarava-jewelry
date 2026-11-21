/**
 * Bench-only Claude adapter (REST fetch, no SDK).
 * Uses output_config.format = json_schema, effort "low", no temperature.
 */

const ANTHROPIC_VERSION = "2023-06-01";

export async function callClaude({ system, user, jsonSchema, apiKey, model, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: jsonSchema,
          },
        },
      }),
    });
    const body = await response.json();
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Claude HTTP ${response.status}`);
    }
    const text = (body.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("Claude returned non-JSON text");
    }
    return {
      json,
      usage: {
        model,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingClaude({ apiKey, model, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 64,
        messages: [{ role: "user", content: "Reply with ok" }],
        output_config: { effort: "low" },
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
