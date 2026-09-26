-- Shopify InventoryItem.unitCost projection (Price tab Cost field).
ALTER TABLE "ProductVariant" ADD COLUMN "costCents" INTEGER;
