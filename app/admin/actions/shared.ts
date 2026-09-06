import { getCurrentAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "@/lib/content/revalidate-storefront";

export type AdminAuditEntityType = "PRODUCT" | "COLLECTION" | "PAGE" | "CATEGORY" | "TAG";

export type AdminRecordHistoryItem = {
  id: string;
  action: string;
  createdAt: Date;
};

export type AdminRecordHistoryState = {
  error?: string;
  success?: string;
  history?: AdminRecordHistoryItem[];
};

export type DraftAutosaveResult = {
  recordId?: string;
};

export function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function revalidateStorefront() {
  revalidateStorefrontPath("/");
  revalidateStorefrontPath("/shop");
  revalidateStorefrontPath("/collections");
  revalidateStorefrontTemplate("/collections/[slug]");
  revalidateStorefrontTemplate("/products/[slug]");
  revalidateStorefrontPath("/about");
}

function toAuditJson(value: unknown) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function snapshotString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

export function snapshotNullableString(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" ? value : null;
}

export function snapshotNumber(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function createDraftToken(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function hasMeaningfulDraftInput(formData: FormData, ignoredNames: string[] = []) {
  const ignored = new Set(ignoredNames);

  for (const [key, value] of formData.entries()) {
    if (ignored.has(key)) continue;

    if (value instanceof File) {
      if (value.size > 0) return true;
      continue;
    }

    if (String(value).trim()) return true;
  }

  return false;
}

export async function writeAuditLog(input: {
  action: string;
  entityType: AdminAuditEntityType;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}) {
  const adminSession = await getCurrentAdminSession();
  await db.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: toAuditJson(input.before),
      after: toAuditJson(input.after),
      metadata: toAuditJson(input.metadata),
      adminSessionId: adminSession?.sessionId ?? null,
      adminUsername: adminSession?.username ?? null,
    },
  });
}
