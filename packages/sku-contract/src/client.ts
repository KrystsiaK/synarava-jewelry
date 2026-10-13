import {
  catalogAuditRequestSchema,
  catalogAuditResponseSchema,
  confirmAssignmentRequestSchema,
  confirmAssignmentResponseSchema,
  previewRequestSchema,
  previewResponseSchema,
  reserveRequestSchema,
  reserveResponseSchema,
  validateRequestSchema,
  validateResponseSchema,
  type CatalogAuditRequest,
  type CatalogAuditResponse,
  type ConfirmAssignmentRequest,
  type ConfirmAssignmentResponse,
  type PreviewRequest,
  type PreviewResponse,
  type ReserveRequest,
  type ReserveResponse,
  type ValidateRequest,
  type ValidateResponse,
} from "./v1";
import { skuErrorBodySchema, type SkuErrorBody } from "./errors";

export type SkuClientConfig = {
  readonly baseUrl: string;
  readonly serviceToken: string;
  readonly workspaceKey: string;
  readonly fetch?: typeof fetch;
};

export type SkuClientResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SkuErrorBody; readonly status: number };

async function requestJson<T>(
  config: SkuClientConfig,
  path: string,
  init: {
    readonly method: string;
    readonly body?: unknown;
    readonly idempotencyKey?: string;
    readonly schema: { parse(data: unknown): T };
  },
): Promise<SkuClientResult<T>> {
  const fetchImpl = config.fetch ?? fetch;
  const headers: Record<string, string> = {
    authorization: `Bearer ${config.serviceToken}`,
    accept: "application/json",
  };
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (init.idempotencyKey) {
    headers["idempotency-key"] = init.idempotencyKey;
  }

  const response = await fetchImpl(
    `${config.baseUrl.replace(/\/$/, "")}${path}`,
    {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
  );

  const json: unknown = await response.json();
  if (!response.ok) {
    const error = skuErrorBodySchema.safeParse(json);
    return {
      ok: false,
      status: response.status,
      error: error.success
        ? error.data
        : {
            ok: false,
            code: "INVALID_INPUT",
            message: "unexpected error body",
            correlationId: "n/a",
          },
    };
  }

  return { ok: true, value: init.schema.parse(json) };
}

export function createSkuClient(config: SkuClientConfig) {
  const ws = `/v1/workspaces/${encodeURIComponent(config.workspaceKey)}`;

  return {
    preview(body: PreviewRequest) {
      return requestJson(config, `${ws}/skus/preview`, {
        method: "POST",
        body: previewRequestSchema.parse(body),
        schema: previewResponseSchema,
      });
    },
    reserve(body: ReserveRequest, idempotencyKey: string) {
      return requestJson(config, `${ws}/reservations`, {
        method: "POST",
        body: reserveRequestSchema.parse(body),
        idempotencyKey,
        schema: reserveResponseSchema,
      });
    },
    validate(body: ValidateRequest) {
      return requestJson(config, `${ws}/skus/validate`, {
        method: "POST",
        body: validateRequestSchema.parse(body),
        schema: validateResponseSchema,
      });
    },
    auditCatalog(body: CatalogAuditRequest) {
      return requestJson(config, `${ws}/audit/catalog`, {
        method: "POST",
        body: catalogAuditRequestSchema.parse(body),
        schema: catalogAuditResponseSchema,
      });
    },
    confirmAssignment(body: ConfirmAssignmentRequest) {
      return requestJson(config, `${ws}/assignments/confirm`, {
        method: "POST",
        body: confirmAssignmentRequestSchema.parse(body),
        schema: confirmAssignmentResponseSchema,
      });
    },
    async listProfiles() {
      return requestJson(config, `${ws}/profiles`, {
        method: "GET",
        schema: {
          parse(data: unknown) {
            return data as {
              ok: true;
              profiles: Array<{
                version: number;
                status: string;
                config: unknown;
              }>;
            };
          },
        },
      });
    },
    async listAssignments() {
      return requestJson(config, `${ws}/assignments`, {
        method: "GET",
        schema: {
          parse(data: unknown) {
            return data as {
              ok: true;
              assignments: Array<{
                id: string;
                sku: string;
                source: string;
                status: string;
                lockState: string;
                policyVersion: number;
              }>;
            };
          },
        },
      });
    },
    async listAuditEvents() {
      return requestJson(config, `${ws}/audit-events`, {
        method: "GET",
        schema: {
          parse(data: unknown) {
            return data as {
              ok: true;
              events: Array<{
                id: string;
                actor: string;
                action: string;
                correlationId: string;
                createdAt: string;
              }>;
            };
          },
        },
      });
    },
    async saveDraftProfile(body: {
      version: number;
      separator: string;
      suffix: { width: number; start: number; reuse: false };
      families: Record<string, string>;
      allowedCharacters: string;
      correlationId: string;
    }) {
      return requestJson(config, `${ws}/profiles`, {
        method: "POST",
        body,
        schema: {
          parse(data: unknown) {
            return data as {
              ok: true;
              version: number;
              status: string;
              correlationId: string;
            };
          },
        },
      });
    },
    async publishProfile(version: number, correlationId: string) {
      return requestJson(config, `${ws}/profiles/${version}/publish`, {
        method: "POST",
        body: { correlationId },
        schema: {
          parse(data: unknown) {
            return data as {
              ok: true;
              version: number;
              status: string;
              correlationId: string;
            };
          },
        },
      });
    },
  };
}

export type SkuClient = ReturnType<typeof createSkuClient>;

export type {
  CatalogAuditRequest,
  CatalogAuditResponse,
  ConfirmAssignmentRequest,
  ConfirmAssignmentResponse,
  PreviewRequest,
  PreviewResponse,
  ReserveRequest,
  ReserveResponse,
  ValidateRequest,
  ValidateResponse,
};
