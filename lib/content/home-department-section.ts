export type HomeDepartmentSectionFields = {
  departmentSectionEnabled?: boolean;
  departmentSectionTitle?: string;
  departmentSectionBody?: string;
  departmentSectionImageCaption?: string;
  departmentSectionCtaLabel?: string;
};

export type ResolvedHomeDepartmentSection = {
  title: string;
  body: string;
  imageCaption?: string;
  ctaLabel?: string;
};

function optionalTrimmed(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function resolveHomeDepartmentSection(
  content: HomeDepartmentSectionFields | undefined,
  hasDepartments: boolean,
): ResolvedHomeDepartmentSection | null {
  if (!content?.departmentSectionEnabled || !hasDepartments) return null;

  const title = optionalTrimmed(content.departmentSectionTitle);
  const body = optionalTrimmed(content.departmentSectionBody);
  if (!title || !body) return null;

  return {
    title,
    body,
    imageCaption: optionalTrimmed(content.departmentSectionImageCaption),
    ctaLabel: optionalTrimmed(content.departmentSectionCtaLabel),
  };
}
