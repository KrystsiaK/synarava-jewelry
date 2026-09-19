export type HomeSectionVisibilityFields = {
  heroSectionEnabled?: boolean;
  departmentSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  editSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
};

export type HomeSectionVisibility = {
  hero: boolean;
  department: boolean;
  archive: boolean;
  edit: boolean;
  material: boolean;
  manifesto: boolean;
  finalCta: boolean;
};

export function resolveHomeSectionVisibility(
  content: HomeSectionVisibilityFields | undefined,
): HomeSectionVisibility {
  return {
    hero: content?.heroSectionEnabled !== false,
    department: content?.departmentSectionEnabled === true,
    archive: content?.archiveSectionEnabled !== false,
    edit: content?.editSectionEnabled !== false,
    material: content?.materialSectionEnabled !== false,
    manifesto: content?.manifestoSectionEnabled !== false,
    finalCta: content?.finalCtaSectionEnabled !== false,
  };
}
