"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ContentVisibility, PageStatus, PageTemplate, Prisma } from "@prisma/client";
import { z } from "zod";

import { requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db";
import { revalidateStorefrontPath } from "@/lib/content/revalidate-storefront";
import { parseFormData } from "@/lib/forms/parse-form-data";
import { slugify } from "@/lib/text/slug";
import { savePageImageUpload } from "@/lib/media/local-upload";
import { isBuiltInPage } from "@/lib/content/built-in-pages";
import { recordLocalizedHandleRedirect } from "@/lib/content/handle-redirects";
import { OFFER_SECTIONS } from "@/lib/content/offer-defaults";
import { TERMS_SECTIONS } from "@/lib/content/terms-defaults";
import { PRIVACY_SECTIONS_EN } from "@/lib/content/privacy-defaults";
import { LEGAL_NOTICE_SECTIONS } from "@/lib/content/legal-notice-defaults";
import { SERVICE_SECTIONS } from "@/lib/content/service-page-defaults";
import {
  asRecord,
  createDraftToken,
  hasMeaningfulDraftInput,
  revalidateStorefront,
  writeAuditLog,
  type DraftAutosaveResult,
} from "./shared";

export type PageActionState = {
  error?: string;
  success?: string;
  page?: SavedPagePayload;
  deletedSlug?: string;
};

export type SavedPagePayload = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
  title: string;
  excerpt: string | null;
  content: unknown;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  shopifyPageId: string | null;
  shopifyHandle: string | null;
  translations: Array<{
    id: string;
    locale: "EN" | "PT";
    title: string;
    localizedHandle: string | null;
    excerpt: string | null;
    content: unknown;
    seoTitle: string | null;
    seoDescription: string | null;
    reviewStatus: "DRAFT" | "REVIEWED";
    syncStatus: "NOT_APPLICABLE" | "PENDING" | "SYNCED" | "FAILED" | "CONFLICT";
    syncError: string | null;
  }>;
};

const savedPageSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  slug: true,
  title: true,
  excerpt: true,
  content: true,
  status: true,
  visibility: true,
  shopifyPageId: true,
  shopifyHandle: true,
  translations: {
    select: {
      id: true, locale: true, title: true, localizedHandle: true, excerpt: true, content: true,
      seoTitle: true, seoDescription: true, reviewStatus: true, syncStatus: true, syncError: true,
    },
    orderBy: { locale: "asc" },
  },
} satisfies Prisma.PageSelect;

export async function getSavedPagePayload(pageIdOrSlug: string): Promise<SavedPagePayload> {
  const page = await db.page.findFirst({
    where: { OR: [{ id: pageIdOrSlug }, { slug: pageIdOrSlug }] },
    select: savedPageSelect,
  });

  if (!page) {
    throw new Error("Page not found.");
  }

  return page;
}

function existingMaterialImage(existingContent: Record<string, unknown>, index: number): string {
  const list = existingContent.materialLexicon;
  if (!Array.isArray(list)) return "";
  const entry = list[index] as Record<string, unknown> | undefined;
  return entry && typeof entry.image === "string" ? entry.image : "";
}

const LEGAL_SECTION_IDS = [...OFFER_SECTIONS, ...TERMS_SECTIONS, ...PRIVACY_SECTIONS_EN, ...LEGAL_NOTICE_SECTIONS].map((s) => s.id);
const SERVICE_SECTION_IDS = Object.values(SERVICE_SECTIONS).flatMap((sections) => sections.map((s) => s.id));

// Dynamic per-section fields (`legal:{id}:title` / `legal:{id}:body`, `pt`-prefixed
// for the translation) aren't worth exploding into the zod schema one property at a
// time — same approach as the storefront-copy admin action. Reused for the fixed
// service-page sections (care/faq/returns/shipping), which follow the same shape.
function readSectionFields(formData: FormData, prefix: string, ids: string[]) {
  const sections: Record<string, { title: string; body: string }> = {};
  for (const id of ids) {
    const title = String(formData.get(`${prefix}:${id}:title`) ?? "").trim();
    const body = String(formData.get(`${prefix}:${id}:body`) ?? "").trim();
    if (title || body) sections[id] = { title, body };
  }
  return sections;
}

function buildMaterialLexiconEntries(
  entries: Array<{ name: string; category: string; description: string; properties: string }>,
  images: Array<string | undefined> = [],
) {
  return entries.map((entry, index) => ({
    name: entry.name,
    category: entry.category,
    description: entry.description,
    properties: entry.properties,
    image: images[index],
  }));
}

async function uploadOptionalPageAsset(input: {
  formData: FormData;
  fieldName: string;
  existingValue: string;
  removeFieldName?: string;
  pageSlug: string;
  uploadedByUsername?: string | null;
}) {
  const file = input.formData.get(input.fieldName);
  const shouldRemoveExisting = input.removeFieldName
    ? String(input.formData.get(input.removeFieldName) ?? "").trim() === "1"
    : false;

  if (!(file instanceof File) || file.size === 0) {
    return shouldRemoveExisting ? "" : input.existingValue.trim();
  }

  const uploaded = await savePageImageUpload(file, input.pageSlug);
  if (!uploaded) return input.existingValue.trim();

  await db.mediaAsset.create({
    data: {
      key: uploaded.storageKey,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      extension: uploaded.extension.replace(/^\./, ""),
      sizeBytes: uploaded.sizeBytes,
      width: uploaded.width,
      height: uploaded.height,
      bucket: process.env.S3_BUCKET ?? null,
      source: "UPLOAD",
      status: "READY",
      uploadedByUsername: input.uploadedByUsername ?? null,
    },
    select: { id: true },
  });

  return uploaded.publicPath;
}

const pageContentFieldsSchema = z.object({
  pageId: z.string().trim().default(""),
  slug: z.string().trim().default(""),
  title: z.string().trim().default(""),
  excerpt: z.string().trim().default(""),
  eyebrow: z.string().trim().default(""),
  body: z.string().trim().default(""),
  ctaLabel: z.string().trim().default(""),
  ctaHref: z.string().trim().default(""),
  quote: z.string().trim().default(""),
  secondaryTitle: z.string().trim().default(""),
  secondaryBody: z.string().trim().default(""),
  heroSectionEnabled: z.string().trim().default(""),
  departmentSectionEnabled: z.string().trim().default(""),
  archiveSectionEnabled: z.string().trim().default(""),
  editSectionEnabled: z.string().trim().default(""),
  materialSectionEnabled: z.string().trim().default(""),
  manifestoSectionEnabled: z.string().trim().default(""),
  finalCtaSectionEnabled: z.string().trim().default(""),
  archiveSectionLabel: z.string().trim().default(""),
  editSectionEyebrow: z.string().trim().default(""),
  editSectionTitle: z.string().trim().default(""),
  editSectionBody: z.string().trim().default(""),
  editSectionCtaLabel: z.string().trim().default(""),
  editProductId1: z.string().trim().default(""),
  editProductId2: z.string().trim().default(""),
  editProductId3: z.string().trim().default(""),
  editProductId4: z.string().trim().default(""),
  materialSectionEyebrow: z.string().trim().default(""),
  materialSectionTitle: z.string().trim().default(""),
  materialSectionNoteLabel: z.string().trim().default(""),
  material1Name: z.string().trim().default(""),
  material1Category: z.string().trim().default(""),
  material1Description: z.string().trim().default(""),
  material1Properties: z.string().trim().default(""),
  material2Name: z.string().trim().default(""),
  material2Category: z.string().trim().default(""),
  material2Description: z.string().trim().default(""),
  material2Properties: z.string().trim().default(""),
  material3Name: z.string().trim().default(""),
  material3Category: z.string().trim().default(""),
  material3Description: z.string().trim().default(""),
  material3Properties: z.string().trim().default(""),
  manifestoSectionLabel: z.string().trim().default(""),
  manifestoSectionAttribution: z.string().trim().default(""),
  finalCtaLabel: z.string().trim().default(""),
  finalCtaHref: z.string().trim().default(""),
  finalFooterTitle: z.string().trim().default(""),
  finalContactLabel: z.string().trim().default(""),
  finalContactEmail: z.string().trim().default(""),
  departmentSectionTitle: z.string().trim().default(""),
  departmentSectionBody: z.string().trim().default(""),
  departmentSectionImageCaption: z.string().trim().default(""),
  departmentSectionCtaLabel: z.string().trim().default(""),
  legalIntro: z.string().trim().default(""),
  legalLastUpdated: z.string().trim().default(""),
  ptLegalIntro: z.string().trim().default(""),
  ptTitle: z.string().trim().default(""),
  ptHandle: z.string().trim().default(""),
  ptExcerpt: z.string().trim().default(""),
  ptEyebrow: z.string().trim().default(""),
  ptBody: z.string().trim().default(""),
  ptCtaLabel: z.string().trim().default(""),
  ptQuote: z.string().trim().default(""),
  ptSecondaryTitle: z.string().trim().default(""),
  ptSecondaryBody: z.string().trim().default(""),
  ptDepartmentSectionTitle: z.string().trim().default(""),
  ptDepartmentSectionBody: z.string().trim().default(""),
  ptDepartmentSectionImageCaption: z.string().trim().default(""),
  ptDepartmentSectionCtaLabel: z.string().trim().default(""),
  ptArchiveSectionLabel: z.string().trim().default(""),
  ptEditSectionEyebrow: z.string().trim().default(""),
  ptEditSectionTitle: z.string().trim().default(""),
  ptEditSectionBody: z.string().trim().default(""),
  ptEditSectionCtaLabel: z.string().trim().default(""),
  ptMaterialSectionEyebrow: z.string().trim().default(""),
  ptMaterialSectionTitle: z.string().trim().default(""),
  ptMaterialSectionNoteLabel: z.string().trim().default(""),
  ptMaterial1Name: z.string().trim().default(""),
  ptMaterial1Category: z.string().trim().default(""),
  ptMaterial1Description: z.string().trim().default(""),
  ptMaterial1Properties: z.string().trim().default(""),
  ptMaterial2Name: z.string().trim().default(""),
  ptMaterial2Category: z.string().trim().default(""),
  ptMaterial2Description: z.string().trim().default(""),
  ptMaterial2Properties: z.string().trim().default(""),
  ptMaterial3Name: z.string().trim().default(""),
  ptMaterial3Category: z.string().trim().default(""),
  ptMaterial3Description: z.string().trim().default(""),
  ptMaterial3Properties: z.string().trim().default(""),
  ptManifestoSectionLabel: z.string().trim().default(""),
  ptManifestoSectionAttribution: z.string().trim().default(""),
  ptFinalCtaLabel: z.string().trim().default(""),
  ptFinalFooterTitle: z.string().trim().default(""),
  ptFinalContactLabel: z.string().trim().default(""),
});

const savePageSchema = pageContentFieldsSchema.extend({
  title: z.string().trim().min(1),
  workflowState: z.string().trim().default("PUBLISHED"),
});

export async function savePageAction(formData: FormData): Promise<PageActionState> {
  const currentUser = await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, savePageSchema);
  if (!parsed.success) {
    return { error: "Page slug and title are required." };
  }
  const {
    pageId, workflowState, title, excerpt, eyebrow, body, ctaLabel, ctaHref, quote,
    secondaryTitle, secondaryBody, ptTitle, ptHandle, ptExcerpt, ptEyebrow, ptBody, ptCtaLabel,
    ptQuote, ptSecondaryTitle, ptSecondaryBody, heroSectionEnabled, departmentSectionEnabled,
    archiveSectionEnabled, editSectionEnabled, materialSectionEnabled, manifestoSectionEnabled, finalCtaSectionEnabled,
    archiveSectionLabel, editSectionEyebrow, editSectionTitle, editSectionBody, editSectionCtaLabel,
    editProductId1, editProductId2, editProductId3, editProductId4,
    materialSectionEyebrow, materialSectionTitle, materialSectionNoteLabel,
    material1Name, material1Category, material1Description, material1Properties,
    material2Name, material2Category, material2Description, material2Properties,
    material3Name, material3Category, material3Description, material3Properties,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel, finalCtaHref,
    finalFooterTitle, finalContactLabel, finalContactEmail,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel, ptDepartmentSectionTitle, ptDepartmentSectionBody,
    ptDepartmentSectionImageCaption, ptDepartmentSectionCtaLabel,
    ptArchiveSectionLabel, ptEditSectionEyebrow, ptEditSectionTitle, ptEditSectionBody, ptEditSectionCtaLabel,
    ptMaterialSectionEyebrow, ptMaterialSectionTitle, ptMaterialSectionNoteLabel,
    ptMaterial1Name, ptMaterial1Category, ptMaterial1Description, ptMaterial1Properties,
    ptMaterial2Name, ptMaterial2Category, ptMaterial2Description, ptMaterial2Properties,
    ptMaterial3Name, ptMaterial3Category, ptMaterial3Description, ptMaterial3Properties,
    ptManifestoSectionLabel, ptManifestoSectionAttribution, ptFinalCtaLabel,
    ptFinalFooterTitle, ptFinalContactLabel,
    legalIntro, legalLastUpdated, ptLegalIntro,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);
  const ptLocalizedHandle = isBuiltInPage(slug) ? null : (slugify(ptHandle) || null);
  const legalSections = readSectionFields(formData, "legal", LEGAL_SECTION_IDS);
  const ptLegalSections = readSectionFields(formData, "ptLegal", LEGAL_SECTION_IDS);
  const serviceSections = readSectionFields(formData, "service", SERVICE_SECTION_IDS);
  const ptServiceSections = readSectionFields(formData, "ptService", SERVICE_SECTION_IDS);
  const editProductIds = [editProductId1, editProductId2, editProductId3, editProductId4].filter(Boolean);

  if (!slug || !title) {
    return { error: "Page slug and title are required." };
  }
  if (editProductIds.length > 0 && (editProductIds.length !== 4 || new Set(editProductIds).size !== 4)) {
    return { error: "Choose four different products for The Edit, or leave all four product slots empty." };
  }

  const isPublished = workflowState === "PUBLISHED";
  const before = await getSavedPagePayload(pageId || slug).catch(() => null);
  const existingContent = asRecord(before?.content);
  const heroImage = await uploadOptionalPageAsset({
    formData,
    fieldName: "heroImageFile",
    existingValue: typeof existingContent.heroImage === "string" ? existingContent.heroImage : "",
    removeFieldName: "removeHeroImage",
    pageSlug: slug,
    uploadedByUsername: currentUser?.username,
  });
  const materialImages = await Promise.all([0, 1, 2].map((index) => uploadOptionalPageAsset({
    formData,
    fieldName: `material${index + 1}ImageFile`,
    existingValue: existingMaterialImage(existingContent, index),
    removeFieldName: `removeMaterial${index + 1}Image`,
    pageSlug: slug,
    uploadedByUsername: currentUser?.username,
  })));
  const materialLexicon = buildMaterialLexiconEntries([
    { name: material1Name, category: material1Category, description: material1Description, properties: material1Properties },
    { name: material2Name, category: material2Category, description: material2Description, properties: material2Properties },
    { name: material3Name, category: material3Category, description: material3Description, properties: material3Properties },
  ], materialImages);
  const ptMaterialLexicon = buildMaterialLexiconEntries([
    { name: ptMaterial1Name, category: ptMaterial1Category, description: ptMaterial1Description, properties: ptMaterial1Properties },
    { name: ptMaterial2Name, category: ptMaterial2Category, description: ptMaterial2Description, properties: ptMaterial2Properties },
    { name: ptMaterial3Name, category: ptMaterial3Category, description: ptMaterial3Description, properties: ptMaterial3Properties },
  ], materialImages);
  const englishTranslationContent = {
    eyebrow, body, ctaLabel, quote, secondaryTitle, secondaryBody,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel, archiveSectionLabel, editSectionEyebrow, editSectionTitle,
    editSectionBody, editSectionCtaLabel, materialSectionEyebrow,
    materialSectionTitle, materialSectionNoteLabel, materialLexicon,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel,
    finalFooterTitle, finalContactLabel, legalIntro, legalLastUpdated, legalSections, serviceSections,
  };
  const portugueseTranslationContent = {
    eyebrow: ptEyebrow,
    body: ptBody,
    ctaLabel: ptCtaLabel,
    quote: ptQuote,
    secondaryTitle: ptSecondaryTitle,
    secondaryBody: ptSecondaryBody,
    departmentSectionTitle: ptDepartmentSectionTitle,
    departmentSectionBody: ptDepartmentSectionBody,
    departmentSectionImageCaption: ptDepartmentSectionImageCaption,
    departmentSectionCtaLabel: ptDepartmentSectionCtaLabel,
    archiveSectionLabel: ptArchiveSectionLabel,
    editSectionEyebrow: ptEditSectionEyebrow,
    editSectionTitle: ptEditSectionTitle,
    editSectionBody: ptEditSectionBody,
    editSectionCtaLabel: ptEditSectionCtaLabel,
    materialSectionEyebrow: ptMaterialSectionEyebrow,
    materialSectionTitle: ptMaterialSectionTitle,
    materialSectionNoteLabel: ptMaterialSectionNoteLabel,
    materialLexicon: ptMaterialLexicon,
    manifestoSectionLabel: ptManifestoSectionLabel,
    manifestoSectionAttribution: ptManifestoSectionAttribution,
    finalCtaLabel: ptFinalCtaLabel,
    finalFooterTitle: ptFinalFooterTitle,
    finalContactLabel: ptFinalContactLabel,
    legalIntro: ptLegalIntro,
    legalLastUpdated,
    legalSections: ptLegalSections,
    serviceSections: ptServiceSections,
  };
  const pageData = {
    slug,
    title,
    excerpt,
    content: {
      eyebrow,
      body,
      ctaLabel,
      ctaHref,
      quote,
      secondaryTitle,
      secondaryBody,
      heroSectionEnabled: heroSectionEnabled === "1",
      departmentSectionEnabled: departmentSectionEnabled === "1",
      archiveSectionEnabled: archiveSectionEnabled === "1",
      editSectionEnabled: editSectionEnabled === "1",
      materialSectionEnabled: materialSectionEnabled === "1",
      manifestoSectionEnabled: manifestoSectionEnabled === "1",
      finalCtaSectionEnabled: finalCtaSectionEnabled === "1",
      archiveSectionLabel,
      editSectionEyebrow,
      editSectionTitle,
      editSectionBody,
      editSectionCtaLabel,
      editProductIds,
      materialSectionEyebrow,
      materialSectionTitle,
      materialSectionNoteLabel,
      materialLexicon,
      manifestoSectionLabel,
      manifestoSectionAttribution,
      finalCtaLabel,
      finalCtaHref,
      finalFooterTitle,
      finalContactLabel,
      finalContactEmail,
      departmentSectionTitle,
      departmentSectionBody,
      departmentSectionImageCaption,
      departmentSectionCtaLabel,
      legalIntro,
      legalLastUpdated,
      legalSections,
      serviceSections,
      heroImage,
      translations: {
        pt: {
          title: ptTitle,
          excerpt: ptExcerpt,
          ctaHref,
          finalCtaHref,
          finalContactEmail,
          ...portugueseTranslationContent,
        },
      },
    },
    status: isPublished ? PageStatus.PUBLISHED : PageStatus.DRAFT,
    visibility: isPublished ? ContentVisibility.PUBLIC : ContentVisibility.PRIVATE,
    publishedAt: isPublished ? new Date() : null,
    authoredByUsername: currentUser?.username ?? null,
  };

  const page = pageId
    ? await db.page.update({
        where: { id: pageId },
        data: pageData,
        select: savedPageSelect,
      })
    : await (async () => {
        const existing = await db.page.findUnique({
          where: { slug },
          select: { template: true },
        });

        return db.page.upsert({
          where: { slug },
          update: pageData,
          create: {
            ...pageData,
            template: existing?.template ?? PageTemplate.STATIC_PAGE,
            searchSummary: excerpt || title,
          },
          select: savedPageSelect,
        });
      })();

  const ptContentHash = createHash("sha256")
    .update(JSON.stringify({ title: ptTitle, localizedHandle: ptLocalizedHandle, excerpt: ptExcerpt, ...portugueseTranslationContent }))
    .digest("hex");
  await Promise.all([
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "EN" } },
      update: {
        title, excerpt: excerpt || null, content: englishTranslationContent,
        reviewStatus: "REVIEWED", reviewedAt: new Date(),
      },
      create: {
        pageId: page.id, locale: "EN", title, excerpt: excerpt || null,
        content: englishTranslationContent, reviewStatus: "REVIEWED", reviewedAt: new Date(),
      },
    }),
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "PT" } },
      update: {
        title: ptTitle || title, localizedHandle: ptLocalizedHandle, excerpt: ptExcerpt || null, content: portugueseTranslationContent,
        contentHash: ptContentHash,
        syncStatus: page.shopifyPageId ? "PENDING" : "NOT_APPLICABLE",
      },
      create: {
        pageId: page.id, locale: "PT", title: ptTitle || title, localizedHandle: ptLocalizedHandle, excerpt: ptExcerpt || null,
        content: portugueseTranslationContent, contentHash: ptContentHash,
        syncStatus: page.shopifyPageId ? "PENDING" : "NOT_APPLICABLE",
      },
    }),
  ]);
  await recordLocalizedHandleRedirect({
    entityType: "PAGE",
    entityId: page.id,
    previousHandle: before?.translations.find((translation) => translation.locale === "PT")?.localizedHandle,
    nextHandle: ptLocalizedHandle ?? slug,
  });

  await writeAuditLog({
    action: before ? "UPDATE" : "CREATE",
    entityType: "PAGE",
    entityId: page.id,
    before,
    after: page,
  });

  revalidateStorefront();
  revalidateStorefrontPath(`/${slug}`);
  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages?updated=${slug}`);
  return { success: before ? "Page updated." : "Page created.", page };
}

export async function autosavePageDraftAction(formData: FormData): Promise<DraftAutosaveResult> {
  const currentUser = await requireAdminSession("/admin/pages");

  if (!hasMeaningfulDraftInput(formData, ["pageId", "workflowState"])) {
    return {};
  }

  const parsed = parseFormData(formData, pageContentFieldsSchema);
  if (!parsed.success) {
    return {};
  }
  const {
    pageId, title, excerpt, eyebrow, body, ctaLabel, ctaHref, quote,
    secondaryTitle, secondaryBody, ptTitle, ptHandle, ptExcerpt, ptEyebrow, ptBody, ptCtaLabel,
    ptQuote, ptSecondaryTitle, ptSecondaryBody, heroSectionEnabled, departmentSectionEnabled,
    archiveSectionEnabled, editSectionEnabled, materialSectionEnabled, manifestoSectionEnabled, finalCtaSectionEnabled,
    archiveSectionLabel, editSectionEyebrow, editSectionTitle, editSectionBody, editSectionCtaLabel,
    materialSectionEyebrow, materialSectionTitle, materialSectionNoteLabel,
    material1Name, material1Category, material1Description, material1Properties,
    material2Name, material2Category, material2Description, material2Properties,
    material3Name, material3Category, material3Description, material3Properties,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel, finalCtaHref,
    finalFooterTitle, finalContactLabel, finalContactEmail,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel, ptDepartmentSectionTitle, ptDepartmentSectionBody,
    ptDepartmentSectionImageCaption, ptDepartmentSectionCtaLabel,
    ptArchiveSectionLabel, ptEditSectionEyebrow, ptEditSectionTitle, ptEditSectionBody, ptEditSectionCtaLabel,
    ptMaterialSectionEyebrow, ptMaterialSectionTitle, ptMaterialSectionNoteLabel,
    ptMaterial1Name, ptMaterial1Category, ptMaterial1Description, ptMaterial1Properties,
    ptMaterial2Name, ptMaterial2Category, ptMaterial2Description, ptMaterial2Properties,
    ptMaterial3Name, ptMaterial3Category, ptMaterial3Description, ptMaterial3Properties,
    ptManifestoSectionLabel, ptManifestoSectionAttribution, ptFinalCtaLabel,
    ptFinalFooterTitle, ptFinalContactLabel,
    legalIntro, legalLastUpdated, ptLegalIntro,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title) || createDraftToken("draft-page");
  const ptLocalizedHandle = isBuiltInPage(slug) ? null : (slugify(ptHandle) || null);
  const legalSections = readSectionFields(formData, "legal", LEGAL_SECTION_IDS);
  const ptLegalSections = readSectionFields(formData, "ptLegal", LEGAL_SECTION_IDS);
  const serviceSections = readSectionFields(formData, "service", SERVICE_SECTION_IDS);
  const ptServiceSections = readSectionFields(formData, "ptService", SERVICE_SECTION_IDS);
  const draftMaterialLexicon = buildMaterialLexiconEntries([
    { name: material1Name, category: material1Category, description: material1Description, properties: material1Properties },
    { name: material2Name, category: material2Category, description: material2Description, properties: material2Properties },
    { name: material3Name, category: material3Category, description: material3Description, properties: material3Properties },
  ]);
  const draftPtMaterialLexicon = buildMaterialLexiconEntries([
    { name: ptMaterial1Name, category: ptMaterial1Category, description: ptMaterial1Description, properties: ptMaterial1Properties },
    { name: ptMaterial2Name, category: ptMaterial2Category, description: ptMaterial2Description, properties: ptMaterial2Properties },
    { name: ptMaterial3Name, category: ptMaterial3Category, description: ptMaterial3Description, properties: ptMaterial3Properties },
  ]);

  const pageData = {
    slug,
    title: title || "Untitled page",
    excerpt: excerpt || null,
    searchSummary: excerpt || title || "Untitled page",
    content: {
      eyebrow,
      body,
      ctaLabel,
      ctaHref,
      quote,
      secondaryTitle,
      secondaryBody,
      heroSectionEnabled: heroSectionEnabled === "1",
      departmentSectionEnabled: departmentSectionEnabled === "1",
      archiveSectionEnabled: archiveSectionEnabled === "1",
      editSectionEnabled: editSectionEnabled === "1",
      materialSectionEnabled: materialSectionEnabled === "1",
      manifestoSectionEnabled: manifestoSectionEnabled === "1",
      finalCtaSectionEnabled: finalCtaSectionEnabled === "1",
      archiveSectionLabel,
      editSectionEyebrow,
      editSectionTitle,
      editSectionBody,
      editSectionCtaLabel,
      materialSectionEyebrow,
      materialSectionTitle,
      materialSectionNoteLabel,
      materialLexicon: draftMaterialLexicon,
      manifestoSectionLabel,
      manifestoSectionAttribution,
      finalCtaLabel,
      finalCtaHref,
      finalFooterTitle,
      finalContactLabel,
      finalContactEmail,
      departmentSectionTitle,
      departmentSectionBody,
      departmentSectionImageCaption,
      departmentSectionCtaLabel,
      legalIntro,
      legalLastUpdated,
      legalSections,
      serviceSections,
      translations: {
        pt: {
          title: ptTitle,
          excerpt: ptExcerpt,
          eyebrow: ptEyebrow,
          body: ptBody,
          ctaLabel: ptCtaLabel,
          ctaHref,
          quote: ptQuote,
          secondaryTitle: ptSecondaryTitle,
          secondaryBody: ptSecondaryBody,
          departmentSectionTitle: ptDepartmentSectionTitle,
          departmentSectionBody: ptDepartmentSectionBody,
          departmentSectionImageCaption: ptDepartmentSectionImageCaption,
          departmentSectionCtaLabel: ptDepartmentSectionCtaLabel,
          archiveSectionLabel: ptArchiveSectionLabel,
          editSectionEyebrow: ptEditSectionEyebrow,
          editSectionTitle: ptEditSectionTitle,
          editSectionBody: ptEditSectionBody,
          editSectionCtaLabel: ptEditSectionCtaLabel,
          materialSectionEyebrow: ptMaterialSectionEyebrow,
          materialSectionTitle: ptMaterialSectionTitle,
          materialSectionNoteLabel: ptMaterialSectionNoteLabel,
          materialLexicon: draftPtMaterialLexicon,
          manifestoSectionLabel: ptManifestoSectionLabel,
          manifestoSectionAttribution: ptManifestoSectionAttribution,
          finalCtaLabel: ptFinalCtaLabel,
          finalCtaHref,
          finalFooterTitle: ptFinalFooterTitle,
          finalContactLabel: ptFinalContactLabel,
          finalContactEmail,
          legalIntro: ptLegalIntro,
          legalSections: ptLegalSections,
          serviceSections: ptServiceSections,
        },
      },
    },
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    publishedAt: null,
    authoredByUsername: currentUser?.username ?? null,
  };

  const page = pageId
    ? await db.page.update({
        where: { id: pageId },
        data: pageData,
        select: { id: true },
      })
    : await db.page.create({
        data: {
          ...pageData,
          template: "STATIC_PAGE",
        },
        select: { id: true },
      });

  const englishTranslationContent = {
    eyebrow, body, ctaLabel, quote, secondaryTitle, secondaryBody,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel, archiveSectionLabel, editSectionEyebrow, editSectionTitle,
    editSectionBody, editSectionCtaLabel, materialSectionEyebrow,
    materialSectionTitle, materialSectionNoteLabel, materialLexicon: draftMaterialLexicon,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel,
    finalFooterTitle, finalContactLabel, legalIntro, legalLastUpdated, legalSections, serviceSections,
  };
  const portugueseTranslationContent = {
    eyebrow: ptEyebrow, body: ptBody, ctaLabel: ptCtaLabel, quote: ptQuote,
    secondaryTitle: ptSecondaryTitle, secondaryBody: ptSecondaryBody,
    departmentSectionTitle: ptDepartmentSectionTitle,
    departmentSectionBody: ptDepartmentSectionBody,
    departmentSectionImageCaption: ptDepartmentSectionImageCaption,
    departmentSectionCtaLabel: ptDepartmentSectionCtaLabel,
    archiveSectionLabel: ptArchiveSectionLabel,
    editSectionEyebrow: ptEditSectionEyebrow,
    editSectionTitle: ptEditSectionTitle,
    editSectionBody: ptEditSectionBody,
    editSectionCtaLabel: ptEditSectionCtaLabel,
    materialSectionEyebrow: ptMaterialSectionEyebrow,
    materialSectionTitle: ptMaterialSectionTitle,
    materialSectionNoteLabel: ptMaterialSectionNoteLabel,
    materialLexicon: draftPtMaterialLexicon,
    manifestoSectionLabel: ptManifestoSectionLabel,
    manifestoSectionAttribution: ptManifestoSectionAttribution,
    finalCtaLabel: ptFinalCtaLabel,
    finalFooterTitle: ptFinalFooterTitle,
    finalContactLabel: ptFinalContactLabel,
    legalIntro: ptLegalIntro,
    legalLastUpdated,
    legalSections: ptLegalSections,
    serviceSections: ptServiceSections,
  };
  await Promise.all([
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "EN" } },
      update: { title: pageData.title, excerpt: pageData.excerpt, content: englishTranslationContent },
      create: { pageId: page.id, locale: "EN", title: pageData.title, excerpt: pageData.excerpt, content: englishTranslationContent },
    }),
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "PT" } },
      update: { title: ptTitle || pageData.title, localizedHandle: ptLocalizedHandle, excerpt: ptExcerpt || null, content: portugueseTranslationContent },
      create: { pageId: page.id, locale: "PT", title: ptTitle || pageData.title, localizedHandle: ptLocalizedHandle, excerpt: ptExcerpt || null, content: portugueseTranslationContent },
    }),
  ]);

  revalidatePath("/admin/pages");
  revalidatePath("/admin");
  return { recordId: page.id };
}

const updatePageStatusSchema = z.object({
  slug: z.string().trim().min(1),
  action: z.string().trim().default(""),
});

export async function updatePageStatusAction(formData: FormData): Promise<PageActionState> {
  await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, updatePageStatusSchema);
  if (!parsed.success) {
    return { error: "Page slug is missing." };
  }
  const { slug, action } = parsed.data;

  const state =
    action === "publish"
      ? { status: "PUBLISHED" as const, visibility: "PUBLIC" as const, publishedAt: new Date() }
      : action === "draft"
        ? { status: "DRAFT" as const, visibility: "PRIVATE" as const, publishedAt: null }
        : action === "archive"
          ? { status: "ARCHIVED" as const, visibility: "PRIVATE" as const, publishedAt: null }
          : null;

  if (!state) {
    return { error: "Unknown page action." };
  }

  const before = await getSavedPagePayload(slug).catch(() => null);

  const page = await db.page.update({
    where: { slug },
    data: state,
    select: savedPageSelect,
  });

  await writeAuditLog({
    action: `STATUS_${action.toUpperCase()}`,
    entityType: "PAGE",
    entityId: page.id,
    before,
    after: page,
  });

  revalidateStorefront();
  revalidatePath("/admin/pages");
  return { success: `Page moved to ${page.status.toLowerCase()}.`, page };
}

const deletePageSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1),
});

export async function deletePageAction(formData: FormData): Promise<PageActionState> {
  await requireAdminSession("/admin/pages");

  const parsed = parseFormData(formData, deletePageSchema);
  if (!parsed.success) {
    return { error: "Page slug is required." };
  }
  const { slug } = parsed.data;

  if (isBuiltInPage(slug) || slug === "manifesto") {
    return { error: "System pages cannot be deleted." };
  }

  const before = await getSavedPagePayload(slug).catch(() => null);
  const page = await db.page.delete({
    where: { slug },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      status: true,
      visibility: true,
    },
  });

  await writeAuditLog({
    action: "DELETE",
    entityType: "PAGE",
    entityId: page.id,
    before,
  });

  revalidateStorefront();
  revalidateStorefrontPath(`/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/pages");

  return { success: "Page deleted.", deletedSlug: slug };
}
