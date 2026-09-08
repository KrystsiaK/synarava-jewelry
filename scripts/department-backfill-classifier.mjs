const DEPARTMENT_SLUGS = new Set([
  "jewelry",
  "pets",
  "kids",
  "jewelry-making",
]);

export function classifyDepartment(product) {
  const explicit = typeof product.details?.department === "string"
    ? product.details.department.trim()
    : "";
  if (DEPARTMENT_SLUGS.has(explicit)) return explicit;

  const classificationText = [
    product.shopifyCategoryName,
    product.name,
    product.seriesLabel,
    product.category?.name,
    ...product.tags.map((entry) => entry.tag.name),
  ].filter(Boolean).join(" ").toLowerCase();

  if (/\b(pet|pets|dog|dogs|cat|cats)\b/.test(classificationText)) return "pets";
  if (/\b(kid|kids|child|children|toy|toys)\b/.test(classificationText)) return "kids";
  if (/\b(bead|beads|findings|jewelry making|jewellery making|craft tools?)\b/.test(classificationText)) return "jewelry-making";
  return "jewelry";
}
