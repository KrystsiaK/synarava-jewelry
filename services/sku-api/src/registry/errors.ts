import { fail, type PolicyProfileConfig, type SkuResult } from "@synarava/sku-core";

export class DomainError extends Error {
  readonly code: string;

  constructor(result: Extract<SkuResult<never>, { ok: false }>) {
    super(result.message);
    this.name = "DomainError";
    this.code = result.code;
  }
}

export function domainError(
  result: Extract<SkuResult<never>, { ok: false }>,
): DomainError {
  return new DomainError(result);
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function assertProfileConfig(
  workspaceKey: string,
  config: PolicyProfileConfig,
): void {
  if (config.workspace !== workspaceKey) {
    throw domainError(
      fail("INVALID_INPUT", "profile.workspace must match workspace key"),
    );
  }
  if (config.suffix.reuse !== false) {
    throw domainError(fail("INVALID_INPUT", "suffix.reuse must be false"));
  }
}
