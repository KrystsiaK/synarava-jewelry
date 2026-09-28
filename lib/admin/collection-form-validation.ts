export const COLLECTION_FIELD_MESSAGES = {
  name: "Collection name is required.",
  slug: "Slug is required.",
  code: "Collection code is required.",
  workflowState: "Choose Draft or Published.",
  heroImageFile: "Hero image is required.",
  description: "Collection summary is required.",
  manifesto: "Manifesto is required.",
  searchSummary: "Search summary is required.",
} as const;

export type CollectionFieldName = keyof typeof COLLECTION_FIELD_MESSAGES;

export type CollectionFieldErrors = Partial<Record<CollectionFieldName, string>>;

// Visual order, top to bottom. The first key is the field validation scrolls to.
const FIELD_ORDER: CollectionFieldName[] = [
  "name",
  "slug",
  "code",
  "workflowState",
  "heroImageFile",
  "description",
  "manifesto",
  "searchSummary",
];

export function validateCollectionInput(input: {
  name: string;
  slug: string;
  code: string;
  description: string;
  manifesto: string;
  searchSummary: string;
  workflowState: string;
  hasHeroImage: boolean;
}): CollectionFieldErrors {
  const fieldErrors: CollectionFieldErrors = {};

  if (!input.name) fieldErrors.name = COLLECTION_FIELD_MESSAGES.name;
  if (!input.slug) fieldErrors.slug = COLLECTION_FIELD_MESSAGES.slug;
  if (!input.code) fieldErrors.code = COLLECTION_FIELD_MESSAGES.code;
  if (input.workflowState !== "DRAFT" && input.workflowState !== "PUBLISHED") {
    fieldErrors.workflowState = COLLECTION_FIELD_MESSAGES.workflowState;
  }
  if (!input.hasHeroImage) fieldErrors.heroImageFile = COLLECTION_FIELD_MESSAGES.heroImageFile;
  if (!input.description) fieldErrors.description = COLLECTION_FIELD_MESSAGES.description;
  if (!input.manifesto) fieldErrors.manifesto = COLLECTION_FIELD_MESSAGES.manifesto;
  if (!input.searchSummary) fieldErrors.searchSummary = COLLECTION_FIELD_MESSAGES.searchSummary;

  return orderFieldErrors(fieldErrors);
}

function readText(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fileFromForm(form: HTMLFormElement | null, formData: FormData) {
  const input = form?.elements.namedItem("heroImageFile");
  const inputFile = input instanceof HTMLInputElement ? input.files?.[0] : null;
  if (inputFile && inputFile.size > 0) return inputFile;
  const submitted = formData.get("heroImageFile");
  return submitted instanceof File && submitted.size > 0 ? submitted : null;
}

function formHasHeroImage(form: HTMLFormElement | null, formData: FormData) {
  const removed = formData.get("removeHeroImage") === "1";
  const existing = removed ? "" : readText(formData, "existingHeroImageUrl");
  return Boolean(existing || fileFromForm(form, formData));
}

function errorsFromFormData(formData: FormData, form: HTMLFormElement | null): CollectionFieldErrors {
  return validateCollectionInput({
    name: readText(formData, "name"),
    slug: readText(formData, "slug"),
    code: readText(formData, "code"),
    description: readText(formData, "description"),
    manifesto: readText(formData, "manifesto"),
    searchSummary: readText(formData, "searchSummary"),
    workflowState: readText(formData, "workflowState") || "DRAFT",
    hasHeroImage: formHasHeroImage(form, formData),
  });
}

/** Same rules as the save action. The file is read from the input itself — FormData can drop it. */
export function validateCollectionForm(form: HTMLFormElement): CollectionFieldErrors {
  return errorsFromFormData(new FormData(form), form);
}

export function validateCollectionFormData(formData: FormData): CollectionFieldErrors {
  return errorsFromFormData(formData, null);
}

function orderFieldErrors(fieldErrors: CollectionFieldErrors): CollectionFieldErrors {
  const ordered: CollectionFieldErrors = {};
  for (const name of FIELD_ORDER) {
    if (fieldErrors[name]) ordered[name] = fieldErrors[name];
  }
  return ordered;
}
