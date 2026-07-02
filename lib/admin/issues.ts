import { promises as fs } from "node:fs";
import path from "node:path";

import { Prisma } from "@prisma/client";

import {
  fallbackProductLookbook,
  fallbackProductMaterials,
  fallbackProductProcess,
  parseProductDetails,
} from "@/lib/content/catalog";
import { db } from "@/lib/db";

type IssueDraft = {
  entityType: string;
  entityId: string;
  entityLabel: string;
  fieldPath: string;
  issueType: string;
  severity?: "ERROR" | "WARNING";
  title: string;
  description: string;
  targetHref: string;
  metadata?: Record<string, unknown>;
};

type MediaCheck = {
  entityType: string;
  entityId: string;
  entityLabel: string;
  fieldPath: string;
  label: string;
  url: string | null | undefined;
  targetHref: string;
};

function issueKey(issue: Pick<IssueDraft, "entityType" | "entityId" | "fieldPath" | "issueType">) {
  return [issue.entityType, issue.entityId, issue.fieldPath, issue.issueType].join(":");
}

function publicFilePath(url: string) {
  const pathname = url.split("?")[0]?.split("#")[0] ?? url;
  return path.join(process.cwd(), "public", pathname.replace(/^\/+/, ""));
}

async function localImageExists(url: string) {
  if (!url.startsWith("/")) return null;
  try {
    const stat = await fs.stat(publicFilePath(url));
    return stat.isFile();
  } catch {
    return false;
  }
}

async function remoteImageExists(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    if (head.ok) return true;
    if (head.status !== 405 && head.status !== 403) return false;
  } catch {
    // Some image hosts reject HEAD. Fall back to a tiny GET below.
  } finally {
    clearTimeout(timeout);
  }

  const getController = new AbortController();
  const getTimeout = setTimeout(() => getController.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: getController.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(getTimeout);
  }
}

async function imageExists(url: string) {
  if (!url.trim()) return false;
  if (url.startsWith("data:")) return true;
  const local = await localImageExists(url);
  if (local !== null) return local;
  if (!/^https?:\/\//i.test(url)) return false;
  return remoteImageExists(url);
}

function brokenMediaIssue(check: MediaCheck): IssueDraft {
  return {
    entityType: check.entityType,
    entityId: check.entityId,
    entityLabel: check.entityLabel,
    fieldPath: check.fieldPath,
    issueType: "BROKEN_MEDIA",
    severity: "ERROR",
    title: `${check.label} image is broken`,
    description: `The image URL does not load: ${check.url}`,
    targetHref: check.targetHref,
    metadata: { url: check.url, label: check.label },
  };
}

function missingTaxonomyIssue(input: {
  productId: string;
  productName: string;
  fieldPath: string;
  label: string;
  description: string;
}): IssueDraft {
  return {
    entityType: "PRODUCT",
    entityId: input.productId,
    entityLabel: input.productName,
    fieldPath: input.fieldPath,
    issueType: "MISSING_TAXONOMY",
    severity: "WARNING",
    title: `Missing ${input.label}`,
    description: input.description,
    targetHref: `/admin/products/${input.productId}#${input.fieldPath}`,
  };
}

async function sendIssueEmail(issues: IssueDraft[]) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_ISSUE_EMAIL_TO ?? process.env.ADMIN_EMAIL;
  const from = process.env.ADMIN_ISSUE_EMAIL_FROM ?? "Synarava Admin <onboarding@resend.dev>";

  if (!apiKey || !to || issues.length === 0) {
    console.warn(
      "[admin-issues] Email notification skipped. Set RESEND_API_KEY and ADMIN_ISSUE_EMAIL_TO.",
    );
    return false;
  }

  const lines = issues.map((issue) => `- ${issue.title}: ${issue.targetHref}`).join("\n");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `[Synarava admin] ${issues.length} open problem${issues.length === 1 ? "" : "s"}`,
        text: `New admin problems were detected:\n\n${lines}`,
      }),
    });

    if (!response.ok) {
      console.warn("[admin-issues] Email notification failed.", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[admin-issues] Email notification failed.", error);
    return false;
  }
}

export async function scanAdminIssues() {
  const [products, collections] = await Promise.all([
    db.product.findMany({
      include: {
        category: true,
        tags: { include: { tag: true } },
        collections: { include: { collection: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.collection.findMany({
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const issues: IssueDraft[] = [];
  const mediaChecks: MediaCheck[] = [];

  for (const product of products) {
    if (product.status !== "ARCHIVED") {
      if (!product.category) {
        issues.push(
          missingTaxonomyIssue({
            productId: product.id,
            productName: product.name,
            fieldPath: "field-taxonomy-category",
            label: "category",
            description:
              "This product has no category. This often happens after a category was deleted.",
          }),
        );
      }

      if (product.tags.length === 0) {
        issues.push(
          missingTaxonomyIssue({
            productId: product.id,
            productName: product.name,
            fieldPath: "field-taxonomy-tags",
            label: "tags",
            description:
              "This product has no tags. This often happens after tags were deleted or cleaned up.",
          }),
        );
      }

      if (product.collections.length === 0) {
        issues.push(
          missingTaxonomyIssue({
            productId: product.id,
            productName: product.name,
            fieldPath: "field-taxonomy-collection",
            label: "collection",
            description:
              "This product is not assigned to any collection, so it can disappear from collection-led storefront paths.",
          }),
        );
      }
    }

    mediaChecks.push({
      entityType: "PRODUCT",
      entityId: product.id,
      entityLabel: product.name,
      fieldPath: "field-imageUrl",
      label: "Product",
      url: product.imageUrl,
      targetHref: `/admin/products/${product.id}#field-imageUrl`,
    });

    const details = parseProductDetails(product.details);
    const materials =
      details.materials && details.materials.length > 0
        ? details.materials
        : fallbackProductMaterials;
    const processMediaImage = details.process?.mediaImage || fallbackProductProcess.mediaImage;
    const lookbook =
      details.lookbook && details.lookbook.length > 0
        ? details.lookbook
        : fallbackProductLookbook;

    materials.forEach((material, index) => {
      mediaChecks.push({
        entityType: "PRODUCT",
        entityId: product.id,
        entityLabel: product.name,
        fieldPath: `field-details-materials-${index}-image`,
        label: `Material ${index + 1}`,
        url: material.image,
        targetHref: `/admin/products/${product.id}#field-details-materials-${index}-image`,
      });
    });
    if (processMediaImage) {
      mediaChecks.push({
        entityType: "PRODUCT",
        entityId: product.id,
        entityLabel: product.name,
        fieldPath: "field-details-process-mediaImage",
        label: "Process",
        url: processMediaImage,
        targetHref: `/admin/products/${product.id}#field-details-process-mediaImage`,
      });
    }
    lookbook.forEach((item, index) => {
      mediaChecks.push({
        entityType: "PRODUCT",
        entityId: product.id,
        entityLabel: product.name,
        fieldPath: `field-details-lookbook-${index}-src`,
        label: `Lookbook ${index + 1}`,
        url: item.src,
        targetHref: `/admin/products/${product.id}#field-details-lookbook-${index}-src`,
      });
    });
  }

  for (const collection of collections) {
    mediaChecks.push({
      entityType: "COLLECTION",
      entityId: collection.id,
      entityLabel: collection.name,
      fieldPath: "field-heroImageUrl",
      label: "Collection hero",
      url: collection.heroImageUrl,
      targetHref: `/admin/collections/${collection.id}#field-heroImageUrl`,
    });
  }

  const mediaResults = await Promise.all(
    mediaChecks
      .filter((check) => check.url?.trim())
      .map(async (check) => ((await imageExists(check.url ?? "")) ? null : brokenMediaIssue(check))),
  );
  issues.push(...mediaResults.filter((issue): issue is IssueDraft => Boolean(issue)));

  const currentKeys = new Set(issues.map(issueKey));
  const beforeOpen = await db.adminIssue.findMany({
    where: { status: "OPEN" },
    select: { key: true },
  });
  const beforeOpenKeys = new Set(beforeOpen.map((issue) => issue.key));
  const newIssues = issues.filter((issue) => !beforeOpenKeys.has(issueKey(issue)));

  await db.$transaction(
    issues.map((issue) =>
      db.adminIssue.upsert({
        where: { key: issueKey(issue) },
        update: {
          entityType: issue.entityType,
          entityId: issue.entityId,
          entityLabel: issue.entityLabel,
          fieldPath: issue.fieldPath,
          issueType: issue.issueType,
          severity: issue.severity ?? "ERROR",
          status: "OPEN",
          title: issue.title,
          description: issue.description,
          targetHref: issue.targetHref,
          metadata: issue.metadata ? (issue.metadata as Prisma.InputJsonObject) : Prisma.JsonNull,
          resolvedAt: null,
        },
        create: {
          key: issueKey(issue),
          entityType: issue.entityType,
          entityId: issue.entityId,
          entityLabel: issue.entityLabel,
          fieldPath: issue.fieldPath,
          issueType: issue.issueType,
          severity: issue.severity ?? "ERROR",
          title: issue.title,
          description: issue.description,
          targetHref: issue.targetHref,
          metadata: issue.metadata ? (issue.metadata as Prisma.InputJsonObject) : Prisma.JsonNull,
        },
      }),
    ),
  );

  await db.adminIssue.updateMany({
    where: {
      status: "OPEN",
      key: { notIn: Array.from(currentKeys) },
    },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });

  const emailSent = await sendIssueEmail(newIssues);
  if (emailSent && newIssues.length > 0) {
    await db.adminIssue.updateMany({
      where: { key: { in: newIssues.map(issueKey) } },
      data: { notificationSentAt: new Date() },
    });
  }

  return {
    found: issues.length,
    opened: newIssues.length,
    emailSent,
  };
}
