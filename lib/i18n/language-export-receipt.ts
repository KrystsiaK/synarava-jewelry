import "server-only";

import { db } from "@/lib/db";

/** Fresh export receipt required before delete (same admin session window). */
export const LANGUAGE_EXPORT_RECEIPT_TTL_MS = 60 * 60 * 1000;

export type LanguageExportReceipt = {
  checksum: string;
  exportedAt: string;
};

export function languageExportReceiptKey(locale: string): string {
  return `language-export-receipt:${locale.trim().toLowerCase()}`;
}

function parseReceipt(value: unknown): LanguageExportReceipt | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const checksum = typeof record.checksum === "string" ? record.checksum.trim() : "";
  const exportedAt = typeof record.exportedAt === "string" ? record.exportedAt.trim() : "";
  if (!checksum || !exportedAt) return null;
  const parsedAt = Date.parse(exportedAt);
  if (Number.isNaN(parsedAt)) return null;
  return { checksum, exportedAt };
}

/** Persist server-side export receipt used to authorize later delete. */
export async function recordLanguageExportReceipt(
  locale: string,
  checksum: string,
  exportedAt: Date = new Date(),
): Promise<void> {
  const code = locale.trim().toLowerCase();
  const trimmedChecksum = checksum.trim();
  if (!code || !trimmedChecksum) return;

  const value: LanguageExportReceipt = {
    checksum: trimmedChecksum,
    exportedAt: exportedAt.toISOString(),
  };
  const key = languageExportReceiptKey(code);
  await db.siteSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export type LanguageExportReceiptCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Require a SiteSetting receipt for this locale with a matching checksum
 * not older than {@link LANGUAGE_EXPORT_RECEIPT_TTL_MS}.
 */
export async function verifyLanguageExportReceipt(
  locale: string,
  exportChecksum: string,
  now: Date = new Date(),
): Promise<LanguageExportReceiptCheck> {
  const code = locale.trim().toLowerCase();
  const provided = exportChecksum.trim();
  if (!provided) {
    return { error: "Export the language bundle in this session before deleting data.", ok: false };
  }

  const setting = await db.siteSetting.findUnique({
    where: { key: languageExportReceiptKey(code) },
  });
  const receipt = parseReceipt(setting?.value);
  if (!receipt) {
    return {
      ok: false,
      error: "No recent server-side export receipt for this language. Export the bundle again, then retry delete.",
    };
  }

  if (receipt.checksum !== provided) {
    return {
      ok: false,
      error: "Export checksum does not match the server-side receipt. Export the bundle again, then retry delete.",
    };
  }

  const ageMs = now.getTime() - Date.parse(receipt.exportedAt);
  if (ageMs < 0 || ageMs > LANGUAGE_EXPORT_RECEIPT_TTL_MS) {
    return {
      ok: false,
      error: "Export receipt expired (valid for 60 minutes). Export the bundle again, then retry delete.",
    };
  }

  return { ok: true };
}

/** Clear the receipt after a successful delete (best-effort). */
export async function clearLanguageExportReceipt(locale: string): Promise<void> {
  const key = languageExportReceiptKey(locale);
  await db.siteSetting.deleteMany({ where: { key } });
}
