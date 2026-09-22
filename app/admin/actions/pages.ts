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
import { readLocaleField } from "@/lib/i18n/admin-locale-fields";
import { getAdminTranslationLocales } from "@/lib/i18n/admin-translation-locales";
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
    locale: string;
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

// Dynamic per-section fields (`legal:{id}:title` / `legal:{id}:body`, locale-prefixed
// for a translation via the same adminLocaleFieldName convention every other field
// uses) aren't worth exploding into the zod schema one property at a time — same
// approach as the storefront-copy admin action. Reused for the fixed service-page
// sections (care/faq/returns/shipping), which follow the same shape.
function readSectionFields(formData: FormData, locale: string, kind: "legal" | "service", ids: string[]) {
  const sections: Record<string, { title: string; body: string }> = {};
  for (const id of ids) {
    const title = readLocaleField(formData, locale, `${kind}:${id}:title`);
    const body = readLocaleField(formData, locale, `${kind}:${id}:body`);
    if (title || body) sections[id] = { title, body };
  }
  return sections;
}

const TRANSLATABLE_PAGE_FIELDS = [
  "eyebrow", "body", "ctaLabel", "quote", "secondaryTitle", "secondaryBody",
  "departmentSectionTitle", "departmentSectionBody", "departmentSectionImageCaption", "departmentSectionCtaLabel",
  "archiveSectionLabel", "editSectionEyebrow", "editSectionTitle", "editSectionBody", "editSectionCtaLabel",
  "materialSectionEyebrow", "materialSectionTitle", "materialSectionNoteLabel",
  "manifestoSectionLabel", "manifestoSectionAttribution",
  "finalCtaLabel", "finalFooterTitle", "finalContactLabel", "legalIntro",
] as const;

/** Reads one locale's flat copy fields, title/handle, and the three lexicon materials straight from the raw FormData — a translation is optional everywhere, so nothing here needs `.min(1)`. */
function readPageTranslationFields(formData: FormData, locale: string) {
  const fields = Object.fromEntries(
    TRANSLATABLE_PAGE_FIELDS.map((key) => [key, readLocaleField(formData, locale, key)]),
  ) as Record<(typeof TRANSLATABLE_PAGE_FIELDS)[number], string>;
  const materials = [1, 2, 3].map((index) => ({
    name: readLocaleField(formData, locale, `material${index}Name`),
    category: readLocaleField(formData, locale, `material${index}Category`),
    description: readLocaleField(formData, locale, `material${index}Description`),
    properties: readLocaleField(formData, locale, `material${index}Properties`),
  }));
  return {
    ...fields,
    title: readLocaleField(formData, locale, "title"),
    handle: readLocaleField(formData, locale, "handle"),
    excerpt: readLocaleField(formData, locale, "excerpt"),
    materials,
  };
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
    secondaryTitle, secondaryBody, heroSectionEnabled, departmentSectionEnabled,
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
    departmentSectionCtaLabel,
    legalIntro, legalLastUpdated,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title);
  const translationLocales = await getAdminTranslationLocales();
  const legalSections = readSectionFields(formData, "en", "legal", LEGAL_SECTION_IDS);
  const serviceSections = readSectionFields(formData, "en", "service", SERVICE_SECTION_IDS);
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
  const englishTranslationContent = {
    eyebrow, body, ctaLabel, quote, secondaryTitle, secondaryBody,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel, archiveSectionLabel, editSectionEyebrow, editSectionTitle,
    editSectionBody, editSectionCtaLabel, materialSectionEyebrow,
    materialSectionTitle, materialSectionNoteLabel, materialLexicon,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel,
    finalFooterTitle, finalContactLabel, legalIntro, legalLastUpdated, legalSections, serviceSections,
  };
  // Images/src stay shared with English (see materialImages above) and are
  // never re-uploaded per locale.
  const translationsData = translationLocales.map(({ code, label }) => {
    const fields = readPageTranslationFields(formData, code);
    const content = {
      eyebrow: fields.eyebrow,
      body: fields.body,
      ctaLabel: fields.ctaLabel,
      quote: fields.quote,
      secondaryTitle: fields.secondaryTitle,
      secondaryBody: fields.secondaryBody,
      departmentSectionTitle: fields.departmentSectionTitle,
      departmentSectionBody: fields.departmentSectionBody,
      departmentSectionImageCaption: fields.departmentSectionImageCaption,
      departmentSectionCtaLabel: fields.departmentSectionCtaLabel,
      archiveSectionLabel: fields.archiveSectionLabel,
      editSectionEyebrow: fields.editSectionEyebrow,
      editSectionTitle: fields.editSectionTitle,
      editSectionBody: fields.editSectionBody,
      editSectionCtaLabel: fields.editSectionCtaLabel,
      materialSectionEyebrow: fields.materialSectionEyebrow,
      materialSectionTitle: fields.materialSectionTitle,
      materialSectionNoteLabel: fields.materialSectionNoteLabel,
      materialLexicon: buildMaterialLexiconEntries(fields.materials, materialImages),
      manifestoSectionLabel: fields.manifestoSectionLabel,
      manifestoSectionAttribution: fields.manifestoSectionAttribution,
      finalCtaLabel: fields.finalCtaLabel,
      finalFooterTitle: fields.finalFooterTitle,
      finalContactLabel: fields.finalContactLabel,
      legalIntro: fields.legalIntro,
      legalLastUpdated,
      legalSections: readSectionFields(formData, code, "legal", LEGAL_SECTION_IDS),
      serviceSections: readSectionFields(formData, code, "service", SERVICE_SECTION_IDS),
    };
    const localizedHandle = isBuiltInPage(slug) ? null : (slugify(fields.handle) || null);
    return { code, label, fields, localizedHandle, content };
  });
  const ptTranslation = translationsData.find((translation) => translation.code === "pt");
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
      // Legacy, Portuguese-only fallback from before the PageTranslation
      // table existed — no other locale ever had one, and the real
      // PageTranslation.pt row written below always takes precedence once
      // it exists (see PageEditor's translationCopyFor).
      translations: {
        pt: {
          title: ptTranslation?.fields.title ?? "",
          excerpt: ptTranslation?.fields.excerpt ?? "",
          ctaHref,
          finalCtaHref,
          finalContactEmail,
          ...(ptTranslation?.content ?? {}),
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

  const translationUpserts = translationsData.map(({ code, fields, localizedHandle, content }) => {
    const contentHash = createHash("sha256")
      .update(JSON.stringify({ title: fields.title, localizedHandle, excerpt: fields.excerpt, ...content }))
      .digest("hex");
    return {
      code,
      localizedHandle,
      syncStatus: (page.shopifyPageId ? "PENDING" : "NOT_APPLICABLE") as "PENDING" | "NOT_APPLICABLE",
      upsert: db.pageTranslation.upsert({
        where: { pageId_locale: { pageId: page.id, locale: code } },
        update: {
          title: fields.title || title, localizedHandle, excerpt: fields.excerpt || null, content,
          contentHash,
          syncStatus: page.shopifyPageId ? "PENDING" as const : "NOT_APPLICABLE" as const,
        },
        create: {
          pageId: page.id, locale: code, title: fields.title || title, localizedHandle, excerpt: fields.excerpt || null,
          content, contentHash,
          syncStatus: page.shopifyPageId ? "PENDING" as const : "NOT_APPLICABLE" as const,
        },
      }),
    };
  });
  await Promise.all([
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "en" } },
      update: {
        title, excerpt: excerpt || null, content: englishTranslationContent,
        reviewStatus: "REVIEWED", reviewedAt: new Date(),
      },
      create: {
        pageId: page.id, locale: "en", title, excerpt: excerpt || null,
        content: englishTranslationContent, reviewStatus: "REVIEWED", reviewedAt: new Date(),
      },
    }),
    ...translationUpserts.map(({ upsert }) => upsert),
  ]);
  await Promise.all(translationUpserts.map(({ code, localizedHandle }) => recordLocalizedHandleRedirect({
    entityType: "PAGE",
    entityId: page.id,
    locale: code,
    previousHandle: before?.translations.find((translation) => translation.locale === code)?.localizedHandle,
    nextHandle: localizedHandle ?? slug,
  })));

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
    secondaryTitle, secondaryBody, heroSectionEnabled, departmentSectionEnabled,
    archiveSectionEnabled, editSectionEnabled, materialSectionEnabled, manifestoSectionEnabled, finalCtaSectionEnabled,
    archiveSectionLabel, editSectionEyebrow, editSectionTitle, editSectionBody, editSectionCtaLabel,
    materialSectionEyebrow, materialSectionTitle, materialSectionNoteLabel,
    material1Name, material1Category, material1Description, material1Properties,
    material2Name, material2Category, material2Description, material2Properties,
    material3Name, material3Category, material3Description, material3Properties,
    manifestoSectionLabel, manifestoSectionAttribution, finalCtaLabel, finalCtaHref,
    finalFooterTitle, finalContactLabel, finalContactEmail,
    departmentSectionTitle, departmentSectionBody, departmentSectionImageCaption,
    departmentSectionCtaLabel,
    legalIntro, legalLastUpdated,
  } = parsed.data;
  const slug = slugify(parsed.data.slug || title) || createDraftToken("draft-page");
  const translationLocales = await getAdminTranslationLocales();
  const legalSections = readSectionFields(formData, "en", "legal", LEGAL_SECTION_IDS);
  const serviceSections = readSectionFields(formData, "en", "service", SERVICE_SECTION_IDS);
  const draftMaterialLexicon = buildMaterialLexiconEntries([
    { name: material1Name, category: material1Category, description: material1Description, properties: material1Properties },
    { name: material2Name, category: material2Category, description: material2Description, properties: material2Properties },
    { name: material3Name, category: material3Category, description: material3Description, properties: material3Properties },
  ]);
  const translationsData = translationLocales.map(({ code, label }) => {
    const fields = readPageTranslationFields(formData, code);
    const content = {
      eyebrow: fields.eyebrow,
      body: fields.body,
      ctaLabel: fields.ctaLabel,
      quote: fields.quote,
      secondaryTitle: fields.secondaryTitle,
      secondaryBody: fields.secondaryBody,
      departmentSectionTitle: fields.departmentSectionTitle,
      departmentSectionBody: fields.departmentSectionBody,
      departmentSectionImageCaption: fields.departmentSectionImageCaption,
      departmentSectionCtaLabel: fields.departmentSectionCtaLabel,
      archiveSectionLabel: fields.archiveSectionLabel,
      editSectionEyebrow: fields.editSectionEyebrow,
      editSectionTitle: fields.editSectionTitle,
      editSectionBody: fields.editSectionBody,
      editSectionCtaLabel: fields.editSectionCtaLabel,
      materialSectionEyebrow: fields.materialSectionEyebrow,
      materialSectionTitle: fields.materialSectionTitle,
      materialSectionNoteLabel: fields.materialSectionNoteLabel,
      materialLexicon: buildMaterialLexiconEntries(fields.materials),
      manifestoSectionLabel: fields.manifestoSectionLabel,
      manifestoSectionAttribution: fields.manifestoSectionAttribution,
      finalCtaLabel: fields.finalCtaLabel,
      finalFooterTitle: fields.finalFooterTitle,
      finalContactLabel: fields.finalContactLabel,
      legalIntro: fields.legalIntro,
      legalLastUpdated,
      legalSections: readSectionFields(formData, code, "legal", LEGAL_SECTION_IDS),
      serviceSections: readSectionFields(formData, code, "service", SERVICE_SECTION_IDS),
    };
    const localizedHandle = isBuiltInPage(slug) ? null : (slugify(fields.handle) || null);
    return { code, label, fields, localizedHandle, content };
  });
  const ptTranslation = translationsData.find((translation) => translation.code === "pt");

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
      // Legacy, Portuguese-only fallback — see the identical comment in savePageAction.
      translations: {
        pt: {
          title: ptTranslation?.fields.title ?? "",
          excerpt: ptTranslation?.fields.excerpt ?? "",
          ctaHref,
          finalCtaHref,
          finalContactEmail,
          ...(ptTranslation?.content ?? {}),
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
  await Promise.all([
    db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: "en" } },
      update: { title: pageData.title, excerpt: pageData.excerpt, content: englishTranslationContent },
      create: { pageId: page.id, locale: "en", title: pageData.title, excerpt: pageData.excerpt, content: englishTranslationContent },
    }),
    ...translationsData.map(({ code, fields, localizedHandle, content }) => db.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale: code } },
      update: { title: fields.title || pageData.title, localizedHandle, excerpt: fields.excerpt || null, content },
      create: { pageId: page.id, locale: code, title: fields.title || pageData.title, localizedHandle, excerpt: fields.excerpt || null, content },
    })),
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
