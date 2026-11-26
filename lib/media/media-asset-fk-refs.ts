/**
 * Every MediaAsset reverse-relation FK that counts as an in-use reference.
 * Keep in sync with prisma MediaAsset @relation names — guarded by test.
 */
export const MEDIA_ASSET_FK_REF_FIELDS = [
  { model: "Product", field: "primaryAssetId", relation: "ProductPrimaryAsset" },
  { model: "Collection", field: "heroAssetId", relation: "CollectionHeroAsset" },
  { model: "Collection", field: "coverAssetId", relation: "CollectionCoverAsset" },
  { model: "ProductMedia", field: "assetId", relation: "ProductMediaAsset" },
  { model: "ProductPairingImage", field: "imageAssetId", relation: "PairingImage" },
] as const;
