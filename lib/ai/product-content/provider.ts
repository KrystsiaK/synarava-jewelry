/**
 * Minimal provider adapter — no platform coupling.
 * Production wires Gemini 3.1 Flash-Lite (AI_CONTENT_MODEL) via lazy import
 * to avoid a circular dependency with `lib/ai/gemini.ts`.
 * Bench adapters stay under `scripts/ai/bench/`.
 */
export type ContentProvider = (input: {
  system: string;
  user: string;
  jsonSchema: object;
  timeoutMs: number;
}) => Promise<{
  json: unknown;
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number };
}>;

export class ContentProviderNotConfiguredError extends Error {
  readonly code = "not_configured" as const;

  constructor(message = "AI content provider is not configured (missing GEMINI_API_KEY)") {
    super(message);
    this.name = "ContentProviderNotConfiguredError";
  }
}

let providerOverride: ContentProvider | null = null;

/** Test-only injection. Pass null to restore the production Gemini provider. */
export function setContentProviderForTests(provider: ContentProvider | null): void {
  providerOverride = provider;
}

const productionGeminiProvider: ContentProvider = async (input) => {
  const { geminiContentProvider } = await import("@/lib/ai/gemini");
  return geminiContentProvider(input);
};

export function getContentProvider(): ContentProvider {
  return providerOverride ?? productionGeminiProvider;
}
