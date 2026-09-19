export const PRODUCT_REQUIRED_PT_FIELDS = ["title", "shortDescription", "description"];
export const COLLECTION_REQUIRED_PT_FIELDS = ["name"];

// Persisted locally but not wired to a live Shopify adapter yet. Populated
// values are blockers so the report cannot claim complete synchronization.
const PRODUCT_UNSUPPORTED_SYNC_FIELDS = [
  "shortDescription",
  "materialLine",
  "symbolismLabel",
  "symbolismTitle",
  "symbolismBody",
  "symbolismBody2",
  "details",
];
const COLLECTION_UNSUPPORTED_SYNC_FIELDS = [
  "manifesto",
  "symbolismLabel",
  "symbolismTitle",
  "symbolismBody",
  "symbolismBody2",
  "searchSummary",
];

function hasContent(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

function findPt(translations) {
  return translations?.find((translation) => translation.locale === "PT") ?? null;
}

function missingFields(pt, requiredFields) {
  return requiredFields.filter((field) => !hasContent(pt?.[field]));
}

function unsupportedFields(pt, fields) {
  if (!pt) return [];
  return fields.filter((field) => hasContent(pt[field]));
}

function coverageRow({
  entityType,
  entityId,
  label,
  shopifyResourceId,
  translations,
  requiredFields,
  unsupportedSyncFields,
}) {
  const pt = findPt(translations);
  const missing = missingFields(pt, requiredFields);
  const unsupported = unsupportedFields(pt, unsupportedSyncFields);
  const reviewed = pt?.reviewStatus === "REVIEWED";
  const translationComplete = missing.length === 0 && reviewed;

  return {
    entityType,
    entityId,
    id: entityId,
    label,
    shopifyResourceId: shopifyResourceId ?? null,
    hasPt: Boolean(pt),
    reviewed,
    missingFields: missing,
    missing,
    missingIdentity: !shopifyResourceId,
    unsupportedFields: unsupported,
    translationComplete,
    complete: translationComplete,
    bindingStatus: shopifyResourceId ? "MISSING" : "NO_IDENTITY",
    enforcementReady: false,
  };
}

export function productCoverage(product) {
  return coverageRow({
    entityType: "PRODUCT",
    entityId: product.id,
    label: `${product.sku} "${product.name}"`,
    shopifyResourceId: product.shopifyProductId,
    translations: product.translations,
    requiredFields: PRODUCT_REQUIRED_PT_FIELDS,
    unsupportedSyncFields: PRODUCT_UNSUPPORTED_SYNC_FIELDS,
  });
}

export function collectionCoverage(collection) {
  return coverageRow({
    entityType: "COLLECTION",
    entityId: collection.id,
    label: `"${collection.name}"`,
    shopifyResourceId: collection.shopifyCollectionId,
    translations: collection.translations,
    requiredFields: COLLECTION_REQUIRED_PT_FIELDS,
    unsupportedSyncFields: COLLECTION_UNSUPPORTED_SYNC_FIELDS,
  });
}

function bindingKey(resourceType, value) {
  return `${resourceType}:${value}`;
}

function attachBindingStatus(rows, bindings) {
  const byEntity = new Map(
    bindings.map((binding) => [bindingKey(binding.resourceType, binding.entityId), binding]),
  );
  const byShopifyId = new Map(
    bindings.map((binding) => [bindingKey(binding.resourceType, binding.shopifyResourceId), binding]),
  );

  return rows.map((row) => {
    if (!row.shopifyResourceId) return row;
    const entityBinding = byEntity.get(bindingKey(row.entityType, row.entityId));
    const identityBinding = byShopifyId.get(bindingKey(row.entityType, row.shopifyResourceId));
    const bindingStatus = entityBinding?.shopifyResourceId === row.shopifyResourceId
      ? "BOUND"
      : entityBinding || (identityBinding && identityBinding.entityId !== row.entityId)
        ? "CONFLICT"
        : "MISSING";
    return {
      ...row,
      bindingStatus,
      enforcementReady:
        row.translationComplete
        && row.unsupportedFields.length === 0
        && bindingStatus === "BOUND",
    };
  });
}

export function buildCoverageReport({ products, collections, bindings }) {
  const rows = attachBindingStatus(
    [...products.map(productCoverage), ...collections.map(collectionCoverage)],
    bindings,
  );
  return {
    rows,
    summary: summarize(rows),
    readyForEnforcement: rows.every((row) => row.enforcementReady),
  };
}

export function planBindingCreates(report) {
  return report.rows
    .filter((row) => row.bindingStatus === "MISSING" && row.shopifyResourceId)
    .map((row) => ({
      resourceType: row.entityType,
      entityId: row.entityId,
      shopifyResourceId: row.shopifyResourceId,
    }));
}

export function summarize(rows) {
  const incomplete = rows.filter((row) => !row.translationComplete);
  return {
    total: rows.length,
    complete: rows.length - incomplete.length,
    translationComplete: rows.length - incomplete.length,
    missingPt: rows.filter((row) => !row.hasPt).length,
    missingIdentity: rows.filter((row) => row.missingIdentity).length,
    missingBinding: rows.filter((row) => row.bindingStatus === "MISSING").length,
    bindingConflicts: rows.filter((row) => row.bindingStatus === "CONFLICT").length,
    unsupported: rows.filter((row) => row.unsupportedFields.length > 0).length,
    enforcementReady: rows.filter((row) => row.enforcementReady).length,
    incomplete,
  };
}
