/**
 * Minimal provider adapter — no platform coupling.
 * Production will wire ONE benchmark-winner implementation later.
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

  constructor(message = "AI content provider not selected yet (awaiting benchmark winner)") {
    super(message);
    this.name = "ContentProviderNotConfiguredError";
  }
}

/**
 * Temporary stub — do not pick a production model until the architect names a winner.
 * Benchmark adapters live under `scripts/ai/bench/`, not here.
 */
export const stubContentProvider: ContentProvider = async () => {
  throw new ContentProviderNotConfiguredError();
};

let providerOverride: ContentProvider | null = null;

/** Test-only injection. Pass null to restore the stub. */
export function setContentProviderForTests(provider: ContentProvider | null): void {
  providerOverride = provider;
}

export function getContentProvider(): ContentProvider {
  return providerOverride ?? stubContentProvider;
}
