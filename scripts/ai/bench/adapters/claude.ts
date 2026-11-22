/**
 * Bench-only Claude adapter (REST fetch, no SDK).
 * Uses output_config.format = json_schema, effort "low", no temperature.
 */

const ANTHROPIC_VERSION = "2023-06-01";

export async function callClaude(input: {
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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        max_tokens: 4096,
        system: input.system,
        messages: [{ role: "user", content: input.user }],
        output_config: {
          effort: "low",
          format: {
            type: "json_schema",
            schema: input.jsonSchema,
          },
        },
      }),
    });
    const body = (await response.json()) as {
      error?: { message?: string };
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const latencyMs = Date.now() - started;
    if (!response.ok) {
      throw new Error(body?.error?.message || `Claude HTTP ${response.status}`);
    }
    const text = (body.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error("Claude returned non-JSON text");
    }
    return {
      json,
      usage: {
        model: input.model,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
        latencyMs,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingClaude(input: {
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; message: string }> {
  const timeoutMs = input.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        max_tokens: 64,
        messages: [{ role: "user", content: "Reply with ok" }],
        output_config: { effort: "low" },
      }),
    });
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
