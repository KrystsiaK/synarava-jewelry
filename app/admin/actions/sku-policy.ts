"use server";

import { randomUUID } from "node:crypto";
import { tryCreateSkuClient } from "@/lib/sku/client";
import { getSkuServiceConfig } from "@/lib/sku/config";

export type SkuPolicyEditorPayload = {
  configured: boolean;
  reason?: string;
  workspaceKey: string;
  profiles: Array<{
    version: number;
    status: string;
    familiesJson: string;
    separator: string;
    suffixWidth: number;
    allowedCharacters: string;
  }>;
  assignments: Array<{
    id: string;
    sku: string;
    source: string;
    status: string;
    lockState: string;
    policyVersion: number;
  }>;
  auditEvents: Array<{
    id: string;
    actor: string;
    action: string;
    correlationId: string;
    createdAt: string;
  }>;
};

export type SkuPolicyActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export async function loadSkuPolicyEditorPayload(): Promise<SkuPolicyEditorPayload> {
  const config = getSkuServiceConfig();
  if (!config.configured) {
    return {
      configured: false,
      reason: config.reason,
      workspaceKey: "synarava-shop",
      profiles: [],
      assignments: [],
      auditEvents: [],
    };
  }

  const client = tryCreateSkuClient();
  if (!client) {
    return {
      configured: false,
      reason: "SKU client unavailable",
      workspaceKey: config.workspaceKey,
      profiles: [],
      assignments: [],
      auditEvents: [],
    };
  }

  const [profilesResult, assignmentsResult, auditResult] = await Promise.all([
    client.listProfiles(),
    client.listAssignments(),
    client.listAuditEvents(),
  ]);

  if (!profilesResult.ok) {
    return {
      configured: true,
      reason: profilesResult.error.message,
      workspaceKey: config.workspaceKey,
      profiles: [],
      assignments: [],
      auditEvents: [],
    };
  }

  return {
    configured: true,
    workspaceKey: config.workspaceKey,
    profiles: profilesResult.value.profiles.map((profile) => {
      const configObj = profile.config as {
        families?: Record<string, string>;
        separator?: string;
        suffix?: { width?: number };
        allowedCharacters?: string;
      };
      return {
        version: profile.version,
        status: profile.status,
        familiesJson: JSON.stringify(configObj.families ?? {}, null, 2),
        separator: configObj.separator ?? "-",
        suffixWidth: configObj.suffix?.width ?? 3,
        allowedCharacters: configObj.allowedCharacters ?? "",
      };
    }),
    assignments: assignmentsResult.ok ? assignmentsResult.value.assignments : [],
    auditEvents: auditResult.ok ? auditResult.value.events.slice(-50).reverse() : [],
  };
}

export async function saveSkuPolicyDraftAction(input: {
  version: number;
  separator: string;
  suffixWidth: number;
  allowedCharacters: string;
  familiesJson: string;
}): Promise<SkuPolicyActionState> {
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  let families: Record<string, string>;
  try {
    families = JSON.parse(input.familiesJson) as Record<string, string>;
  } catch {
    return { ok: false, error: "Families must be valid JSON object" };
  }

  const result = await client.saveDraftProfile({
    version: input.version,
    separator: input.separator,
    suffix: { width: input.suffixWidth, start: 1, reuse: false },
    families,
    allowedCharacters: input.allowedCharacters,
    correlationId: `admin-draft-${randomUUID()}`,
  });

  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, message: `Draft profile v${result.value.version} saved` };
}

export async function publishSkuPolicyAction(
  version: number,
): Promise<SkuPolicyActionState> {
  const client = tryCreateSkuClient();
  if (!client) {
    return { ok: false, error: "SKU API is not configured on this environment" };
  }

  const result = await client.publishProfile(
    version,
    `admin-publish-${randomUUID()}`,
  );
  if (!result.ok) {
    return { ok: false, error: result.error.message };
  }
  return { ok: true, message: `Profile v${result.value.version} published` };
}
