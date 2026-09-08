-- Shopify ProductStatus includes UNLISTED in Admin API 2025-10 and later.
-- Keep the local projection lossless so pulling an unlisted product cannot
-- fail or silently coerce it to another workflow state.
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'UNLISTED';
