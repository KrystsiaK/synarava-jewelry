import {
  catalogAuditRequestSchema,
  confirmAssignmentRequestSchema,
  previewRequestSchema,
  reserveRequestSchema,
  validateRequestSchema,
  workspaceKeySchema,
} from "@synarava/sku-contract";
import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE, type PolicyProfileConfig } from "@synarava/sku-core";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { runCatalogAudit } from "../audit/catalog-audit.js";
import { createAllocator } from "../allocator.js";
import {
  authenticateRequest,
  type WorkspaceCredential,
} from "../auth.js";
import { isDomainError } from "../registry/errors.js";
import type { SkuRegistryStore } from "../registry/types.js";

export type SkuHttpApp = {
  readonly store: SkuRegistryStore;
  readonly credentials: readonly WorkspaceCredential[];
  readonly ready: () => boolean;
  /** Persistence mode — surfaced on /health for ops. */
  readonly mode?: "postgres" | "memory";
};

const draftProfileSchema = z.object({
  version: z.number().int().positive(),
  separator: z.string().min(1).max(4),
  suffix: z.object({
    width: z.number().int().min(1).max(8),
    start: z.number().int().min(0),
    reuse: z.literal(false),
  }),
  families: z.record(z.string(), z.string().min(1)),
  allowedCharacters: z.string().min(1),
  correlationId: z.string().min(8).max(128),
});

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function errorBody(
  code: string,
  message: string,
  correlationId: string,
  policyVersion?: number,
) {
  return {
    ok: false as const,
    code,
    message,
    correlationId,
    ...(policyVersion === undefined ? {} : { policyVersion }),
  };
}

export function createSkuHttpServer(app: SkuHttpApp) {
  const allocator = createAllocator(app.store);

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://sku.local");
      const method = req.method ?? "GET";

      if (method === "GET" && url.pathname === "/health") {
        const ready = app.ready();
        return sendJson(res, ready ? 200 : 503, {
          ok: ready,
          service: "@synarava/sku-api",
          ready,
          store: app.mode ?? "memory",
        });
      }

      const workspaceMatch = /^\/v1\/workspaces\/([^/]+)(\/.*)?$/.exec(
        url.pathname,
      );
      if (!workspaceMatch) {
        return sendJson(res, 404, errorBody("INVALID_INPUT", "not found", "n/a"));
      }

      const workspaceKey = workspaceKeySchema.parse(
        decodeURIComponent(workspaceMatch[1]!),
      );
      const rest = workspaceMatch[2] ?? "";

      const auth = authenticateRequest({
        authorizationHeader: req.headers.authorization,
        pathWorkspaceKey: workspaceKey,
        credentials: app.credentials,
      });
      if (!auth.ok) {
        return sendJson(
          res,
          auth.status,
          errorBody("UNAUTHORIZED", auth.message, "n/a"),
        );
      }

      await app.store.ensureWorkspace(workspaceKey);

      if (method === "GET" && rest === "/profiles") {
        const profiles = await app.store.listProfiles(workspaceKey);
        return sendJson(res, 200, {
          ok: true,
          profiles: profiles.map((p) => ({
            version: p.version,
            status: p.status.toLowerCase(),
            config: p.config,
          })),
        });
      }

      if (method === "POST" && rest === "/profiles") {
        const body = draftProfileSchema.parse(await readJson(req));
        const config: PolicyProfileConfig = {
          workspace: workspaceKey,
          version: body.version,
          separator: body.separator,
          suffix: body.suffix,
          families: body.families,
          allowedCharacters: body.allowedCharacters,
        };
        const draft = await app.store.saveDraftProfile(workspaceKey, config);
        return sendJson(res, 200, {
          ok: true,
          version: draft.version,
          status: "draft",
          correlationId: body.correlationId,
        });
      }

      const publishMatch = /^\/profiles\/(\d+)\/publish$/.exec(rest);
      if (method === "POST" && publishMatch) {
        const version = Number(publishMatch[1]);
        const body = z
          .object({ correlationId: z.string().min(8) })
          .parse(await readJson(req));
        const published = await app.store.publishProfileVersion(
          workspaceKey,
          version,
        );
        return sendJson(res, 200, {
          ok: true,
          version: published.version,
          status: "published",
          correlationId: body.correlationId,
        });
      }

      if (method === "POST" && rest === "/skus/preview") {
        const body = previewRequestSchema.parse(await readJson(req));
        const result = await allocator.preview(workspaceKey, body.familyKey);
        if (!result.ok) {
          return sendJson(
            res,
            400,
            errorBody(result.code, result.message, body.correlationId),
          );
        }
        return sendJson(res, 200, {
          ok: true,
          ...result.value,
          correlationId: body.correlationId,
        });
      }

      if (method === "POST" && rest === "/reservations") {
        const body = reserveRequestSchema.parse(await readJson(req));
        const idempotencyKey = req.headers["idempotency-key"];
        if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
          return sendJson(
            res,
            400,
            errorBody(
              "INVALID_INPUT",
              "Idempotency-Key header required",
              body.correlationId,
            ),
          );
        }
        const result = await allocator.reserve({
          workspaceKey,
          familyKey: body.familyKey,
          idempotencyKey,
          correlationId: body.correlationId,
          actor: "http",
        });
        if (!result.ok) {
          return sendJson(
            res,
            400,
            errorBody(result.code, result.message, body.correlationId),
          );
        }
        return sendJson(res, 200, {
          ok: true,
          reservationId: result.value.id,
          sku: result.value.sku,
          stem: result.value.stem,
          sequence: result.value.sequence,
          policyVersion: result.value.policyVersion,
          familyKey: result.value.familyKey,
          status: "pending",
          correlationId: body.correlationId,
        });
      }

      if (method === "POST" && rest === "/skus/validate") {
        const body = validateRequestSchema.parse(await readJson(req));
        try {
          const result = await app.store.validateSku(workspaceKey, body.sku);
          return sendJson(res, 200, {
            ok: true,
            sku: result.sku,
            validFormat: result.validFormat,
            assigned: result.assigned,
            reservationStatus: result.reservationStatus
              ? result.reservationStatus.toLowerCase()
              : null,
            policyVersion: result.policyVersion,
            correlationId: body.correlationId,
          });
        } catch (error) {
          if (isDomainError(error)) {
            return sendJson(
              res,
              400,
              errorBody(error.code, error.message, body.correlationId),
            );
          }
          throw error;
        }
      }

      if (method === "POST" && rest === "/audit/catalog") {
        const body = catalogAuditRequestSchema.parse(await readJson(req));
        try {
          const result = await runCatalogAudit({
            store: app.store,
            workspaceKey,
            items: body.items,
            previousDigest: body.previousDigest ?? null,
            correlationId: body.correlationId,
          });
          return sendJson(res, 200, result);
        } catch (error) {
          if (isDomainError(error)) {
            return sendJson(
              res,
              400,
              errorBody(error.code, error.message, body.correlationId),
            );
          }
          throw error;
        }
      }

      if (method === "POST" && rest === "/assignments/confirm") {
        const body = confirmAssignmentRequestSchema.parse(await readJson(req));
        try {
          const assignment = await app.store.confirmAssignment({
            workspaceKey,
            ...body,
            actor: "http",
          });
          return sendJson(res, 200, {
            ok: true,
            assignmentId: assignment.id,
            sku: assignment.sku,
            policyVersion: assignment.policyVersion,
            status: "active",
            correlationId: body.correlationId,
          });
        } catch (error) {
          if (isDomainError(error)) {
            return sendJson(
              res,
              400,
              errorBody(error.code, error.message, body.correlationId),
            );
          }
          throw error;
        }
      }

      const lockMatch = /^\/assignments\/([^/]+)\/lock$/.exec(rest);
      if (method === "POST" && lockMatch) {
        const body = z
          .object({
            lockState: z.enum(["publication_locked", "order_locked"]),
            correlationId: z.string().min(8),
          })
          .parse(await readJson(req));
        const lockState =
          body.lockState === "order_locked"
            ? "ORDER_LOCKED"
            : "PUBLICATION_LOCKED";
        try {
          const assignment = await app.store.lockAssignment(
            workspaceKey,
            decodeURIComponent(lockMatch[1]!),
            lockState,
            body.correlationId,
            "http",
          );
          return sendJson(res, 200, {
            ok: true,
            assignmentId: assignment.id,
            lockState: assignment.lockState.toLowerCase(),
            correlationId: body.correlationId,
          });
        } catch (error) {
          if (isDomainError(error)) {
            return sendJson(
              res,
              400,
              errorBody(error.code, error.message, body.correlationId),
            );
          }
          throw error;
        }
      }

      if (method === "GET" && rest === "/assignments") {
        const assignments = await app.store.listAssignments(workspaceKey);
        return sendJson(res, 200, {
          ok: true,
          assignments: assignments.map((a) => ({
            id: a.id,
            sku: a.sku,
            source: a.source.toLowerCase(),
            status: a.status.toLowerCase(),
            lockState: a.lockState.toLowerCase(),
            policyVersion: a.policyVersion,
            externalSystem: a.externalSystem,
            externalVariantId: a.externalVariantId,
          })),
        });
      }

      if (method === "GET" && rest === "/audit-events") {
        const events = await app.store.listAuditEvents(workspaceKey);
        return sendJson(res, 200, {
          ok: true,
          events: events.map((e) => ({
            id: e.id,
            actor: e.actor,
            action: e.action,
            correlationId: e.correlationId,
            after: e.after,
            createdAt: e.createdAt.toISOString(),
          })),
        });
      }

      return sendJson(res, 404, errorBody("INVALID_INPUT", "not found", "n/a"));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendJson(
          res,
          400,
          errorBody("INVALID_INPUT", error.issues[0]?.message ?? "invalid", "n/a"),
        );
      }
      if (isDomainError(error)) {
        return sendJson(
          res,
          400,
          errorBody(error.code, error.message, "n/a"),
        );
      }
      console.error("[sku-api]", error);
      return sendJson(
        res,
        500,
        errorBody("INVALID_INPUT", "internal error", "n/a"),
      );
    }
  });
}

/** Seed helper for local/dev: ensure example published profile exists. */
export async function seedExampleWorkspace(store: SkuRegistryStore) {
  await store.ensureWorkspace(SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.workspace);
  const published = await store.getPublishedProfile(
    SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.workspace,
  );
  if (!published) {
    await store.publishProfile(
      SYNARAVA_SHOP_PROFILE_V1_EXAMPLE.workspace,
      SYNARAVA_SHOP_PROFILE_V1_EXAMPLE,
    );
  }
}
