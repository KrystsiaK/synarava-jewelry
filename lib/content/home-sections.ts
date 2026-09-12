export type HomeSectionVisibilityFields = {
  heroSectionEnabled?: boolean;
  departmentSectionEnabled?: boolean;
  archiveSectionEnabled?: boolean;
  materialSectionEnabled?: boolean;
  manifestoSectionEnabled?: boolean;
  finalCtaSectionEnabled?: boolean;
};

export type HomeSectionVisibility = {
  hero: boolean;
  department: boolean;
  archive: boolean;
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
    material: content?.materialSectionEnabled !== false,
    manifesto: content?.manifestoSectionEnabled !== false,
    finalCta: content?.finalCtaSectionEnabled !== false,
  };
}
