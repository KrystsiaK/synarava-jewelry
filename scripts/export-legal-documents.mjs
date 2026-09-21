// Read-only safety export for the Legal Document pages (Privacy, Public
// Offer Agreement, Terms & Conditions, Legal Notice) and their AuditLog
// history. Writes a timestamped JSON snapshot to legal-document-backups/ —
// nothing in the database is modified. Meant to be run against production
// (with DATABASE_URL pointed at it) before any migration or deploy that
// touches Legal Document rendering/persistence.
//
// Usage: DATABASE_URL=<production-url> node scripts/export-legal-documents.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const LEGAL_DOCUMENT_SLUGS = ["privacy", "offer", "terms-and-conditions", "legal-notice"];

const prisma = new PrismaClient();

async function main() {
  const pages = await prisma.page.findMany({
    where: { slug: { in: LEGAL_DOCUMENT_SLUGS } },
    include: { translations: true },
  });

  const pageIds = pages.map((page) => page.id);
  const auditLog = pageIds.length
    ? await prisma.auditLog.findMany({
        where: { entityType: "PAGE", entityId: { in: pageIds } },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const snapshot = {
    exportedAt: new Date().toISOString(),
    slugsRequested: LEGAL_DOCUMENT_SLUGS,
    pages,
    auditLog,
  };

  const dir = "legal-document-backups";
  await mkdir(dir, { recursive: true });
  const path = `${dir}/legal-documents-${snapshot.exportedAt.replace(/[:.]/g, "-")}.json`;
  await writeFile(path, JSON.stringify(snapshot, null, 2));

  console.log(`[export] ${pages.length} page row(s), ${auditLog.length} audit log row(s) -> ${path}`);
  for (const slug of LEGAL_DOCUMENT_SLUGS) {
    const page = pages.find((p) => p.slug === slug);
    console.log(page ? `  ${slug}: found (id=${page.id}, status=${page.status})` : `  ${slug}: NOT FOUND`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
